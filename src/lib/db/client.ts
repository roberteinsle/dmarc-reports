/**
 * Database Client
 * Better SQLite3 database connection and utilities
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type {
  DmarcReport,
  DmarcRecord,
  AiAnalysis,
  Notification,
  ProcessingLog,
} from './schema';

// Singleton database instance
let db: Database.Database | null = null;

/**
 * Get or create database connection
 */
export function getDatabase(): Database.Database {
  if (db) {
    return db;
  }

  const dbPath = process.env.DATABASE_PATH || './data/dmarc.db';
  const dbDir = path.dirname(dbPath);

  // Ensure data directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  });

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Performance optimizations
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  return db;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * DMARC Reports Operations
 */

export function insertDmarcReport(report: Omit<DmarcReport, 'id' | 'created_at' | 'processed'>): number {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO dmarc_reports (
      report_id, org_name, email, date_begin, date_end, domain, policy_published, raw_xml
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    report.report_id,
    report.org_name,
    report.email,
    report.date_begin,
    report.date_end,
    report.domain,
    report.policy_published,
    report.raw_xml
  );

  return info.lastInsertRowid as number;
}

export function getDmarcReport(id: number): DmarcReport | undefined {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM dmarc_reports WHERE id = ?');
  return stmt.get(id) as DmarcReport | undefined;
}

export function getDmarcReportByReportId(reportId: string): DmarcReport | undefined {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM dmarc_reports WHERE report_id = ?');
  return stmt.get(reportId) as DmarcReport | undefined;
}

export function getUnprocessedReports(): DmarcReport[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM dmarc_reports WHERE processed = 0 ORDER BY created_at ASC');
  return stmt.all() as DmarcReport[];
}

export function markReportProcessed(id: number): void {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE dmarc_reports SET processed = 1 WHERE id = ?');
  stmt.run(id);
}

/**
 * DMARC Records Operations
 */

export function insertDmarcRecord(record: Omit<DmarcRecord, 'id' | 'created_at'>): number {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO dmarc_records (
      report_id, source_ip, count, disposition, dkim, spf, header_from,
      envelope_from, dkim_domain, dkim_selector, spf_domain, country
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    record.report_id,
    record.source_ip,
    record.count,
    record.disposition,
    record.dkim,
    record.spf,
    record.header_from,
    record.envelope_from,
    record.dkim_domain,
    record.dkim_selector,
    record.spf_domain,
    record.country
  );

  return info.lastInsertRowid as number;
}

export function getDmarcRecordsByReportId(reportId: number): DmarcRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM dmarc_records WHERE report_id = ? ORDER BY count DESC');
  return stmt.all(reportId) as DmarcRecord[];
}

/**
 * AI Analysis Operations
 */

export function insertAiAnalysis(analysis: Omit<AiAnalysis, 'id' | 'analyzed_at'>): number {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO ai_analysis (
      report_id, compliance_status, compliance_score, threats_detected,
      threat_level, trends, recommendations, summary, model_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    analysis.report_id,
    analysis.compliance_status,
    analysis.compliance_score,
    analysis.threats_detected,
    analysis.threat_level,
    analysis.trends,
    analysis.recommendations,
    analysis.summary,
    analysis.model_version
  );

  return info.lastInsertRowid as number;
}

export function getAiAnalysisByReportId(reportId: number): AiAnalysis | undefined {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM ai_analysis WHERE report_id = ?');
  return stmt.get(reportId) as AiAnalysis | undefined;
}

export function getRecentCriticalAnalysis(limit: number = 10): AiAnalysis[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM ai_analysis
    WHERE threat_level IN ('HIGH', 'CRITICAL')
    ORDER BY analyzed_at DESC
    LIMIT ?
  `);
  return stmt.all(limit) as AiAnalysis[];
}

/**
 * Notifications Operations
 */

export function insertNotification(notification: Omit<Notification, 'id' | 'sent_at'>): number {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO notifications (
      analysis_id, threat_level, postal_message_id, status, error_message
    ) VALUES (?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    notification.analysis_id,
    notification.threat_level,
    notification.postal_message_id,
    notification.status,
    notification.error_message
  );

  return info.lastInsertRowid as number;
}

export function getNotificationByAnalysisId(analysisId: number): Notification | undefined {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM notifications WHERE analysis_id = ?');
  return stmt.get(analysisId) as Notification | undefined;
}

/**
 * Processing Log Operations
 */

export function insertProcessingLog(log: Omit<ProcessingLog, 'id' | 'processed_at'>): number {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO processing_log (
      email_uid, subject, from_address, attachment_count, status, error_message
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    log.email_uid,
    log.subject,
    log.from_address,
    log.attachment_count,
    log.status,
    log.error_message
  );

  return info.lastInsertRowid as number;
}

export function getRecentProcessingLogs(limit: number = 50): ProcessingLog[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM processing_log ORDER BY processed_at DESC LIMIT ?');
  return stmt.all(limit) as ProcessingLog[];
}
