import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Calendar, Loader2, BarChart2, TrendingUp, TrendingDown, Info, AlertCircle } from 'lucide-react';
import { isBonoPesos, isBonoHardDollar, adjustBondPrice } from '../hooks/useBondPrices';

const formatPercentValue = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-AR', { month: 'short', day: 'numeric' });
};

const isBondTicker = (ticker) => {
  return isBonoPesos(ticker) || isBonoHardDollar(ticker);
};

const normalizeTradePrice = (ticker, price) => {
  if (!price || price === 0) return 0;
  if (isBondTicker(ticker)) {
    return adjustBondPrice(ticker, price) * 100;
  }
  return price;
};

const normalizeApiPrice = (ticker, price) => {
  if (!price || price === 0) return 0;
  if (isBondTicker(ticker)) {
    return price * 100;
  }
  return price;
};

const fetchHistoricalPrices = async (ticker, startDate, endDate) => {
  const endpoint = isBondTicker(ticker) ? 'bonds' : 'cedears';
  const url = `https://data912.com/historical/${endpoint}/${ticker}?from=${startDate}&to=${endDate}`;
  
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${ticker}: HTTP ${response.status}`);
  }
  
  const data = await response.json();
  
  const prices = {};
  
  if (Array.isArray(data)) {
    data.forEach(item => {
      if (item && item.date) {
        const cleanDate = item.date.split('T')[0];
        const rawPrice = item.c || item.close || 0;
        prices[cleanDate] = normalizeApiPrice(ticker, rawPrice);
      }
    });
  } else if (data && typeof data === 'object') {
    Object.entries(data).forEach(([date, value]) => {
      if (date && value !== undefined && value !== null) {
        const cleanDate = date.split('T')[0];
        prices[cleanDate] = normalizeApiPrice(ticker, Number(value) || 0);
      }
    });
  }
  
  return prices;
};

const calculateTWR = (trades, historicalPrices) => {
  if (!trades || trades.length === 0) return [];
  
  const sortedTrades = [...trades]
    .map(t => ({
      ...t,
      fecha: t.trade_date || t.fecha,
      cantidad: t.quantity || t.cantidad || 0,
      precio: t.price || t.precioCompra || 0
    }))
    .filter(t => t.fecha && t.ticker && t.cantidad > 0)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  
  if (sortedTrades.length === 0) return [];
  
  const startDate = sortedTrades[0].fecha;
  const endDate = new Date().toISOString().split('T')[0];
  
  const allDates = [];
  for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
    allDates.push(d.toISOString().split('T')[0]);
  }
  
  const holdings = {};
  let previousPortfolioValue = 0;
  let twrAccumulated = 1;
  
  const twrHistory = [];
  
  for (const date of allDates) {
    const tradesOnDate = sortedTrades.filter(t => t.fecha === date);
    
    let portfolioValue = 0;
    
    for (const [ticker, pos] of Object.entries(holdings)) {
      if (pos.cantidad <= 0) continue;
      const price = historicalPrices[ticker]?.[date] || 0;
      portfolioValue += pos.cantidad * price;
    }
    
    if (tradesOnDate.length > 0 && previousPortfolioValue > 0) {
      const periodReturn = portfolioValue / previousPortfolioValue;
      twrAccumulated *= periodReturn;
    }
    
    tradesOnDate.forEach(trade => {
      if (!holdings[trade.ticker]) {
        holdings[trade.ticker] = { cantidad: 0, costoTotal: 0 };
      }
      const normalizedPrice = normalizeTradePrice(trade.ticker, trade.precio);
      holdings[trade.ticker].cantidad += trade.cantidad;
      holdings[trade.ticker].costoTotal += trade.cantidad * normalizedPrice;
    });
    
    if (tradesOnDate.length > 0) {
      previousPortfolioValue = portfolioValue;
    }
    
    if (previousPortfolioValue === 0 && portfolioValue > 0) {
      previousPortfolioValue = portfolioValue;
    }
    
    const currentTWR = (twrAccumulated - 1) * 100;
    
    twrHistory.push({
      date,
      twr: currentTWR,
      portfolioValue
    });
  }
  
  return twrHistory;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length && label) {
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
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-400 text-xs">{entry.name}:</span>
            <span className={`text-sm font-mono font-semibold ${entry.value >= 0 ? 'text-success' : 'text-danger'}`}>
              {formatPercentValue(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function PortfolioEvolutionChart({ trades, prices }) {
  const [selectedDays, setSelectedDays] = useState(90);
  const [showSpy, setShowSpy] = useState(true);
  const [historicalPrices, setHistoricalPrices] = useState({});
  const [spyHistorical, setSpyHistorical] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const uniqueTickers = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    const tickers = new Set(trades.map(t => t.ticker || t.ticker));
    return Array.from(tickers);
  }, [trades]);
  
  const startDate = useMemo(() => {
    if (!trades || trades.length === 0) return null;
    const dates = trades.map(t => t.trade_date || t.fecha).filter(Boolean);
    if (dates.length === 0) return null;
    const minDate = new Date(Math.min(...dates.map(d => new Date(d))));
    minDate.setDate(minDate.getDate() - 7);
    return minDate.toISOString().split('T')[0];
  }, [trades]);
  
  const endDate = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);
  
  const fetchAllHistoricalData = useCallback(async () => {
    if (!uniqueTickers.length || !startDate) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const pricesMap = {};
      const errors = [];
      
      for (const ticker of uniqueTickers) {
        try {
          pricesMap[ticker] = await fetchHistoricalPrices(ticker, startDate, endDate);
        } catch (e) {
          console.warn(`Failed to fetch ${ticker}:`, e);
          errors.push(ticker);
        }
      }
      
      setHistoricalPrices(pricesMap);
      
      if (showSpy) {
        const spyUrl = `https://data912.com/historical/cedears/SPY?from=${startDate}&to=${endDate}`;
        const spyResponse = await fetch(spyUrl, { signal: AbortSignal.timeout(30000) });
        
        if (spyResponse.ok) {
          const spyData = await spyResponse.json();
          const spyPrices = {};
          
          if (Array.isArray(spyData)) {
            spyData.forEach(item => {
              if (item && item.date) {
                const cleanDate = item.date.split('T')[0];
                spyPrices[cleanDate] = item.c || item.close || 0;
              }
            });
          }
          
          setSpyHistorical(spyPrices);
        }
      }
      
      if (errors.length > 0) {
        setError(`No se pudieron cargar: ${errors.join(', ')}`);
      }
    } catch (e) {
      console.error('Error fetching historical data:', e);
      setError(e.message || 'Error al cargar datos históricos');
    } finally {
      setLoading(false);
    }
  }, [uniqueTickers, startDate, endDate, showSpy]);
  
  useEffect(() => {
    fetchAllHistoricalData();
  }, [fetchAllHistoricalData]);
  
  const twrData = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    return calculateTWR(trades, historicalPrices);
  }, [trades, historicalPrices]);
  
  const chartData = useMemo(() => {
    if (twrData.length === 0) return [];
    
    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - selectedDays);
    
    const filteredTWRTWR = twrData.filter(d => new Date(d.date) >= cutoffDate);
    
    if (filteredTWRTWR.length === 0) return [];
    
    const firstTWR = filteredTWRTWR[0]?.twr || 0;
    
    const sortedSpyDates = Object.keys(spyHistorical).sort();
    let firstSpyPrice = null;
    
    for (const date of sortedSpyDates) {
      if (new Date(date) >= cutoffDate && spyHistorical[date] > 0) {
        firstSpyPrice = spyHistorical[date];
        break;
      }
    }
    
    return filteredTWRTWR.map(day => {
      const portfolioChange = day.twr - firstTWR;
      
      const spyPrice = spyHistorical[day.date];
      const spyChange = spyPrice && firstSpyPrice
        ? ((spyPrice - firstSpyPrice) / firstSpyPrice) * 100
        : null;
      
      return {
        date: day.date,
        displayDate: formatDate(day.date),
        portfolioChange,
        spyChange
      };
    });
  }, [twrData, spyHistorical, selectedDays]);
  
  const stats = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    
    const last = chartData[chartData.length - 1];
    const portfolioReturn = last?.portfolioChange || 0;
    const spyReturn = last?.spyChange || 0;
    const diff = portfolioReturn - spyReturn;
    
    return { portfolioReturn, spyReturn, diff };
  }, [chartData]);
  
  const comparisonMessage = useMemo(() => {
    if (!stats || !showSpy || Object.keys(spyHistorical).length === 0) return null;
    
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
  }, [stats, showSpy, spyHistorical]);
  
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
            <h3 className="text-sm font-bold text-white">Retorno TWR vs SPY</h3>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              Time-Weighted Return
              <span className="group relative">
                <Info className="w-3 h-3 text-slate-500 cursor-help" />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-xs text-slate-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 z-10">
                  Excluye aportes de capital del rendimiento
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
          <span className="ml-2 text-xs text-slate-400">Cargando datos históricos...</span>
        </div>
      )}
      
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30 mb-3">
          <AlertCircle className="w-4 h-4 text-danger" />
          <span className="text-xs text-danger">{error}</span>
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
                  name="Cartera (TWR)"
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
                  <p className="text-xs text-slate-500">Cartera (TWR)</p>
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
