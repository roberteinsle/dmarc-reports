/**
 * Email Fetcher Service
 * Fetches DMARC reports via IMAP and processes them
 */

import Imap from 'imap';
import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import AdmZip from 'adm-zip';
import { gunzipSync } from 'zlib';
import { parseDmarcXml } from './dmarc-parser';
import { insertProcessingLog } from '../db/client';
import { logger } from '../utils/logger';

interface ImapConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
}

/**
 * Get IMAP configuration from environment
 */
function getImapConfig(): ImapConfig {
  return {
    user: process.env.IMAP_USER || '',
    password: process.env.IMAP_PASSWORD || '',
    host: process.env.IMAP_HOST || '',
    port: parseInt(process.env.IMAP_PORT || '993'),
    tls: true,
  };
}

/**
 * Extract XML content from attachment
 */
function extractXmlFromAttachment(attachment: Attachment): string | null {
  const filename = attachment.filename || '';
  const content = attachment.content;

  try {
    // Handle GZ files
    if (filename.endsWith('.gz')) {
      logger.debug(`Extracting GZ file: ${filename}`);
      const decompressed = gunzipSync(content);
      return decompressed.toString('utf-8');
    }

    // Handle ZIP files
    if (filename.endsWith('.zip')) {
      logger.debug(`Extracting ZIP file: ${filename}`);
      const zip = new AdmZip(content);
      const entries = zip.getEntries();

      if (entries.length === 0) {
        logger.warn(`ZIP file ${filename} is empty`);
        return null;
      }

      // Get first XML file in ZIP
      const xmlEntry = entries.find(e => e.entryName.endsWith('.xml'));
      if (xmlEntry) {
        return xmlEntry.getData().toString('utf-8');
      }

      // If no .xml extension, try first entry
      return entries[0].getData().toString('utf-8');
    }

    // Handle raw XML files
    if (filename.endsWith('.xml')) {
      logger.debug(`Reading XML file: ${filename}`);
      return content.toString('utf-8');
    }

    logger.warn(`Unknown attachment format: ${filename}`);
    return null;
  } catch (error) {
    logger.error(`Error extracting ${filename}:`, error);
    return null;
  }
}

/**
 * Process a single email message
 */
async function processEmail(
  imap: Imap,
  seqno: number,
  stream: NodeJS.ReadableStream
): Promise<void> {
  try {
    const parsed = await simpleParser(stream);
    const subject = parsed.subject || 'No Subject';
    const from = parsed.from?.text || 'Unknown';

    logger.info(`Processing email: ${subject} from ${from}`);

    if (!parsed.attachments || parsed.attachments.length === 0) {
      logger.warn('Email has no attachments, skipping');
      await insertProcessingLog({
        email_uid: seqno.toString(),
        subject,
        from_address: from,
        attachment_count: 0,
        status: 'SKIPPED',
        error_message: 'No attachments found',
      });
      return;
    }

    let processedCount = 0;

    for (const attachment of parsed.attachments) {
      const xmlContent = extractXmlFromAttachment(attachment);

      if (xmlContent) {
        try {
          await parseDmarcXml(xmlContent);
          processedCount++;
        } catch (error) {
          logger.error('Error parsing DMARC XML:', error);
        }
      }
    }

    if (processedCount > 0) {
      // Mark email for deletion
      imap.addFlags(seqno, ['\\Deleted'], (err) => {
        if (err) {
          logger.error('Error marking email for deletion:', err);
        } else {
          logger.info(`Marked email ${seqno} for deletion`);
        }
      });

      await insertProcessingLog({
        email_uid: seqno.toString(),
        subject,
        from_address: from,
        attachment_count: parsed.attachments.length,
        status: 'SUCCESS',
        error_message: null,
      });
    } else {
      await insertProcessingLog({
        email_uid: seqno.toString(),
        subject,
        from_address: from,
        attachment_count: parsed.attachments.length,
        status: 'FAILED',
        error_message: 'No valid DMARC XML found in attachments',
      });
    }
  } catch (error) {
    logger.error(`Error processing email ${seqno}:`, error);
    await insertProcessingLog({
      email_uid: seqno.toString(),
      subject: 'Unknown',
      from_address: 'Unknown',
      attachment_count: 0,
      status: 'FAILED',
      error_message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Fetch and process DMARC report emails from IMAP server
 */
export async function fetchAndProcessEmails(): Promise<void> {
  return new Promise((resolve, reject) => {
    const config = getImapConfig();

    if (!config.user || !config.password || !config.host) {
      const error = 'IMAP configuration missing. Check environment variables.';
      logger.error(error);
      reject(new Error(error));
      return;
    }

    logger.info(`Connecting to IMAP server: ${config.host}:${config.port}`);

    const imap = new Imap({
      user: config.user,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: config.tls,
      tlsOptions: { rejectUnauthorized: false },
    });

    imap.once('ready', () => {
      logger.info('IMAP connection ready');

      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          logger.error('Error opening INBOX:', err);
          reject(err);
          return;
        }

        logger.info(`INBOX opened. Total messages: ${box.messages.total}`);

        // Search for unseen messages
        imap.search(['UNSEEN'], async (err, results) => {
          if (err) {
            logger.error('Error searching emails:', err);
            reject(err);
            return;
          }

          if (!results || results.length === 0) {
            logger.info('No new emails to process');
            imap.end();
            resolve();
            return;
          }

          logger.info(`Found ${results.length} unread email(s)`);

          const fetch = imap.fetch(results, { bodies: '' });
          const processingPromises: Promise<void>[] = [];

          fetch.on('message', (msg, seqno) => {
            msg.on('body', (stream) => {
              processingPromises.push(processEmail(imap, seqno, stream));
            });
          });

          fetch.once('error', (err) => {
            logger.error('Fetch error:', err);
            reject(err);
          });

          fetch.once('end', async () => {
            logger.info('Finished fetching emails');

            // Wait for all emails to be processed
            try {
              await Promise.all(processingPromises);
              logger.info('All emails processed');

              // Expunge deleted messages
              imap.expunge((err) => {
                if (err) {
                  logger.error('Error expunging:', err);
                }
                imap.end();
              });
            } catch (error) {
              logger.error('Error processing emails:', error);
              imap.end();
              reject(error);
            }
          });
        });
      });
    });

    imap.once('error', (err) => {
      logger.error('IMAP error:', err);
      reject(err);
    });

    imap.once('end', () => {
      logger.info('IMAP connection ended');
      resolve();
    });

    imap.connect();
  });
}
