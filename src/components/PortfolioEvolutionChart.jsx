import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Calendar, Loader2, BarChart2, TrendingUp, TrendingDown, Info } from 'lucide-react';

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

const calculateSimpleReturn = (trades, prices, mepRate) => {
  if (!trades || !prices || trades.length === 0) return [];

  const mappedTrades = trades.map(t => ({
    fecha: t.trade_date || t.fecha,
    ticker: t.ticker,
    cantidad: t.quantity || t.cantidad || 0,
    precio: t.price || t.precioCompra || 0
  })).filter(t => t.fecha && t.ticker);

  if (mappedTrades.length === 0) return [];

  const sortedTrades = [...mappedTrades].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  const history = [];

  const holdings = {};

  for (const trade of sortedTrades) {
    const tradeDate = trade.fecha;

    if (!holdings[trade.ticker]) {
      holdings[trade.ticker] = { cantidad: 0, costoTotal: 0 };
    }

    const currentQty = holdings[trade.ticker].cantidad;
    const currentCost = holdings[trade.ticker].costoTotal;

    const newQty = currentQty + trade.cantidad;
    const newCost = currentCost + (trade.cantidad * trade.precio);

    holdings[trade.ticker] = { cantidad: newQty, costoTotal: newCost };

    let totalValue = 0;
    let totalCost = 0;

    for (const [ticker, pos] of Object.entries(holdings)) {
      if (pos.cantidad <= 0) continue;
      const currentPrice = prices[ticker]?.precio || 0;
      totalValue += pos.cantidad * currentPrice;
      totalCost += pos.costoTotal;
    }

    const returnPct = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

    history.push({
      date: tradeDate,
      return: returnPct,
      value: totalValue,
      cost: totalCost,
      isTradeDay: true
    });
  }

  return history;
};

export default function PortfolioEvolutionChart({ trades, prices, mepRate }) {
  const [selectedDays, setSelectedDays] = useState(90);
  const [showSpy, setShowSpy] = useState(true);
  const [spyData, setSpyData] = useState({});
  const [loading, setLoading] = useState(false);
  const [spyError, setSpyError] = useState(null);

  const portfolioHistory = useMemo(() => {
    return calculateSimpleReturn(trades, prices, mepRate);
  }, [trades, prices, mepRate]);

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
        startDate.setDate(startDate.getDate() - Math.max(selectedDays, 365));

        const url = `https://data912.com/historical/cedears/SPY?from=${startDate.toISOString().split('T')[0]}`;

        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        const spyPrices = {};

        if (Array.isArray(data)) {
          data.forEach(item => {
            if (item && item.date) {
              const cleanDate = item.date.split('T')[0];
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

      const filteredHistory = portfolioHistory.filter(d => new Date(d.date) >= cutoffDate);

      if (filteredHistory.length === 0) return [];

      const firstReturn = filteredHistory[0]?.return || 0;

      const sortedSpyDates = Object.keys(spyData).sort();
      let firstSpyPrice = null;
      for (const date of sortedSpyDates) {
        if (spyData[date] > 0) {
          firstSpyPrice = spyData[date];
          break;
        }
      }

      if (!firstSpyPrice) {
        return filteredHistory.map(day => ({
          date: day.date,
          displayDate: new Date(day.date).toLocaleDateString('es-AR', {
            month: 'short',
            day: 'numeric'
          }),
          portfolioChange: day.return - firstReturn,
          spyChange: null,
          hasTrade: day.isTradeDay
        }));
      }

      let spyPriceAtRangeStart = null;
      for (const date of sortedSpyDates) {
        if (new Date(date) >= cutoffDate && spyData[date] > 0) {
          spyPriceAtRangeStart = spyData[date];
          break;
        }
      }

      const baseSpyPrice = spyPriceAtRangeStart || firstSpyPrice;

      return filteredHistory.map(day => {
        const portfolioChange = day.return - firstReturn;

        const spyPrice = spyData[day.date];
        const spyChange = spyPrice && baseSpyPrice
          ? ((spyPrice - baseSpyPrice) / baseSpyPrice) * 100
          : null;

        return {
          date: day.date,
          displayDate: new Date(day.date).toLocaleDateString('es-AR', {
            month: 'short',
            day: 'numeric'
          }),
          portfolioChange,
          spyChange,
          hasTrade: day.isTradeDay
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

    if (diff > 0.5) {
      return {
        text: `Cartera superando al SPY por ${formatPercentValue(diff)}`,
        icon: TrendingUp,
        color: 'text-success',
        bg: 'bg-success/10 border-success/30'
      };
    } else if (diff < -0.5) {
      return {
        text: `Cartera por debajo del SPY por ${formatPercentValue(Math.abs(diff))}`,
        icon: TrendingDown,
        color: 'text-danger',
        bg: 'bg-danger/10 border-danger/30'
      };
    } else {
      return {
        text: `Cartera alineada con SPY (diferencia: ${formatPercentValue(Math.abs(diff))})`,
        icon: TrendingUp,
        color: 'text-slate-400',
        bg: 'bg-slate-700/50 border-slate-600/30'
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
            <h3 className="text-sm font-bold text-white">Retorno de Cartera vs SPY</h3>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              Comparación simple (por trade)
              <span className="group relative">
                <Info className="w-3 h-3 text-slate-500 cursor-help" />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-xs text-slate-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 z-10">
                  Compara el rendimiento de tu cartera con SPY en cada fecha de trade
                </span>
              </span>
            </p>
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

      {loading && (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          <span className="ml-2 text-xs text-slate-400">Cargando SPY...</span>
        </div>
      )}

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
                  dot={{ r: 4, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
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
