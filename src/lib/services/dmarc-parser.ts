/**
 * DMARC Parser Service
 * Parses DMARC XML reports according to RFC 7489
 */

import { XMLParser } from 'fast-xml-parser';
import {
  insertDmarcReport,
  insertDmarcRecord,
  getDmarcReportByReportId,
} from '../db/client';
import { logger } from '../utils/logger';

interface DmarcXmlFeedback {
  feedback: {
    report_metadata: {
      org_name: string;
      email: string;
      report_id: string;
      date_range: {
        begin: number;
        end: number;
      };
    };
    policy_published: {
      domain: string;
      adkim?: string;
      aspf?: string;
      p: string;
      sp?: string;
      pct?: number;
    };
    record: DmarcXmlRecord | DmarcXmlRecord[];
  };
}

interface DmarcXmlRecord {
  row: {
    source_ip: string;
    count: number;
    policy_evaluated: {
      disposition: string;
      dkim: string;
      spf: string;
    };
  };
  identifiers: {
    header_from: string;
    envelope_from?: string;
  };
  auth_results?: {
    dkim?: {
      domain?: string;
      result?: string;
      selector?: string;
    } | Array<{
      domain?: string;
      result?: string;
      selector?: string;
    }>;
    spf?: {
      domain?: string;
      result?: string;
    } | Array<{
      domain?: string;
      result?: string;
    }>;
  };
}

/**
 * Parse DMARC XML content and store in database
 */
export async function parseDmarcXml(xmlContent: string): Promise<number | null> {
  try {
    logger.info('Parsing DMARC XML...');

    // Parse XML to JSON
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: true,
      parseTagValue: true,
    });

    const result = parser.parse(xmlContent) as DmarcXmlFeedback;

    if (!result.feedback) {
      logger.error('Invalid DMARC XML: missing feedback element');
      return null;
    }

    const { report_metadata, policy_published, record } = result.feedback;

    // Check if report already exists
    const existing = getDmarcReportByReportId(report_metadata.report_id);
    if (existing) {
      logger.info(`Report ${report_metadata.report_id} already exists, skipping`);
      return existing.id;
    }

    // Insert DMARC report
    const reportId = insertDmarcReport({
      report_id: report_metadata.report_id,
      org_name: report_metadata.org_name,
      email: report_metadata.email,
      date_begin: report_metadata.date_range.begin,
      date_end: report_metadata.date_range.end,
      domain: policy_published.domain,
      policy_published: JSON.stringify(policy_published),
      raw_xml: xmlContent,
    });

    logger.info(`Inserted DMARC report: ${report_metadata.report_id} (ID: ${reportId})`);

    // Parse records (can be single object or array)
    const records = Array.isArray(record) ? record : [record];
    let recordCount = 0;

    for (const rec of records) {
      if (!rec.row) continue;

      // Extract DKIM info
      let dkimDomain: string | null = null;
      let dkimSelector: string | null = null;
      if (rec.auth_results?.dkim) {
        const dkimResult = Array.isArray(rec.auth_results.dkim)
          ? rec.auth_results.dkim[0]
          : rec.auth_results.dkim;
        dkimDomain = dkimResult.domain || null;
        dkimSelector = dkimResult.selector || null;
      }

      // Extract SPF info
      let spfDomain: string | null = null;
      if (rec.auth_results?.spf) {
        const spfResult = Array.isArray(rec.auth_results.spf)
          ? rec.auth_results.spf[0]
          : rec.auth_results.spf;
        spfDomain = spfResult.domain || null;
      }

      insertDmarcRecord({
        report_id: reportId,
        source_ip: rec.row.source_ip,
        count: rec.row.count,
        disposition: rec.row.policy_evaluated.disposition,
        dkim: rec.row.policy_evaluated.dkim,
        spf: rec.row.policy_evaluated.spf,
        header_from: rec.identifiers.header_from,
        envelope_from: rec.identifiers.envelope_from || null,
        dkim_domain: dkimDomain,
        dkim_selector: dkimSelector,
        spf_domain: spfDomain,
        country: null, // TODO: Add GeoIP lookup in future
      });

      recordCount++;
    }

    logger.info(`Inserted ${recordCount} DMARC records for report ${reportId}`);

    return reportId;
  } catch (error) {
    logger.error('Error parsing DMARC XML:', error);
    throw error;
  }
}
