import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/client';
import { getSchedulerStatus } from '@/lib/services/scheduler';

export async function GET() {
  try {
    const db = getDatabase();

    // Get database stats
    const totalReports = db.prepare('SELECT COUNT(*) as count FROM dmarc_reports').get() as { count: number };
    const unprocessedReports = db.prepare('SELECT COUNT(*) as count FROM dmarc_reports WHERE processed = 0').get() as { count: number };
    const totalAnalyses = db.prepare('SELECT COUNT(*) as count FROM ai_analysis').get() as { count: number };

    // Get most recent processing log
    const lastProcessing = db.prepare(`
      SELECT processed_at, status
      FROM processing_log
      ORDER BY processed_at DESC
      LIMIT 1
    `).get() as { processed_at: string; status: string } | undefined;

    // Get scheduler status
    const schedulerStatus = getSchedulerStatus();

    // Get database file size
    const dbPath = process.env.DATABASE_PATH || './data/dmarc.db';
    let dbSize = 0;
    try {
      const fs = require('fs');
      const stats = fs.statSync(dbPath);
      dbSize = stats.size;
    } catch (err) {
      // Database file might not exist yet
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        total_reports: totalReports.count,
        unprocessed_reports: unprocessedReports.count,
        total_analyses: totalAnalyses.count,
        size_bytes: dbSize,
        size_mb: (dbSize / 1024 / 1024).toFixed(2),
      },
      last_processing: lastProcessing || null,
      scheduler: schedulerStatus,
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
