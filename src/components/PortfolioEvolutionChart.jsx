import React, { useState, useMemo, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Calendar, Loader2, BarChart2, TrendingUp, TrendingDown, Info, AlertCircle } from 'lucide-react';
import { isBonoPesos, isBonoHardDollar } from '../hooks/useBondPrices';

/*
  EXAMPLES FOR TESTING TWR CALCULATION:
  
  trades: [
    { trade_date: '2025-04-11', ticker: 'AE38', quantity: 1787, price: 839 },
    { trade_date: '2025-04-24', ticker: 'TTD26', quantity: 1735250, price: 1.01 },
  ]
  
  Expected valuation at trade dates:
  - 11/04/2025 AE38: 1787 * 839 = 1,499,193 invested, current val 2,067,000, res +567,807 (+37.84%)
  - 24/04/2025 TTD26: 1,735,250 * 1.01 = 1,752,602.50 invested, current val 2,370,000, res +617,397.50 (+35.20%)
  
  Note: TTD26 prices from API are decimals (1.01, 1.36) but need *100 for comparison with trades (101, 136)
  AE38 is hard dollar bond, prices from API are ~1000-1200 range
  
  Debug expected output:
  flowDates: ['2025-04-11', '2025-04-24', '2026-01-22']
  sub-period 1: 2025-04-11 to 2025-04-23, v_start=~2,067,000
  sub-period 2: 2025-04-24 to 2026-01-22, v_start=~4,437,000 (AE38 + TTD26)
*/

const isBondTicker = (ticker) => {
  return isBonoPesos(ticker) || isBonoHardDollar(ticker);
};

const formatPercentValue = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const formatDateDisplay = (dateStr) => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Invalid';
  return date.toLocaleDateString('es-AR', { month: 'short', day: 'numeric' });
};

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    console.warn('Invalid date:', dateStr);
    return null;
  }
  return date.toISOString().split('T')[0];
};

const normalizeApiPrice = (ticker, price) => {
  if (!price || price === 0) return 0;
  if (isBondTicker(ticker)) {
    return price * 100;
  }
  return price;
};

const getTradeAvgPrice = (ticker, trades) => {
  const tickerTrades = trades.filter(t => t.ticker === ticker && t.price > 0);
  if (tickerTrades.length === 0) return null;
  const sum = tickerTrades.reduce((acc, t) => acc + (Number(t.price) || 0), 0);
  return sum / tickerTrades.length;
};

const fetchHistoricalPrice = async (ticker, date, cache, setCache) => {
  const cacheKey = `${ticker}_${date}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  try {
    const endpoint = isBondTicker(ticker) ? 'bonds' : 'cedears';
    const url = `https://data912.com/historical/${endpoint}/${ticker}?from=${date}&to=${date}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) {
      cache.set(cacheKey, null);
      return null;
    }

    const data = await response.json();
    let price = 0;

    if (Array.isArray(data) && data.length > 0) {
      price = data[0].c || data[0].close || 0;
    } else if (data && typeof data === 'object') {
      const values = Object.values(data);
      if (values.length > 0) price = Number(values[0]) || 0;
    }

    const normalized = normalizeApiPrice(ticker, price);
    cache.set(cacheKey, normalized);
    return normalized;
  } catch (e) {
    console.warn(`fetchHistoricalPrice ${ticker} ${date}:`, e.message);
    cache.set(cacheKey, null);
    return null;
  }
};

