#!/usr/bin/env tsx

/**
 * Complete DMARC Pipeline Script
 * Fetches emails, parses DMARC reports, and analyzes them with Claude AI
 */

import 'dotenv/config';
import { fetchAndProcessEmails } from '../lib/services/email-fetcher';
import { analyzeUnprocessedReports } from '../lib/services/claude-analyzer';
import { logger } from '../lib/utils/logger';
import { closeDatabase } from '../lib/db/client';

async function main() {
  logger.info('=== Starting Complete DMARC Pipeline ===');

  try {
    // Step 1: Fetch emails
    logger.info('Step 1: Fetching emails from IMAP...');
    await fetchAndProcessEmails();

    // Step 2: Analyze reports
    logger.info('Step 2: Analyzing reports with Claude AI...');
    const analyzedCount = await analyzeUnprocessedReports();

    logger.info(`=== Pipeline completed. Analyzed ${analyzedCount} reports ===`);
  } catch (error) {
    logger.error('=== Pipeline failed ===', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

// Run the pipeline
main();
