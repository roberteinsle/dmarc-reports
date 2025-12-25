/**
 * Scheduler Service
 * Runs automated DMARC processing pipeline at regular intervals
 */

import cron from 'node-cron';
import { fetchAndProcessEmails } from './email-fetcher';
import { analyzeUnprocessedReports } from './claude-analyzer';
import { logger } from '../utils/logger';

let cronJob: cron.ScheduledTask | null = null;
let isRunning = false;
let lastRunTime: Date | null = null;
let lastRunStatus: 'success' | 'error' | null = null;
let lastRunError: string | null = null;

/**
 * Run the complete DMARC processing pipeline
 */
async function runPipeline(): Promise<void> {
  if (isRunning) {
    logger.warn('Pipeline already running, skipping this execution');
    return;
  }

  isRunning = true;
  const startTime = new Date();
  logger.info('=== Starting Automated DMARC Pipeline ===');

  try {
    // Step 1: Fetch emails
    logger.info('Step 1: Fetching emails from IMAP...');
    await fetchAndProcessEmails();

    // Step 2: Analyze reports
    logger.info('Step 2: Analyzing reports with Claude AI...');
    const analyzedCount = await analyzeUnprocessedReports();

    const duration = Date.now() - startTime.getTime();
    logger.info(`=== Pipeline completed successfully in ${duration}ms. Analyzed ${analyzedCount} reports ===`);

    lastRunTime = startTime;
    lastRunStatus = 'success';
    lastRunError = null;
  } catch (error) {
    const duration = Date.now() - startTime.getTime();
    logger.error(`=== Pipeline failed after ${duration}ms ===`, error);

    lastRunTime = startTime;
    lastRunStatus = 'error';
    lastRunError = error instanceof Error ? error.message : String(error);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the scheduler
 */
export function startScheduler(): void {
  const schedule = process.env.CRON_SCHEDULE || '*/10 * * * *';

  if (cronJob) {
    logger.warn('Scheduler already running');
    return;
  }

  logger.info(`Starting scheduler with cron: ${schedule}`);

  // Validate cron expression
  if (!cron.validate(schedule)) {
    throw new Error(`Invalid cron expression: ${schedule}`);
  }

  cronJob = cron.schedule(schedule, () => {
    runPipeline();
  });

  logger.info('Scheduler started successfully');

  // Run once immediately on startup
  logger.info('Running initial pipeline execution...');
  runPipeline();
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    logger.info('Scheduler stopped');
  } else {
    logger.warn('Scheduler not running');
  }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
  return {
    running: cronJob !== null,
    isCurrentlyProcessing: isRunning,
    schedule: process.env.CRON_SCHEDULE || '*/10 * * * *',
    lastRunTime: lastRunTime?.toISOString() || null,
    lastRunStatus,
    lastRunError,
  };
}

/**
 * Manually trigger pipeline execution
 */
export async function triggerManualRun(): Promise<void> {
  logger.info('Manual pipeline trigger requested');
  await runPipeline();
}
