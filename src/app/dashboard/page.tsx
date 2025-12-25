'use client';

import { useEffect, useState } from 'react';
import { KPICard } from '@/components/dashboard/KPICard';
import { ThreatAlerts } from '@/components/dashboard/ThreatAlerts';
import { RecommendationsList } from '@/components/dashboard/RecommendationsList';
import { ThreatDistribution } from '@/components/dashboard/ThreatDistribution';

interface KPIData {
  total_messages: number;
  total_reports: number;
  compliance_rate: number;
  threats: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  top_threat_sources: Array<{
    source_ip: string;
    total: number;
    country: string | null;
  }>;
  critical_alerts: Array<any>;
}

export default function DashboardPage() {
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    async function fetchKPIs() {
      try {
        setLoading(true);
        const response = await fetch(`/api/kpis?period=${period}`);
        if (!response.ok) throw new Error('Failed to fetch KPIs');
        const data = await response.json();
        setKpiData(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchKPIs();
  }, [period]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">DMARC Reports Dashboard</h1>
          <div className="text-gray-600">Lade Daten...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">DMARC Reports Dashboard</h1>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">Fehler beim Laden: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!kpiData) {
    return null;
  }

  // Collect all recommendations from critical alerts
  const allRecommendations = kpiData.critical_alerts.flatMap(
    (alert) => alert.recommendations || []
  );
  const uniqueRecommendations = Array.from(new Set(allRecommendations)).slice(0, 5);

  const complianceVariant =
    kpiData.compliance_rate >= 95 ? 'success' :
    kpiData.compliance_rate >= 80 ? 'warning' : 'danger';

  const threatTotal = kpiData.threats.low + kpiData.threats.medium +
                      kpiData.threats.high + kpiData.threats.critical;
  const threatVariant =
    kpiData.threats.critical > 0 ? 'danger' :
    kpiData.threats.high > 0 ? 'warning' : 'success';

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">DMARC Reports Dashboard</h1>
          <div className="flex gap-2">
            {['7d', '30d', '90d'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  period === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {p === '7d' ? '7 Tage' : p === '30d' ? '30 Tage' : '90 Tage'}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KPICard
            title="Gesamt-Nachrichten"
            value={kpiData.total_messages.toLocaleString('de-DE')}
            subtitle={`${kpiData.total_reports} Reports`}
          />
          <KPICard
            title="Compliance-Rate"
            value={`${kpiData.compliance_rate.toFixed(1)}%`}
            variant={complianceVariant}
            subtitle="DKIM & SPF Pass"
          />
          <KPICard
            title="Bedrohungen"
            value={threatTotal}
            variant={threatVariant}
            subtitle={`${kpiData.threats.critical} Kritisch`}
          />
          <KPICard
            title="Bedrohungsquellen"
            value={kpiData.top_threat_sources.length}
            subtitle="Verdächtige IPs"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Threat Distribution */}
          <div className="lg:col-span-1">
            <ThreatDistribution threats={kpiData.threats} />
          </div>

          {/* Critical Alerts */}
          <div className="lg:col-span-2">
            <ThreatAlerts alerts={kpiData.critical_alerts} />
          </div>
        </div>

        {/* Recommendations */}
        {uniqueRecommendations.length > 0 && (
          <div className="mb-8">
            <RecommendationsList recommendations={uniqueRecommendations} />
          </div>
        )}

        {/* Top Threat Sources */}
        {kpiData.top_threat_sources.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Top Bedrohungsquellen
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP-Adresse
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Anzahl
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Land
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {kpiData.top_threat_sources.map((source, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono text-gray-900">
                        {source.source_ip}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {source.total.toLocaleString('de-DE')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {source.country || 'Unbekannt'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
