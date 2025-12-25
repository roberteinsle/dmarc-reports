import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const domain = searchParams.get('domain');

    const db = getDatabase();

    let query = `
      SELECT
        r.*,
        COUNT(dr.id) as record_count,
        a.threat_level,
        a.compliance_status
      FROM dmarc_reports r
      LEFT JOIN dmarc_records dr ON dr.report_id = r.id
      LEFT JOIN ai_analysis a ON a.report_id = r.id
    `;

    const params: any[] = [];

    if (domain) {
      query += ' WHERE r.domain = ?';
      params.push(domain);
    }

    query += `
      GROUP BY r.id
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    const reports = db.prepare(query).all(...params);

    return NextResponse.json({
      reports: reports.map((r: any) => ({
        ...r,
        policy_published: JSON.parse(r.policy_published),
      })),
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
