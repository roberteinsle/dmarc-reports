/**
 * Notification Service
 * Sends email alerts via Postal API for critical DMARC threats
 */

import {
  getNotificationByAnalysisId,
  insertNotification,
  getDatabase,
} from '../db/client';
import { logger } from '../utils/logger';
import type { AiAnalysis, DmarcReport } from '../db/schema';

interface PostalConfig {
  apiKey: string;
  baseUrl: string;
  fromEmail: string;
  toEmail: string;
}

interface PostalResponse {
  status: string;
  time: number;
  flags: Record<string, any>;
  data: {
    message_id: string;
    messages: Record<string, {
      id: number;
      token: string;
    }>;
  };
}

/**
 * Get Postal configuration from environment
 */
function getPostalConfig(): PostalConfig {
  return {
    apiKey: process.env.POSTAL_API_KEY || '',
    baseUrl: process.env.POSTAL_BASE_URL || '',
    fromEmail: process.env.NOTIFICATION_FROM_EMAIL || '',
    toEmail: process.env.NOTIFICATION_TO_EMAIL || '',
  };
}

/**
 * Build HTML email template for threat notification
 */
function buildEmailHtml(
  analysis: AiAnalysis,
  report: DmarcReport,
  threats: any[]
): string {
  const threatLevel = analysis.threat_level;
  const levelColor =
    threatLevel === 'CRITICAL' ? '#dc2626' :
    threatLevel === 'HIGH' ? '#ea580c' :
    '#f59e0b';

  const levelBgColor =
    threatLevel === 'CRITICAL' ? '#fee2e2' :
    threatLevel === 'HIGH' ? '#ffedd5' :
    '#fef3c7';

  const dateBegin = new Date(report.date_begin * 1000).toLocaleDateString('de-DE');
  const dateEnd = new Date(report.date_end * 1000).toLocaleDateString('de-DE');

  const recommendations = JSON.parse(analysis.recommendations);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: ${levelBgColor}; border-left: 4px solid ${levelColor}; padding: 15px; margin-bottom: 20px;">
    <h1 style="margin: 0; color: ${levelColor}; font-size: 24px;">
      🚨 ${threatLevel} DMARC Bedrohung erkannt
    </h1>
  </div>

  <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
    <h2 style="margin-top: 0; color: #374151; font-size: 18px;">Report-Details</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; width: 30%;">Domain:</td>
        <td style="padding: 8px 0; font-weight: bold;">${report.domain}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Reporter:</td>
        <td style="padding: 8px 0;">${report.org_name}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Zeitraum:</td>
        <td style="padding: 8px 0;">${dateBegin} - ${dateEnd}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Compliance:</td>
        <td style="padding: 8px 0;">${analysis.compliance_status} (${analysis.compliance_score}%)</td>
      </tr>
    </table>
  </div>

  <div style="margin-bottom: 20px;">
    <h2 style="color: #374151; font-size: 18px;">Erkannte Bedrohungen</h2>
    ${threats.map(threat => `
      <div style="background-color: #fff; border: 1px solid #e5e7eb; border-radius: 5px; padding: 12px; margin-bottom: 10px;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <span style="background-color: ${levelBgColor}; color: ${levelColor}; padding: 4px 8px; border-radius: 3px; font-size: 12px; font-weight: bold; margin-right: 10px;">
            ${threat.severity}
          </span>
          <strong>${threat.type}</strong>
        </div>
        <p style="margin: 8px 0; color: #4b5563;">${threat.description}</p>
        ${threat.source_ips && threat.source_ips.length > 0 ? `
          <p style="margin: 8px 0; font-size: 14px; color: #6b7280;">
            <strong>Quell-IPs:</strong> ${threat.source_ips.join(', ')}
          </p>
        ` : ''}
        ${threat.evidence ? `
          <p style="margin: 8px 0; font-size: 13px; color: #6b7280; font-style: italic;">
            ${threat.evidence}
          </p>
        ` : ''}
      </div>
    `).join('')}
  </div>

  ${recommendations.length > 0 ? `
    <div style="margin-bottom: 20px;">
      <h2 style="color: #374151; font-size: 18px;">Empfohlene Maßnahmen</h2>
      <ol style="padding-left: 20px;">
        ${recommendations.map(rec => `
          <li style="margin-bottom: 8px; color: #4b5563;">${rec}</li>
        `).join('')}
      </ol>
    </div>
  ` : ''}

  <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin-top: 20px;">
    <p style="margin: 0; font-size: 14px; color: #6b7280;">
      <strong>Zusammenfassung:</strong><br>
      ${analysis.summary}
    </p>
  </div>

  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
    <p style="margin: 5px 0;">Diese automatische Benachrichtigung wurde von DMARC Reports generiert</p>
    <p style="margin: 5px 0;">Zeitpunkt: ${new Date().toLocaleString('de-DE')}</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Build plain text email for threat notification
 */
function buildEmailPlain(
  analysis: AiAnalysis,
  report: DmarcReport,
  threats: any[]
): string {
  const dateBegin = new Date(report.date_begin * 1000).toLocaleDateString('de-DE');
  const dateEnd = new Date(report.date_end * 1000).toLocaleDateString('de-DE');
  const recommendations = JSON.parse(analysis.recommendations);

  let text = `🚨 ${analysis.threat_level} DMARC Bedrohung erkannt\n\n`;
  text += `Report-Details:\n`;
  text += `Domain: ${report.domain}\n`;
  text += `Reporter: ${report.org_name}\n`;
  text += `Zeitraum: ${dateBegin} - ${dateEnd}\n`;
  text += `Compliance: ${analysis.compliance_status} (${analysis.compliance_score}%)\n\n`;

  text += `Erkannte Bedrohungen:\n\n`;
  threats.forEach((threat, idx) => {
    text += `${idx + 1}. [${threat.severity}] ${threat.type}\n`;
    text += `   ${threat.description}\n`;
    if (threat.source_ips && threat.source_ips.length > 0) {
      text += `   Quell-IPs: ${threat.source_ips.join(', ')}\n`;
    }
    text += `\n`;
  });

  if (recommendations.length > 0) {
    text += `Empfohlene Maßnahmen:\n\n`;
    recommendations.forEach((rec, idx) => {
      text += `${idx + 1}. ${rec}\n`;
    });
    text += `\n`;
  }

  text += `Zusammenfassung:\n${analysis.summary}\n\n`;
  text += `---\n`;
  text += `Diese automatische Benachrichtigung wurde von DMARC Reports generiert\n`;
  text += `Zeitpunkt: ${new Date().toLocaleString('de-DE')}\n`;

  return text;
}

/**
 * Send email via Postal API
 */
async function sendPostalEmail(
  config: PostalConfig,
  subject: string,
  htmlBody: string,
  plainBody: string
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/api/v1/send/message`, {
    method: 'POST',
    headers: {
      'X-Server-API-Key': config.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: [config.toEmail],
      from: config.fromEmail,
      subject,
      plain_body: plainBody,
      html_body: htmlBody,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Postal API error: ${response.status} - ${errorText}`);
  }

  const result = (await response.json()) as PostalResponse;

  if (result.status !== 'success') {
    throw new Error(`Postal API returned status: ${result.status}`);
  }

  return result.data.message_id;
}

