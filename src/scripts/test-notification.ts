#!/usr/bin/env tsx

/**
 * Test Notification Script
 * Sends a test notification for the most recent HIGH/CRITICAL analysis
 */

import 'dotenv/config';
import { getDatabase, closeDatabase } from '../lib/db/client';
import { sendThreatNotification } from '../lib/services/notification';
import { logger } from '../lib/utils/logger';
import type { AiAnalysis } from '../lib/db/schema';

async function main() {
  logger.info('=== Testing Notification System ===');

  try {
    const db = getDatabase();

    // Get most recent HIGH or CRITICAL analysis
    const analysis = db.prepare(`
      SELECT * FROM ai_analysis
      WHERE threat_level IN ('HIGH', 'CRITICAL')
      ORDER BY analyzed_at DESC
      LIMIT 1
    `).get() as AiAnalysis | undefined;

    if (!analysis) {
      logger.warn('No HIGH or CRITICAL analyses found in database');
      logger.info('Run the analyzer first to generate some analyses');
      return;
    }

    logger.info(`Found analysis ${analysis.id} with threat level: ${analysis.threat_level}`);

    // Send notification
    const sent = await sendThreatNotification(analysis, analysis.report_id);

    if (sent) {
      logger.info('✅ Test notification sent successfully!');
    } else {
      logger.warn('⚠️  Notification was not sent (may be duplicate or wrong threat level)');
    }

  } catch (error) {
    logger.error('=== Notification test failed ===', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

// Run the test
main();
