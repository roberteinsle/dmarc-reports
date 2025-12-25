import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '30d';

    const db = getDatabase();

    // Calculate date range
    const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    // Total messages
    const totalMessages = db.prepare(`
      SELECT SUM(count) as total
      FROM dmarc_records dr
      JOIN dmarc_reports r ON dr.report_id = r.id
      WHERE r.date_begin >= ?
    `).get(startTimestamp) as { total: number | null };

    // Compliance rate
    const compliance = db.prepare(`
      SELECT
        SUM(CASE WHEN dkim = 'pass' AND spf = 'pass' THEN count ELSE 0 END) as passed,
        SUM(count) as total
      FROM dmarc_records dr
      JOIN dmarc_reports r ON dr.report_id = r.id
      WHERE r.date_begin >= ?
    `).get(startTimestamp) as { passed: number; total: number };

    // Threat distribution
    const threats = db.prepare(`
      SELECT threat_level, COUNT(*) as count
      FROM ai_analysis
      WHERE analyzed_at >= datetime(?, 'unixepoch')
      GROUP BY threat_level
    `).all(startTimestamp) as Array<{ threat_level: string; count: number }>;

    // Top threat sources
    const topSources = db.prepare(`
      SELECT source_ip, SUM(count) as total, country
      FROM dmarc_records dr
      JOIN dmarc_reports r ON dr.report_id = r.id
      WHERE r.date_begin >= ? AND (dkim = 'fail' OR spf = 'fail')
      GROUP BY source_ip
      ORDER BY total DESC
      LIMIT 10
    `).all(startTimestamp) as Array<{ source_ip: string; total: number; country: string | null }>;

    // Recent critical alerts
    const criticalAlerts = db.prepare(`
      SELECT a.*, r.domain, r.org_name, r.date_begin, r.date_end
      FROM ai_analysis a
      JOIN dmarc_reports r ON a.report_id = r.id
      WHERE a.threat_level IN ('HIGH', 'CRITICAL')
      ORDER BY a.analyzed_at DESC
      LIMIT 5
    `).all() as Array<any>;

    // Total reports
    const totalReports = db.prepare(`
      SELECT COUNT(*) as count
      FROM dmarc_reports
      WHERE date_begin >= ?
    `).get(startTimestamp) as { count: number };

    const complianceRate = compliance.total > 0
      ? ((compliance.passed / compliance.total) * 100).toFixed(2)
      : '0.00';

    return NextResponse.json({
      total_messages: totalMessages.total || 0,
      total_reports: totalReports.count || 0,
      compliance_rate: parseFloat(complianceRate),
      threats: {
        low: threats.find(t => t.threat_level === 'LOW')?.count || 0,
        medium: threats.find(t => t.threat_level === 'MEDIUM')?.count || 0,
        high: threats.find(t => t.threat_level === 'HIGH')?.count || 0,
        critical: threats.find(t => t.threat_level === 'CRITICAL')?.count || 0,
      },
      top_threat_sources: topSources,
      critical_alerts: criticalAlerts.map(a => ({
        ...a,
        threats_detected: JSON.parse(a.threats_detected),
        recommendations: JSON.parse(a.recommendations),
        trends: JSON.parse(a.trends),
      })),
    });
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KPIs' },
      { status: 500 }
    );
  }
}
