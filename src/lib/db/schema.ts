/**
 * Database Schema Definitions
 * SQLite database schema for DMARC Reports application
 */

export interface DmarcReport {
  id: number;
  report_id: string;
  org_name: string;
  email: string;
  date_begin: number;
  date_end: number;
  domain: string;
  policy_published: string; // JSON string
  raw_xml: string;
  created_at: string;
  processed: number; // SQLite uses 0/1 for boolean
}

export interface DmarcRecord {
  id: number;
  report_id: number;
  source_ip: string;
  count: number;
  disposition: string;
  dkim: string;
  spf: string;
  header_from: string;
  envelope_from: string | null;
  dkim_domain: string | null;
  dkim_selector: string | null;
  spf_domain: string | null;
  country: string | null;
  created_at: string;
}

export interface AiAnalysis {
  id: number;
  report_id: number;
  compliance_status: string;
  compliance_score: number;
  threats_detected: string; // JSON string
  threat_level: string;
  trends: string; // JSON string
  recommendations: string; // JSON string
  summary: string;
  analyzed_at: string;
  model_version: string;
}

export interface Notification {
  id: number;
  analysis_id: number;
  threat_level: string;
  sent_at: string;
  postal_message_id: string | null;
  status: string;
  error_message: string | null;
}

export interface ProcessingLog {
  id: number;
  email_uid: string;
  subject: string;
  from_address: string;
  attachment_count: number;
  status: string;
  error_message: string | null;
  processed_at: string;
}

/**
 * SQL schema creation statements
 */
export const SQL_SCHEMA = {
  dmarc_reports: `
    CREATE TABLE IF NOT EXISTS dmarc_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT UNIQUE NOT NULL,
      org_name TEXT NOT NULL,
      email TEXT NOT NULL,
      date_begin INTEGER NOT NULL,
      date_end INTEGER NOT NULL,
      domain TEXT NOT NULL,
      policy_published TEXT NOT NULL,
      raw_xml TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      processed INTEGER DEFAULT 0
    )`,

  dmarc_reports_indexes: [
    'CREATE INDEX IF NOT EXISTS idx_dmarc_reports_domain ON dmarc_reports(domain)',
    'CREATE INDEX IF NOT EXISTS idx_dmarc_reports_date_range ON dmarc_reports(date_begin, date_end)',
    'CREATE INDEX IF NOT EXISTS idx_dmarc_reports_processed ON dmarc_reports(processed)',
  ],

  dmarc_records: `
    CREATE TABLE IF NOT EXISTS dmarc_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      source_ip TEXT NOT NULL,
      count INTEGER NOT NULL,
      disposition TEXT NOT NULL,
      dkim TEXT NOT NULL,
      spf TEXT NOT NULL,
      header_from TEXT NOT NULL,
      envelope_from TEXT,
      dkim_domain TEXT,
      dkim_selector TEXT,
      spf_domain TEXT,
      country TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (report_id) REFERENCES dmarc_reports(id) ON DELETE CASCADE
    )`,

  dmarc_records_indexes: [
    'CREATE INDEX IF NOT EXISTS idx_dmarc_records_report ON dmarc_records(report_id)',
    'CREATE INDEX IF NOT EXISTS idx_dmarc_records_ip ON dmarc_records(source_ip)',
    'CREATE INDEX IF NOT EXISTS idx_dmarc_records_disposition ON dmarc_records(disposition)',
  ],

  ai_analysis: `
    CREATE TABLE IF NOT EXISTS ai_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER UNIQUE NOT NULL,
      compliance_status TEXT NOT NULL,
      compliance_score INTEGER NOT NULL,
      threats_detected TEXT NOT NULL,
      threat_level TEXT NOT NULL,
      trends TEXT NOT NULL,
      recommendations TEXT NOT NULL,
      summary TEXT NOT NULL,
      analyzed_at TEXT DEFAULT (datetime('now')),
      model_version TEXT NOT NULL,
      FOREIGN KEY (report_id) REFERENCES dmarc_reports(id) ON DELETE CASCADE
    )`,

  ai_analysis_indexes: [
    'CREATE INDEX IF NOT EXISTS idx_ai_analysis_threat_level ON ai_analysis(threat_level)',
    'CREATE INDEX IF NOT EXISTS idx_ai_analysis_date ON ai_analysis(analyzed_at)',
  ],

  notifications: `
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_id INTEGER NOT NULL,
      threat_level TEXT NOT NULL,
      sent_at TEXT DEFAULT (datetime('now')),
      postal_message_id TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      FOREIGN KEY (analysis_id) REFERENCES ai_analysis(id) ON DELETE CASCADE
    )`,

  notifications_indexes: [
    'CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_date ON notifications(sent_at)',
  ],

  processing_log: `
    CREATE TABLE IF NOT EXISTS processing_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_uid TEXT NOT NULL,
      subject TEXT NOT NULL,
      from_address TEXT NOT NULL,
      attachment_count INTEGER NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      processed_at TEXT DEFAULT (datetime('now'))
    )`,

  processing_log_indexes: [
    'CREATE INDEX IF NOT EXISTS idx_processing_log_status ON processing_log(status)',
    'CREATE INDEX IF NOT EXISTS idx_processing_log_date ON processing_log(processed_at)',
  ],
};
