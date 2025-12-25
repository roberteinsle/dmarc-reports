#!/usr/bin/env tsx

/**
 * Manual Claude Analyzer Script
 * Run this script to manually analyze unprocessed DMARC reports with Claude AI
 */

import 'dotenv/config';
import { analyzeUnprocessedReports } from '../lib/services/claude-analyzer';
import { logger } from '../lib/utils/logger';
import { closeDatabase } from '../lib/db/client';

async function main() {
  logger.info('=== Starting Manual Claude Analysis ===');

  try {
    const analyzedCount = await analyzeUnprocessedReports();
    logger.info(`=== Analysis completed. Processed ${analyzedCount} reports ===`);
  } catch (error) {
    logger.error('=== Analysis failed ===', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

// Run the script
main();
