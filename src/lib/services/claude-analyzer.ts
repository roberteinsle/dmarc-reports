/**
 * Claude AI Analyzer Service
 * Analyzes DMARC reports using Claude API
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  getUnprocessedReports,
  getDmarcRecordsByReportId,
  insertAiAnalysis,
  markReportProcessed,
} from '../db/client';
import { logger } from '../utils/logger';
import { sendThreatNotification } from './notification';
import type { ClaudeAnalysisResponse } from '../types/analysis';
import type { DmarcReport, DmarcRecord } from '../db/schema';

const MODEL = 'claude-3-5-sonnet-20241022';
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.3;

/**
 * Initialize Anthropic client
 */
function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not found in environment variables');
  }

  return new Anthropic({
    apiKey,
  });
}

/**
 * Build analysis prompt for Claude
 */
function buildAnalysisPrompt(
  report: DmarcReport,
  records: DmarcRecord[]
): string {
  const policyPublished = JSON.parse(report.policy_published);

  const reportData = {
    metadata: {
      org_name: report.org_name,
      email: report.email,
      domain: report.domain,
      date_begin: new Date(report.date_begin * 1000).toISOString(),
      date_end: new Date(report.date_end * 1000).toISOString(),
    },
    policy: policyPublished,
    records: records.map((r) => ({
      source_ip: r.source_ip,
      count: r.count,
      disposition: r.disposition,
      dkim: r.dkim,
      spf: r.spf,
      header_from: r.header_from,
      envelope_from: r.envelope_from,
      dkim_domain: r.dkim_domain,
      dkim_selector: r.dkim_selector,
      spf_domain: r.spf_domain,
    })),
  };

  return `You are a DMARC security analyst. Analyze the following DMARC report and provide a comprehensive security assessment.

DMARC Report Data:
${JSON.stringify(reportData, null, 2)}

Please analyze this report and provide your response in the following JSON format (respond ONLY with valid JSON, no additional text):

{
  "compliance_status": "PASS|PARTIAL|FAIL",
  "compliance_score": 0-100,
  "threats": [
    {
      "type": "spoofing|phishing|unauthorized_sender|policy_violation|other",
      "severity": "LOW|MEDIUM|HIGH|CRITICAL",
      "description": "Detailed description of the threat",
      "source_ips": ["IP addresses involved"],
      "evidence": "Evidence from the report supporting this finding"
    }
  ],
  "threat_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "trends": {
    "total_messages": number,
    "pass_rate": 0.0-1.0,
    "fail_rate": 0.0-1.0,
    "top_sources": [{"ip": "x.x.x.x", "count": number}],
    "disposition_summary": {"none": number, "quarantine": number, "reject": number}
  },
  "recommendations": [
    "Specific actionable recommendation 1",
    "Specific actionable recommendation 2"
  ],
  "summary": "2-3 sentence overall assessment"
}

Analysis Criteria:

1. **Compliance Status**: Evaluate based on:
   - SPF/DKIM alignment rates
   - Policy enforcement (p=quarantine/reject vs p=none)
   - Percentage of passing vs failing messages

2. **Threat Detection**: Identify:
   - Unauthorized sources sending emails (SPF/DKIM failures)
   - Suspicious IP addresses or patterns
   - Header From vs Envelope From mismatches (potential spoofing)
   - Policy violations (messages that should be rejected but aren't)

3. **Threat Level**: Set overall threat level based on:
   - CRITICAL: Active spoofing/phishing detected, high volume of failures
   - HIGH: Significant authentication failures, policy not enforced
   - MEDIUM: Some failures, partial policy enforcement
   - LOW: Mostly passing, good policy enforcement

4. **Trends**: Calculate statistics from the records

5. **Recommendations**: Provide specific actions such as:
   - Policy changes (upgrade from p=none to p=quarantine/reject)
   - Investigation of specific IPs
   - Configuration fixes for SPF/DKIM
   - Monitoring priorities

Respond ONLY with the JSON object, no markdown formatting or additional text.`;
}

/**
 * Parse and validate Claude's JSON response
 */
function parseClaudeResponse(responseText: string): ClaudeAnalysisResponse {
  try {
    // Remove potential markdown code blocks
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleanedText) as ClaudeAnalysisResponse;

    // Validate required fields
    if (!parsed.compliance_status || !parsed.threat_level || !parsed.threats || !parsed.recommendations) {
      throw new Error('Missing required fields in Claude response');
    }

    return parsed;
  } catch (error) {
    logger.error('Error parsing Claude response:', error);
    logger.error('Raw response:', responseText);
    throw new Error(`Failed to parse Claude response: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Analyze a single DMARC report with Claude
 */
async function analyzeReport(
  anthropic: Anthropic,
  report: DmarcReport,
  records: DmarcRecord[]
): Promise<void> {
  try {
    logger.info(`Analyzing report ${report.report_id} with Claude...`);

    const prompt = buildAnalysisPrompt(report, records);

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract text from response
    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => ('text' in block ? block.text : ''))
      .join('\n');

    logger.debug('Claude raw response:', responseText);

    const analysis = parseClaudeResponse(responseText);

    logger.info(`Analysis complete. Threat level: ${analysis.threat_level}, Compliance: ${analysis.compliance_status}`);

    // Save to database
    const analysisId = insertAiAnalysis({
      report_id: report.id,
      compliance_status: analysis.compliance_status,
      compliance_score: analysis.compliance_score,
      threats_detected: JSON.stringify(analysis.threats),
      threat_level: analysis.threat_level,
      trends: JSON.stringify(analysis.trends),
      recommendations: JSON.stringify(analysis.recommendations),
      summary: analysis.summary,
      model_version: MODEL,
    });

    logger.info(`Saved analysis for report ${report.id}`);

    // Send notification for HIGH/CRITICAL threats
    if (analysis.threat_level === 'HIGH' || analysis.threat_level === 'CRITICAL') {
      const analysisRecord = {
        id: analysisId,
        report_id: report.id,
        compliance_status: analysis.compliance_status,
        compliance_score: analysis.compliance_score,
        threats_detected: JSON.stringify(analysis.threats),
        threat_level: analysis.threat_level,
        trends: JSON.stringify(analysis.trends),
        recommendations: JSON.stringify(analysis.recommendations),
        summary: analysis.summary,
        analyzed_at: new Date().toISOString(),
        model_version: MODEL,
      };

      await sendThreatNotification(analysisRecord, report.id);
    }

    // Mark report as processed
    markReportProcessed(report.id);
  } catch (error) {
    logger.error(`Error analyzing report ${report.report_id}:`, error);
    throw error;
  }
}

/**
 * Analyze all unprocessed DMARC reports
 */
export async function analyzeUnprocessedReports(): Promise<number> {
  const anthropic = getAnthropicClient();
  const reports = getUnprocessedReports();

  if (reports.length === 0) {
    logger.info('No unprocessed reports to analyze');
    return 0;
  }

  logger.info(`Found ${reports.length} unprocessed report(s) to analyze`);

  let analyzedCount = 0;

  for (const report of reports) {
    try {
      const records = getDmarcRecordsByReportId(report.id);

      if (records.length === 0) {
        logger.warn(`Report ${report.id} has no records, skipping`);
        markReportProcessed(report.id);
        continue;
      }

      await analyzeReport(anthropic, report, records);
      analyzedCount++;

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      logger.error(`Failed to analyze report ${report.id}:`, error);
      // Continue with next report
    }
  }

  logger.info(`Successfully analyzed ${analyzedCount} out of ${reports.length} reports`);

  return analyzedCount;
}
