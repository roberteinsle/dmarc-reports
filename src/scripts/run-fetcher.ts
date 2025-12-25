#!/usr/bin/env tsx

/**
 * Manual Email Fetcher Script
 * Run this script to manually fetch and process DMARC report emails
 */

import 'dotenv/config';
import { fetchAndProcessEmails } from '../lib/services/email-fetcher';
import { logger } from '../lib/utils/logger';
import { closeDatabase } from '../lib/db/client';

async function main() {
  logger.info('=== Starting Manual Email Fetch ===');

  try {
    await fetchAndProcessEmails();
    logger.info('=== Email fetch completed successfully ===');
  } catch (error) {
    logger.error('=== Email fetch failed ===', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

// Run the script
main();