/**
 * Send notification for critical DMARC threat
 */
export async function sendThreatNotification(
  analysis: AiAnalysis,
  reportId: number
): Promise<boolean> {
  try {
    // Check if notification already sent for this analysis
    const existing = getNotificationByAnalysisId(analysis.id);
    if (existing) {
      logger.info(`Notification already sent for analysis ${analysis.id}`);
      return false;
    }

    // Only send for HIGH or CRITICAL threats
    if (analysis.threat_level !== 'HIGH' && analysis.threat_level !== 'CRITICAL') {
      logger.debug(`Skipping notification for ${analysis.threat_level} threat level`);
      return false;
    }

    const config = getPostalConfig();

    if (!config.apiKey || !config.baseUrl || !config.fromEmail || !config.toEmail) {
      throw new Error('Postal configuration incomplete');
    }

    // Get report details
    const db = getDatabase();
    const report = db.prepare('SELECT * FROM dmarc_reports WHERE id = ?').get(reportId) as DmarcReport;

    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    const threats = JSON.parse(analysis.threats_detected);

    // Build email content
    const subject = `🚨 ${analysis.threat_level} DMARC Alert - ${report.domain}`;
    const htmlBody = buildEmailHtml(analysis, report, threats);
    const plainBody = buildEmailPlain(analysis, report, threats);

    logger.info(`Sending ${analysis.threat_level} threat notification for report ${reportId}`);

    // Send via Postal
    const messageId = await sendPostalEmail(config, subject, htmlBody, plainBody);

    // Save notification record
    insertNotification({
      analysis_id: analysis.id,
      threat_level: analysis.threat_level,
      postal_message_id: messageId,
      status: 'SENT',
      error_message: null,
    });

    logger.info(`Notification sent successfully. Message ID: ${messageId}`);

    return true;
  } catch (error) {
    logger.error('Error sending notification:', error);

    // Save failed notification
    try {
      insertNotification({
        analysis_id: analysis.id,
        threat_level: analysis.threat_level,
        postal_message_id: null,
        status: 'FAILED',
        error_message: error instanceof Error ? error.message : String(error),
      });
    } catch (dbError) {
      logger.error('Error saving failed notification:', dbError);
    }

    return false;
  }
}
