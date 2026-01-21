import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Calendar, Loader2, BarChart2 } from 'lucide-react';
import { formatPercent } from '../utils/formatters';

const formatPercentValue = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
        <p className="text-white font-semibold text-sm mb-2">
          {new Date(label).toLocaleDateString('es-AR', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })}
        </p>
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-1">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-400 text-xs">{entry.name}:</span>
            <span 
              className={`text-sm font-mono font-semibold ${
                entry.value >= 0 ? 'text-success' : 'text-danger'
              }`}
            >
              {formatPercentValue(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function PortfolioEvolutionChart({ trades }) {
  const [selectedDays, setSelectedDays] = useState(90);
  const [spyData, setSpyData] = useState([]);
  const [loading, setLoading] = useState(false);

  const portfolioHistory = useMemo(() => {
    if (!trades || trades.length === 0) return [];

    const sortedTrades = [...trades].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const firstDate = new Date(sortedTrades[0].fecha);
    const today = new Date();
    
    const days = [];
    for (let d = new Date(firstDate); d <= today; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d).toISOString().split('T')[0]);
    }

    const portfolioByDate = {};
    sortedTrades.forEach(trade => {
      const tradeDate = trade.fecha;
      if (!portfolioByDate[tradeDate]) {
        portfolioByDate[tradeDate] = { cantidad: 0, costoTotal: 0 };
      }
      portfolioByDate[tradeDate].cantidad += trade.cantidad;
      portfolioByDate[tradeDate].costoTotal += trade.cantidad * trade.precioCompra;
    });

    let totalCantidad = 0;
    let totalCosto = 0;

    return days.map(date => {
      if (portfolioByDate[date]) {
        totalCantidad += portfolioByDate[date].cantidad;
        totalCosto += portfolioByDate[date].costoTotal;
      }
      
      const avgPrice = totalCantidad > 0 ? totalCosto / totalCantidad : 0;
      
      return {
        date,
        avgPrice,
        totalCantidad,
        totalCosto
      };
    });
  }, [trades]);

  useEffect(() => {
    if (selectedDays < 30) return;

    async function fetchSpyData() {
      setLoading(true);
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - selectedDays);
        
        const response = await fetch(
          `https://data912.com/historical/stocks/SPY?from=${startDate.toISOString().split('T')[0]}&to=${endDate.toISOString().split('T')[0]}`
        );
        
        if (response.ok) {
          const data = await response.json();
          const spyPrices = {};
          data.forEach(item => {
            spyPrices[item.date] = item.close || item.c || item.price;
          });
          setSpyData(spyPrices);
        }
      } catch (e) {
        console.warn('Could not fetch SPY data:', e);
      } finally {
        setLoading(false);
      }
    }

    fetchSpyData();
  }, [selectedDays]);

  const chartData = useMemo(() => {
    if (!portfolioHistory.length) return [];

    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - selectedDays);

    const filteredHistory = portfolioHistory.filter(d => new Date(d.date) >= cutoffDate);
    
    if (filteredHistory.length === 0) return [];

    const firstPrice = filteredHistory[0].avgPrice || 1;

    return filteredHistory.map(day => {
      const spyPrice = spyData[day.date];
      const spyChange = spyPrice ? ((spyPrice - spyData[Object.keys(spyData)[0]]) / spyData[Object.keys(spyData)[0]]) * 100 : null;
      
      return {
        ...day,
        displayDate: new Date(day.date).toLocaleDateString('es-AR', {
          month: 'short',
          day: 'numeric'
        }),
        portfolioChange: firstPrice > 0 ? ((day.avgPrice - firstPrice) / firstPrice) * 100 : 0,
        spyChange
      };
    });
  }, [portfolioHistory, selectedDays, spyData]);

  const stats = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    
    const firstChange = chartData[0]?.portfolioChange || 0;
    const lastChange = chartData[chartData.length - 1]?.portfolioChange || 0;
    const maxChange = Math.max(...chartData.map(d => d.portfolioChange));
    const minChange = Math.min(...chartData.map(d => d.portfolioChange));
    
    return {
      firstChange,
      lastChange,
      maxChange,
      minChange,
      days: chartData.length
    };
  }, [chartData]);

  if (!trades || trades.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-custom p-5 border border-slate-700/50">
        <p className="text-slate-400 text-center">Agregá trades para ver la evolución</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-custom p-5 border border-slate-700/50 shadow-xl backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/20 rounded">
            <BarChart2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Evolución vs SPY</h3>
            <p className="text-xs text-slate-500">Retorno porcentual</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-3 h-3 text-slate-400" />
          <div className="flex gap-1">
            {[30, 60, 90, 180, 365].map(days => (
              <button
                key={days}
                onClick={() => setSelectedDays(days)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                  selectedDays === days
                    ? 'bg-primary text-white'
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600 hover:text-white'
                }`}
              >
                {days === 365 ? '1A' : `${days}d`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && chartData.length === 0 ? (
        <div className="flex justify-center items-center h-48">
          <div className="text-center">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
            <p className="text-slate-400 text-xs">Cargando benchmark...</p>
          </div>
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex justify-center items-center h-48">
          <p className="text-slate-500 text-sm">No hay datos disponibles</p>
        </div>
      ) : (
        <>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  stroke="#475569"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  stroke="#475569"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`}
                  domain={['auto', 'auto']}
                  width={45}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ paddingTop: 10 }}
                  formatter={(value) => <span className="text-xs text-slate-400">{value}</span>}
                />
                <Line
                  type="monotone"
                  dataKey="portfolioChange"
                  name="Portfolio"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
                />
                {chartData.some(d => d.spyChange !== null) && (
                  <Line
                    type="monotone"
                    dataKey="spyChange"
                    name="SPY (Benchmark)"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={{ r: 4, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }}
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {stats && (
            <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-slate-700/50">
              <div className="text-center">
                <p className="text-xs text-slate-500">Portfolio</p>
                <p className={`text-sm font-mono font-semibold ${stats.lastChange >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatPercentValue(stats.lastChange)}
                </p>
              </div>
              <div className="w-px h-8 bg-slate-700" />
              <div className="text-center">
                <p className="text-xs text-slate-500">SPY</p>
                <p className="text-sm font-mono font-semibold text-blue-400">
                  {chartData.some(d => d.spyChange !== null) 
                    ? formatPercentValue(chartData[chartData.length - 1]?.spyChange || 0)
                    : '-'
                  }
                </p>
              </div>
              <div className="w-px h-8 bg-slate-700" />
              <div className="text-center">
                <p className="text-xs text-slate-500">Diferencia</p>
                <p className={`text-sm font-mono font-semibold ${
                  (stats.lastChange - (chartData[chartData.length - 1]?.spyChange || 0)) >= 0 ? 'text-success' : 'text-danger'
                }`}>
                  {formatPercentValue(stats.lastChange - (chartData[chartData.length - 1]?.spyChange || 0))}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
