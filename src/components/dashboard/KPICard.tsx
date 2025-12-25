interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export function KPICard({ title, value, subtitle, trend, variant = 'default' }: KPICardProps) {
  const variantStyles = {
    default: 'bg-white border-gray-200',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    danger: 'bg-red-50 border-red-200',
  };

  const valueStyles = {
    default: 'text-gray-900',
    success: 'text-green-900',
    warning: 'text-yellow-900',
    danger: 'text-red-900',
  };

  return (
    <div className={`rounded-lg border p-6 ${variantStyles[variant]}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        {trend && (
          <span className={`text-xs ${
            trend === 'up' ? 'text-green-600' :
            trend === 'down' ? 'text-red-600' :
            'text-gray-600'
          }`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
      <div className={`mt-2 text-3xl font-bold ${valueStyles[variant]}`}>
        {value}
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
      )}
    </div>
  );
}
