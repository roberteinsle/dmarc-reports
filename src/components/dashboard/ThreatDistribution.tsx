interface ThreatDistributionProps {
  threats: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

export function ThreatDistribution({ threats }: ThreatDistributionProps) {
  const total = threats.low + threats.medium + threats.high + threats.critical;

  const items = [
    { label: 'Niedrig', value: threats.low, color: 'bg-green-500', textColor: 'text-green-700' },
    { label: 'Mittel', value: threats.medium, color: 'bg-yellow-500', textColor: 'text-yellow-700' },
    { label: 'Hoch', value: threats.high, color: 'bg-orange-500', textColor: 'text-orange-700' },
    { label: 'Kritisch', value: threats.critical, color: 'bg-red-500', textColor: 'text-red-700' },
  ];

  if (total === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Bedrohungsverteilung</h2>
        <p className="text-sm text-gray-500">Keine Bedrohungen analysiert.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Bedrohungsverteilung</h2>
      <div className="space-y-4">
        {items.map((item) => {
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium ${item.textColor}`}>{item.label}</span>
                <span className="text-sm text-gray-600">{item.value}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`${item.color} h-2 rounded-full transition-all`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