const getPrice = async (ticker, date, historicalCache, setHistoricalCache, trades, currentPrices) => {
  const normalized = normalizeApiPrice(ticker, currentPrices[ticker]?.precio || 0);
  
  if (normalized > 0) {
    const historical = await fetchHistoricalPrice(ticker, date, historicalCache, setHistoricalCache);
    if (historical > 0) {
      return historical;
    }
  }

  const tradeAvg = getTradeAvgPrice(ticker, trades);
  if (tradeAvg > 0) {
    console.log(`No historical for ${ticker} ${date}, using trade avg: ${tradeAvg.toFixed(2)}`);
    return tradeAvg;
  }

  console.warn(`No price data for ${ticker} ${date}`);
  return 0;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length && label) {
    const date = new Date(label);
    if (isNaN(date.getTime())) return null;

    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
        <p className="text-white font-semibold text-sm mb-2">
          {date.toLocaleDateString('es-AR', {
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
  const [spyPrices, setSpyPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const historicalCacheRef = useRef(new Map());
  const [historicalCache, setHistoricalCache] = useState(new Map());

  console.log('=== PortfolioEvolutionChart RENDER ===');

  const sortedTrades = useMemo(() => {
    if (!trades || !Array.isArray(trades)) {
      console.log('sortedTrades: no trades');
      return [];
    }

    const parsed = trades
      .map(t => ({
        ...t,
        parsedDate: parseDate(t.trade_date),
        quantity: Number(t.quantity) || Number(t.cantidad) || 0,
        price: Number(t.price) || Number(t.precioCompra) || 0
      }))
      .filter(t => t.parsedDate && t.ticker && t.quantity !== 0)
      .sort((a, b) => new Date(a.parsedDate) - new Date(b.parsedDate));

    console.log('sortedTrades:', parsed.length, 'trades');
    if (parsed.length > 0) {
      console.log('  First:', parsed[0].parsedDate, parsed[0].ticker, parsed[0].quantity, parsed[0].price);
      console.log('  Last:', parsed[parsed.length - 1].parsedDate);
    }

    return parsed;
  }, [trades]);

  const flowDates = useMemo(() => {
    if (sortedTrades.length === 0) {
      console.log('flowDates: no trades');
      return [];
    }

    const tradeDates = [...new Set(sortedTrades.map(t => t.parsedDate))];
    const today = new Date().toISOString().split('T')[0];

    const allFlows = [...tradeDates, today].sort((a, b) => new Date(a) - new Date(b));
    
    console.log('flowDates:', allFlows.length, 'dates');
    console.log('  flowDates:', allFlows);
    
    return allFlows;
  }, [sortedTrades]);

  const allDates = useMemo(() => {
    if (flowDates.length === 0) {
      console.log('allDates: no flowDates');
      return [];
    }

    const start = flowDates[0];
    const end = flowDates[flowDates.length - 1];
    const dates = [];

    for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    console.log('allDates:', dates.length, 'days from', start, 'to', end);
    return dates;
  }, [flowDates]);

  const uniqueTickers = useMemo(() => {
    if (sortedTrades.length === 0) return [];
    return [...new Set(sortedTrades.map(t => t.ticker))];
  }, [sortedTrades]);

  useEffect(() => {
    if (!flowDates.length || !showSpy) {
      console.log('SPY fetch: skipped', { flowDates: flowDates.length, showSpy });
      return;
    }

    const start = flowDates[0];
    const end = flowDates[flowDates.length - 1];

    const fetchSpy = async () => {
      console.log('Fetching SPY from', start, 'to', end);
      setLoading(true);

      try {
        const url = `https://data912.com/historical/cedears/SPY?from=${start}&to=${end}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(30000) });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const spyMap = {};

        if (Array.isArray(data)) {
          data.forEach(item => {
            if (item && item.date) {
              const cleanDate = item.date.split('T')[0];
              spyMap[cleanDate] = item.c || item.close || 0;
            }
          });
        }

        console.log('SPY fetched:', Object.keys(spyMap).length, 'prices');
        setSpyPrices(spyMap);
      } catch (e) {
        console.error('SPY fetch error:', e);
        setError('Error cargando SPY');
      } finally {
        setLoading(false);
      }
    };

    fetchSpy();
  }, [flowDates, showSpy]);

  const holdingsByDate = useMemo(() => {
    if (sortedTrades.length === 0 || allDates.length === 0) {
      console.log('holdingsByDate: no data');
      return {};
    }

    console.log('=== CALCULATING HOLDINGS ===');
    const holdings = {};
    const result = {};

    for (const date of allDates) {
      const tradesUpToDate = sortedTrades.filter(t => t.parsedDate <= date);

      for (const trade of tradesUpToDate) {
        if (!holdings[trade.ticker]) {
          holdings[trade.ticker] = { cantidad: 0 };
        }
        holdings[trade.ticker].cantidad += trade.quantity;
      }

      result[date] = JSON.parse(JSON.stringify(holdings));
    }

    const lastDate = allDates[allDates.length - 1];
    console.log('Holdings at', lastDate, ':', JSON.stringify(result[lastDate]));

    return result;
  }, [sortedTrades, allDates]);

  const portfolioValues = useMemo(() => {
    if (allDates.length === 0 || uniqueTickers.length === 0) {
      console.log('portfolioValues: no dates or tickers');
      return {};
    }

    console.log('=== CALCULATING PORTFOLIO VALUES ===');
    const values = {};

    for (const date of allDates) {
      const holdingsAtDate = holdingsByDate[date];
      let totalValue = 0;

      for (const ticker of uniqueTickers) {
        const position = holdingsAtDate?.[ticker];
        if (position && position.cantidad > 0) {
          const currentPrice = normalizeApiPrice(ticker, prices[ticker]?.precio || 0);
          if (currentPrice > 0) {
            totalValue += position.cantidad * currentPrice;
          }
        }
      }

      values[date] = totalValue;
    }

    const nonZero = Object.values(values).filter(v => v > 0).length;
    console.log('portfolioValues: total', allDates.length, 'with value > 0:', nonZero);
    console.log('Sample:', Object.entries(values).slice(0, 3).map(([k, v]) => `${k}: ${v.toFixed(0)}`));

    return values;
  }, [allDates, holdingsByDate, uniqueTickers, prices]);

  const twrData = useMemo(() => {
    if (allDates.length === 0 || flowDates.length === 0 || Object.keys(portfolioValues).length === 0) {
      console.log('twrData: missing data');
      return [];
    }

    console.log('=== CALCULATING TWR ===');
    console.log('flowDates:', flowDates.length, flowDates);

    let cumTWR = 1;
    const result = [];
    const values = portfolioValues;

    for (let i = 0; i < flowDates.length - 1; i++) {
      const subStart = flowDates[i];
      const subEnd = flowDates[i + 1];
      
      const v_start = values[subStart] || 0;
      console.log(`\nSub-period ${i + 1}: ${subStart} to ${subEnd}`);
      console.log(`  v_start: ${v_start.toFixed(0)}`);

      const startIdx = allDates.indexOf(subStart);
      const endIdx = allDates.indexOf(subEnd);
      const subDates = allDates.slice(startIdx, endIdx);

      for (const date of subDates) {
        const v_d = values[date] || 0;
        let sub_hpr_d = 0;

        if (v_start > 0) {
          sub_hpr_d = (v_d / v_start) - 1;
        }

        const cumulativeReturn = (cumTWR * (1 + sub_hpr_d) - 1) * 100;
        
        result.push({
          date,
          portfolioReturn: cumulativeReturn,
          value: v_d
        });
      }

      let sub_hpr = 0;
      if (v_start > 0 && values[subEnd] !== undefined) {
        sub_hpr = (values[subEnd] / v_start) - 1;
        cumTWR *= (1 + sub_hpr);
      }

      console.log(`  v_end: ${(values[subEnd] || 0).toFixed(0)}`);
      console.log(`  sub_hpr: ${(sub_hpr * 100).toFixed(2)}%`);
      console.log(`  cumTWR: ${((cumTWR - 1) * 100).toFixed(2)}%`);
    }

    console.log('\n=== TWR COMPLETE ===');
    console.log('Result:', result.length, 'points');
    console.log('First:', result[0]);
    console.log('Last:', result[result.length - 1]);

    return result;
  }, [allDates, flowDates, portfolioValues]);

  const spyCumulative = useMemo(() => {
    if (!spyPrices || Object.keys(spyPrices).length === 0 || allDates.length === 0) {
      console.log('spyCumulative: no data');
      return {};
    }

    console.log('=== CALCULATING SPY ===');
    const dates = Object.keys(spyPrices).sort((a, b) => new Date(a) - new Date(b));
    
    if (dates.length === 0) return {};

    const initialClose = spyPrices[dates[0]];
    console.log('SPY initial close:', initialClose);

    if (!initialClose || initialClose <= 0) {
      console.warn('SPY initial close is 0 or invalid');
      return {};
    }

    const result = {};
    for (const date of dates) {
      const close = spyPrices[date];
      if (close > 0) {
        result[date] = ((close - initialClose) / initialClose) * 100;
      }
    }

    console.log('SPY cumulative:', Object.keys(result).length, 'points');
    return result;
  }, [spyPrices, allDates]);

  const chartData = useMemo(() => {
    console.log('=== BUILDING CHART DATA ===');
    console.log('twrData:', twrData.length, 'spyCumulative:', Object.keys(spyCumulative).length);

    if (twrData.length === 0) return [];

    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - selectedDays);
    
    console.log('Cutoff:', cutoffDate.toISOString().split('T')[0]);

    const filtered = twrData.filter(d => new Date(d.date) >= cutoffDate);
    console.log('Filtered:', filtered.length, 'points');

    if (filtered.length === 0) return [];

    const firstReturn = filtered[0].portfolioReturn;

    const result = filtered.map(day => ({
      date: day.date,
      displayDate: formatDateDisplay(day.date),
      portfolioReturn: day.portfolioReturn - firstReturn,
      spyReturn: spyCumulative[day.date] !== undefined ? spyCumulative[day.date] : null
    }));

    console.log('chartData:', result.length, 'points');
    console.log('First:', result[0]);
    console.log('Last 3:', result.slice(-3));

    return result;
  }, [twrData, spyCumulative, selectedDays]);

  const stats = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;

    const last = chartData[chartData.length - 1];
    return {
      portfolioReturn: last?.portfolioReturn || 0,
      spyReturn: last?.spyReturn || 0,
      diff: (last?.portfolioReturn || 0) - (last?.spyReturn || 0)
    };
  }, [chartData]);

  const comparisonMessage = useMemo(() => {
    if (!stats || !showSpy || Object.keys(spyCumulative).length === 0) return null;

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
  }, [stats, showSpy, spyCumulative]);

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
          <span className="ml-2 text-xs text-slate-400">Cargando datos...</span>
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
                  dataKey="portfolioReturn"
                  name="Cartera (TWR)"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
                />
                {showSpy && chartData.some(d => d.spyReturn !== null) && (
                  <Line
                    type="monotone"
                    dataKey="spyReturn"
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
                    {showSpy && chartData.some(d => d.spyReturn !== null)
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
