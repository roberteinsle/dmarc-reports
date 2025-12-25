import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const threatLevel = searchParams.get('threat_level');

    const db = getDatabase();

    let query = `
      SELECT
        a.*,
        r.domain,
        r.org_name,
        r.date_begin,
        r.date_end
      FROM ai_analysis a
      JOIN dmarc_reports r ON a.report_id = r.id
    `;

    const params: any[] = [];

    if (threatLevel) {
      const levels = threatLevel.split(',');
      const placeholders = levels.map(() => '?').join(',');
      query += ` WHERE a.threat_level IN (${placeholders})`;
      params.push(...levels);
    }

    query += ` ORDER BY a.analyzed_at DESC LIMIT ?`;
    params.push(limit);

    const analyses = db.prepare(query).all(...params);

    return NextResponse.json({
      analyses: analyses.map((a: any) => ({
        ...a,
        threats_detected: JSON.parse(a.threats_detected),
        recommendations: JSON.parse(a.recommendations),
        trends: JSON.parse(a.trends),
      })),
    });
  } catch (error) {
    console.error('Error fetching analyses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analyses' },
      { status: 500 }
    );
  }
}
