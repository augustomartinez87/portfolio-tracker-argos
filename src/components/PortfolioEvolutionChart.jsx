import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Calendar, Loader2 } from 'lucide-react';
import { usePortfolioHistory } from '../hooks/usePortfolioHistory';

const formatCurrencyARS = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatCurrencyUSD = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const CustomTooltip = ({ active, payload, label, currency }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-background-dark border border-slate-700 rounded-custom p-3 shadow-2xl">
        <p className="text-white font-semibold text-sm mb-2">
          {new Date(label).toLocaleDateString('es-AR', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })}
        </p>
        <p className="text-success font-semibold text-lg">
          {currency === 'USD' ? formatCurrencyUSD(data.value) : formatCurrencyARS(data.value)}
        </p>
        {data.change !== undefined && (
          <p className={`text-sm font-medium mt-1 ${data.change >= 0 ? 'text-success' : 'text-danger'}`}>
            {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)}% vs primer día
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function PortfolioEvolutionChart({ trades, currency = 'ARS' }) {
  const [selectedDays, setSelectedDays] = useState(90);
  const { data, loading, error } = usePortfolioHistory(trades, selectedDays);

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
    const firstValue = sortedData[0]?.valueARS || 1;

    return sortedData.map(day => ({
      ...day,
      fullDate: day.date,
      displayDate: new Date(day.date).toLocaleDateString('es-AR', {
        month: 'short',
        day: 'numeric'
      }),
      value: currency === 'USD' ? day.valueUSD : day.valueARS,
      change: firstValue > 0 ? ((day.valueARS - firstValue) / firstValue) * 100 : 0
    }));
  }, [data, currency]);

  const stats = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;

    const firstValue = chartData[0]?.value || 0;
    const lastValue = chartData[chartData.length - 1]?.value || 0;
    const high = Math.max(...chartData.map(d => d.value));
    const low = Math.min(...chartData.map(d => d.value));
    const change = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

    return {
      startValue: firstValue,
      endValue: lastValue,
      high,
      low,
      change
    };
  }, [chartData]);

  if (!trades || trades.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-custom p-5 border border-slate-700/50">
        <p className="text-slate-400 text-center">Agregá trades para ver la evolución de tu cartera</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-custom p-6 border border-slate-700/50 shadow-xl backdrop-blur-sm mb-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary/20 to-primary/10 rounded-custom border border-primary/30">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Evolución de la Cartera</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {chartData.length} días de seguimiento
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Período:
          </span>
          <div className="flex gap-1">
            {[30, 60, 90, 180, 365].map(days => (
              <button
                key={days}
                onClick={() => setSelectedDays(days)}
                className={`px-3 py-1 text-xs font-medium rounded-custom transition-all ${
                  selectedDays === days
                    ? 'bg-primary text-white shadow-lg shadow-primary/30'
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600 hover:text-white'
                }`}
              >
                {days === 365 ? '1A' : `${days}d`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-72">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Cargando datos históricos...</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-danger/10 border border-danger/30 rounded-custom p-4 text-danger text-center">
          Error al cargar datos: {error}
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex justify-center items-center h-72">
          <p className="text-slate-500">No hay datos históricos disponibles</p>
        </div>
      ) : (
        <>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  stroke="#475569"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={50}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  stroke="#475569"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => {
                    if (value >= 1000000) {
                      return `$${(value / 1000000).toFixed(1)}M`;
                    }
                    if (value >= 1000) {
                      return `$${(value / 1000).toFixed(0)}k`;
                    }
                    return `$${value}`;
                  }}
                  domain={['auto', 'auto']}
                  width={60}
                />
                <Tooltip
                  content={<CustomTooltip currency={currency} />}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                    padding: '12px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#portfolioGradient)"
                  dot={false}
                  activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <div className="bg-slate-900/50 rounded-custom p-4 border border-slate-700/50">
              <p className="text-slate-500 text-xs">Inicio</p>
              <p className="text-white font-mono font-semibold">
                {currency === 'USD' ? formatCurrencyUSD(stats?.startValue) : formatCurrencyARS(stats?.startValue)}
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-custom p-4 border border-slate-700/50">
              <p className="text-slate-500 text-xs">Actual</p>
              <p className="text-white font-mono font-semibold">
                {currency === 'USD' ? formatCurrencyUSD(stats?.endValue) : formatCurrencyARS(stats?.endValue)}
              </p>
            </div>
            <div className="bg-background-dark/50 rounded-custom p-4 border border-slate-700/50">
              <p className="text-slate-500 text-xs">Máximo</p>
              <p className="text-success font-mono font-semibold">
                {currency === 'USD' ? formatCurrencyUSD(stats?.high) : formatCurrencyARS(stats?.high)}
              </p>
            </div>
            <div className="bg-background-dark/50 rounded-custom p-4 border border-slate-700/50">
              <p className="text-slate-500 text-xs">Variación</p>
              <div className="flex items-center gap-1.5">
                {stats?.change >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-success" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-danger" />
                )}
                <p className={`font-mono font-semibold ${stats?.change >= 0 ? 'text-success' : 'text-danger'}`}>
                  {stats?.change >= 0 ? '+' : ''}{stats?.change?.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
