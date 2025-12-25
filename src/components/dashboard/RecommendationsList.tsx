interface RecommendationsListProps {
  recommendations: string[];
  domain?: string;
}

export function RecommendationsList({ recommendations, domain }: RecommendationsListProps) {
  if (recommendations.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Empfehlungen</h2>
        <p className="text-sm text-gray-500">Keine Empfehlungen verfügbar.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Empfehlungen{domain && ` für ${domain}`}
      </h2>
      <ul className="space-y-3">
        {recommendations.map((rec, idx) => (
          <li key={idx} className="flex items-start">
            <span className="mr-3 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-800">
              {idx + 1}
            </span>
            <span className="text-sm text-gray-700">{rec}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
