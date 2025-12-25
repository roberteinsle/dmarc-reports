#!/usr/bin/env tsx

/**
 * Database Initialization Script
 * Creates all tables and indexes for the DMARC Reports application
 */

import 'dotenv/config';
import { getDatabase, closeDatabase } from '../lib/db/client';
import { SQL_SCHEMA } from '../lib/db/schema';

function initializeDatabase() {
  console.log('Initializing DMARC Reports database...');

  const db = getDatabase();

  try {
    // Create tables
    console.log('Creating tables...');

    db.exec(SQL_SCHEMA.dmarc_reports);
    SQL_SCHEMA.dmarc_reports_indexes.forEach(index => db.exec(index));
    console.log('✓ dmarc_reports table created');

    db.exec(SQL_SCHEMA.dmarc_records);
    SQL_SCHEMA.dmarc_records_indexes.forEach(index => db.exec(index));
    console.log('✓ dmarc_records table created');

    db.exec(SQL_SCHEMA.ai_analysis);
    SQL_SCHEMA.ai_analysis_indexes.forEach(index => db.exec(index));
    console.log('✓ ai_analysis table created');

    db.exec(SQL_SCHEMA.notifications);
    SQL_SCHEMA.notifications_indexes.forEach(index => db.exec(index));
    console.log('✓ notifications table created');

    db.exec(SQL_SCHEMA.processing_log);
    SQL_SCHEMA.processing_log_indexes.forEach(index => db.exec(index));
    console.log('✓ processing_log table created');

    console.log('\nDatabase initialized successfully!');
    console.log(`Database location: ${process.env.DATABASE_PATH || './data/dmarc.db'}`);

  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

// Run initialization
initializeDatabase();
