import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Calendar, Loader2, BarChart2, TrendingUp, TrendingDown } from 'lucide-react';

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
  const [showSpy, setShowSpy] = useState(true);
  const [spyData, setSpyData] = useState({});
  const [loading, setLoading] = useState(false);
  const [spyError, setSpyError] = useState(null);

  const portfolioHistory = useMemo(() => {
    if (!trades || !Array.isArray(trades) || trades.length === 0) return [];

    try {
      const sortedTrades = [...trades].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
      const firstDate = new Date(sortedTrades[0].fecha);
      const today = new Date();
      
      const days = [];
      for (let d = new Date(firstDate); d <= today; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d).toISOString().split('T')[0]);
      }

      const portfolioByDate = {};
      sortedTrades.forEach(trade => {
        if (!trade || !trade.fecha) return;
        const tradeDate = trade.fecha;
        if (!portfolioByDate[tradeDate]) {
          portfolioByDate[tradeDate] = { cantidad: 0, costoTotal: 0 };
        }
        portfolioByDate[tradeDate].cantidad += Number(trade.cantidad) || 0;
        portfolioByDate[tradeDate].costoTotal += (Number(trade.cantidad) || 0) * (Number(trade.precioCompra) || 0);
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
    } catch (e) {
      console.error('Error calculating portfolio history:', e);
      return [];
    }
  }, [trades]);

  useEffect(() => {
    if (!showSpy) {
      setSpyData({});
      return;
    }

    async function fetchSpyData() {
      setLoading(true);
      setSpyError(null);
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - selectedDays);
        
        const url = `https://data912.com/historical/cedears/SPY?from=${startDate.toISOString().split('T')[0]}&to=${endDate.toISOString().split('T')[0]}`;
        console.log('Fetching SPY:', url);
        
        const response = await fetch(url);
        console.log('SPY response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const text = await response.text();
        console.log('SPY response text (first 500 chars):', text.substring(0, 500));
        
        let data;
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          throw new Error('Invalid JSON response');
        }
        
        console.log('SPY parsed data type:', typeof data, Array.isArray(data) ? '(array)' : '');
        console.log('SPY data length:', data?.length);
        
        const spyPrices = {};
        
        if (Array.isArray(data)) {
          data.forEach(item => {
            if (item && item.date) {
              spyPrices[item.date] = item.close || item.c || item.price || item.px || 0;
            }
          });
        } else if (data && typeof data === 'object') {
          Object.entries(data).forEach(([date, value]) => {
            if (date && value) {
              spyPrices[date] = Number(value) || 0;
            }
          });
        }
        
        console.log('SPY prices mapped:', Object.keys(spyPrices).length);
        if (Object.keys(spyPrices).length > 0) {
          console.log('First SPY price date:', Object.keys(spyPrices)[0]);
        }
        
        setSpyData(spyPrices);
      } catch (e) {
        console.warn('Could not fetch SPY data:', e);
        setSpyError(e.message || 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    fetchSpyData();
  }, [selectedDays, showSpy]);

  const chartData = useMemo(() => {
    if (!portfolioHistory.length) return [];

    try {
      const now = new Date();
      const cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() - selectedDays);

      const filteredHistory = portfolioHistory.filter(d => new Date(d.date) >= cutoffDate);
      
      if (filteredHistory.length === 0) return [];

      const firstPrice = filteredHistory[0].avgPrice || 1;
      const spyKeys = Object.keys(spyData);
      const firstSpyPrice = spyKeys.length > 0 ? spyData[spyKeys[0]] : null;

      return filteredHistory.map(day => {
        const spyPrice = spyData[day.date];
        const spyChange = spyPrice && firstSpyPrice ? ((spyPrice - firstSpyPrice) / firstSpyPrice) * 100 : null;
        
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
    } catch (e) {
      console.error('Error building chart data:', e);
      return [];
    }
  }, [portfolioHistory, selectedDays, spyData]);

  const stats = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    
    try {
      const lastChange = chartData[chartData.length - 1]?.portfolioChange || 0;
      const lastSpyChange = chartData[chartData.length - 1]?.spyChange || 0;
      const diff = lastChange - lastSpyChange;
      
      return {
        lastChange,
        lastSpyChange,
        diff,
        days: chartData.length
      };
    } catch (e) {
      return null;
    }
  }, [chartData]);

  const comparisonMessage = useMemo(() => {
    if (!stats || !showSpy || Object.keys(spyData).length === 0) return null;
    
    const { diff, lastChange, lastSpyChange } = stats;
    
    if (lastSpyChange === 0 && diff === 0) return null;
    
    if (diff > 0) {
      return {
        text: `Estás beating al SPY por ${formatPercentValue(diff)}`,
        icon: TrendingUp,
        color: 'text-success',
        bg: 'bg-success/10 border-success/30'
      };
    } else {
      return {
        text: `Estás under contra SPY por ${formatPercentValue(Math.abs(diff))}`,
        icon: TrendingDown,
        color: 'text-danger',
        bg: 'bg-danger/10 border-danger/30'
      };
    }
  }, [stats, showSpy, spyData]);

  if (!trades || trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-custom border border-slate-700/50">
        <p className="text-slate-400 text-sm">Agregá trades para ver la evolución</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-custom p-5 border border-slate-700/50 shadow-xl backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/20 rounded">
            <BarChart2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Mi Cartera vs SPY</h3>
            <p className="text-xs text-slate-500">Retorno porcentual</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showSpy}
              onChange={(e) => setShowSpy(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-primary focus:ring-primary/50"
            />
            <span className="text-xs text-slate-400">Mostrar SPY</span>
          </label>
          
          <div className="flex items-center gap-1">
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
      </div>

      {loading && showSpy ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
            <p className="text-slate-400 text-xs">Cargando SPY...</p>
          </div>
        </div>
      ) : spyError && showSpy ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-500 text-sm">Error cargando SPY: {spyError}</p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-500 text-sm">No hay datos disponibles</p>
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-[200px]">
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
                  name="Cartera"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
                />
                {showSpy && chartData.some(d => d.spyChange !== null) && (
                  <Line
                    type="monotone"
                    dataKey="spyChange"
                    name="SPY"
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
            <div className="space-y-3 mt-3 pt-3 border-t border-slate-700/50 flex-shrink-0">
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <p className="text-xs text-slate-500">Cartera</p>
                  <p className={`text-sm font-mono font-semibold ${stats.lastChange >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatPercentValue(stats.lastChange)}
                  </p>
                </div>
                <div className="w-px h-8 bg-slate-700" />
                <div className="text-center">
                  <p className="text-xs text-slate-500">SPY</p>
                  <p className="text-sm font-mono font-semibold text-blue-400">
                    {showSpy && chartData.some(d => d.spyChange !== null) 
                      ? formatPercentValue(stats.lastSpyChange)
                      : '-'
                    }
                  </p>
                </div>
              </div>
              
              {comparisonMessage && (
                <div className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border ${comparisonMessage.bg}`}>
                  <comparisonMessage.icon className={`w-4 h-4 ${comparisonMessage.color}`} />
                  <span className={`text-sm font-medium ${comparisonMessage.color}`}>
                    {comparisonMessage.text}
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
