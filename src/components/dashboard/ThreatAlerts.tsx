interface Threat {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  source_ips: string[];
}

interface ThreatAlertsProps {
  alerts: Array<{
    id: number;
    domain: string;
    org_name: string;
    threat_level: string;
    threats_detected: Threat[];
    analyzed_at: string;
  }>;
}

export function ThreatAlerts({ alerts }: ThreatAlertsProps) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Kritische Bedrohungen</h2>
        <p className="text-sm text-gray-500">Keine kritischen Bedrohungen gefunden.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Kritische Bedrohungen</h2>
      <div className="space-y-4">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`rounded-lg border p-4 ${
              alert.threat_level === 'CRITICAL'
                ? 'border-red-300 bg-red-50'
                : 'border-orange-300 bg-orange-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      alert.threat_level === 'CRITICAL'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}
                  >
                    {alert.threat_level}
                  </span>
                  <span className="text-sm font-medium text-gray-900">{alert.domain}</span>
                </div>
                <p className="mt-1 text-xs text-gray-600">{alert.org_name}</p>
              </div>
              <span className="text-xs text-gray-500">
                {new Date(alert.analyzed_at).toLocaleDateString('de-DE')}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {alert.threats_detected.slice(0, 2).map((threat, idx) => (
                <div key={idx} className="text-sm">
                  <span className="font-medium text-gray-900">{threat.type}:</span>{' '}
                  <span className="text-gray-700">{threat.description}</span>
                </div>
              ))}
              {alert.threats_detected.length > 2 && (
                <p className="text-xs text-gray-500">
                  +{alert.threats_detected.length - 2} weitere Bedrohungen
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
