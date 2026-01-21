import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Calendar, Loader2, BarChart2, TrendingUp, TrendingDown } from 'lucide-react';

const formatPercentValue = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length && label) {
    const dateObj = new Date(label);
    if (isNaN(dateObj.getTime())) {
      return null;
    }
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
        <p className="text-white font-semibold text-sm mb-2">
          {dateObj.toLocaleDateString('es-AR', {
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

// Calcular valuación histórica de la cartera
const calculatePortfolioHistory = (trades, prices) => {
  if (!trades || !prices || trades.length === 0) return [];

  try {
    const sortedTrades = [...trades].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const firstDate = new Date(sortedTrades[0].fecha);
    const today = new Date();

    // Agrupar trades por fecha
    const tradesByDate = {};
    sortedTrades.forEach(trade => {
      if (!trade || !trade.fecha) return;
      const tradeDate = trade.fecha;
      if (!tradesByDate[tradeDate]) {
        tradesByDate[tradeDate] = {};
      }
      if (!tradesByDate[tradeDate][trade.ticker]) {
        tradesByDate[tradeDate][trade.ticker] = 0;
      }
      tradesByDate[tradeDate][trade.ticker] += trade.cantidad || 0;
    });

    // Calcular posiciones acumuladas por día
    const positionsByTicker = {};
    const history = [];

    for (let d = new Date(firstDate); d <= today; d.setDate(d.getDate() + 1)) {
      const date = d.toISOString().split('T')[0];

      // Aplicar trades de esta fecha
      if (tradesByDate[date]) {
        Object.entries(tradesByDate[date]).forEach(([ticker, cantidad]) => {
          if (!positionsByTicker[ticker]) {
            positionsByTicker[ticker] = 0;
          }
          positionsByTicker[ticker] += cantidad;
        });
      }

      // Calcular valuación usando precios actuales y pct_change diario
      let valuacion = 0;
      let flujoCapital = 0;

      Object.entries(positionsByTicker).forEach(([ticker, cantidad]) => {
        if (cantidad === 0) return;

        const priceData = prices[ticker];
        if (!priceData) return;

        // Usar precio actual como base
        const currentPrice = priceData.precio || 0;
        const pctChange = priceData.pctChange || 0;

        // Aproximación: precio en ese día usando pct_change
        // NOTA: Esta es una aproximación, no es perfecta
        // En producción se deberían usar precios históricos reales
        const priceInDay = currentPrice / (1 + pctChange / 100);

        const value = cantidad * priceInDay;
        valuacion += value;
      });

      history.push({
        date,
        valuacion
      });
    }

    console.log('Portfolio history:', {
      totalDays: history.length,
      firstDate: history[0]?.date,
      lastDate: history[history.length - 1]?.date,
      lastValue: history[history.length - 1]?.valuacion
    });

    return history;
  } catch (e) {
    console.error('Error calculating portfolio history:', e);
    return [];
  }
};

export default function PortfolioEvolutionChart({ trades, prices }) {
  const [selectedDays, setSelectedDays] = useState(90);
  const [showSpy, setShowSpy] = useState(true);
  const [spyData, setSpyData] = useState({});
  const [loading, setLoading] = useState(false);
  const [spyError, setSpyError] = useState(null);

  console.log('PortfolioEvolutionChart props:', {
    tradesCount: trades?.length,
    pricesKeys: Object.keys(prices || {}).length,
    samplePrices: Object.keys(prices || {}).slice(0, 5)
  });

  const portfolioHistory = useMemo(() => {
    const history = calculatePortfolioHistory(trades, prices);
    console.log('PortfolioHistory memo:', {
      length: history.length,
      first: history[0],
      last: history[history.length - 1]
    });
    return history;
  }, [trades, prices]);

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
        
        let data;
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          throw new Error('Invalid JSON response');
        }
        
        console.log('SPY data type:', typeof data, Array.isArray(data) ? '(array)' : '(object)');
        
        const spyPrices = {};
        
        if (Array.isArray(data)) {
          data.forEach(item => {
            if (item && item.date) {
              const cleanDate = item.date.split('T')[0];
              // El API devuelve: o, h, l, c, v, dr, sa (c es el cierre)
              spyPrices[cleanDate] = item.c || item.close || 0;
            }
          });
        } else if (data && typeof data === 'object') {
          Object.entries(data).forEach(([date, value]) => {
            if (date && value !== undefined && value !== null) {
              const cleanDate = date.split('T')[0];
              spyPrices[cleanDate] = Number(value) || 0;
            }
          });
        }
        
        console.log('SPY prices mapped:', Object.keys(spyPrices).length);
        if (Object.keys(spyPrices).length > 0) {
          const dates = Object.keys(spyPrices).sort();
          console.log('SPY date range:', dates[0], 'to', dates[dates.length - 1]);
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
    if (portfolioHistory.length === 0) return [];

    try {
      const now = new Date();
      const cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() - selectedDays);

      // Filtrar historial por fechas seleccionadas
      const filteredHistory = portfolioHistory.filter(d => new Date(d.date) >= cutoffDate);

      if (filteredHistory.length === 0) return [];

      const firstDayValue = filteredHistory[0]?.valuacion || 0;
      const firstSpyPrice = Object.keys(spyData).length > 0
        ? spyData[Object.keys(spyData).sort()[0]]
        : null;

      return filteredHistory.map(day => {
        const portfolioChange = firstDayValue > 0
          ? ((day.valuacion - firstDayValue) / firstDayValue) * 100
          : 0;

        const spyPrice = spyData[day.date];
        const spyChange = spyPrice && firstSpyPrice
          ? ((spyPrice - firstSpyPrice) / firstSpyPrice) * 100
          : null;

        return {
          date: day.date,
          displayDate: new Date(day.date).toLocaleDateString('es-AR', {
            month: 'short',
            day: 'numeric'
          }),
          portfolioChange,
          spyChange
        };
      });
    } catch (e) {
      console.error('Error building chart data:', e);
      return [];
    }
  }, [portfolioHistory, spyData, selectedDays]);

  const stats = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;

    try {
      const lastChange = chartData[chartData.length - 1];
      const portfolioReturnVal = lastChange?.portfolioChange || 0;
      const lastSpyChange = lastChange?.spyChange || 0;
      const diff = portfolioReturnVal - lastSpyChange;

      console.log('Stats calculated:', {
        portfolioReturn: portfolioReturnVal,
        spyReturn: lastSpyChange,
        diff,
        chartDataLength: chartData.length
      });

      return {
        portfolioReturn: portfolioReturnVal,
        spyReturn: lastSpyChange,
        diff
      };
    } catch (e) {
      console.error('Error calculating stats:', e);
      return null;
    }
  }, [chartData]);

  const comparisonMessage = useMemo(() => {
    if (!stats || !showSpy || Object.keys(spyData).length === 0) return null;
    
    const { diff } = stats;
    
    if (Math.abs(diff) < 0.01) return null;
    
    if (diff > 0) {
      return {
        text: `Estás beat al SPY por ${formatPercentValue(diff)}`,
        icon: TrendingUp,
        color: 'text-success',
        bg: 'bg-success/10 border-success/30'
      };
    } else {
      return {
        text: `Estás under al SPY por ${formatPercentValue(Math.abs(diff))}`,
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
            <h3 className="text-sm font-bold text-white">Retorno Cartera vs SPY</h3>
            <p className="text-xs text-slate-500">Desde el primer trade</p>
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

      {chartData.length === 0 ? (
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
                  <p className={`text-sm font-mono font-semibold ${stats.portfolioReturn >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatPercentValue(stats.portfolioReturn)}
                  </p>
                </div>
                <div className="w-px h-8 bg-slate-700" />
                <div className="text-center">
                  <p className="text-xs text-slate-500">SPY</p>
                  <p className="text-sm font-mono font-semibold text-blue-400">
                    {showSpy && chartData.some(d => d.spyChange !== null) 
                      ? formatPercentValue(stats.spyReturn)
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
