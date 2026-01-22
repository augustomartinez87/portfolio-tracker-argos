import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Calendar, Loader2, BarChart2, TrendingUp, TrendingDown, Info, AlertCircle } from 'lucide-react';
import { isBonoPesos, isBonoHardDollar } from '../hooks/useBondPrices';

const isBondTicker = (ticker) => {
  return isBonoPesos(ticker) || isBonoHardDollar(ticker);
};

const normalizePrice = (ticker, price) => {
  if (!price || price === 0) return 0;
  if (isBondTicker(ticker)) {
    return price * 100;
  }
  return price;
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

const parseTradeDate = (dateStr) => {
  if (!dateStr) {
    console.warn('parseTradeDate: null/undefined date');
    return null;
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    console.warn('parseTradeDate: invalid date:', dateStr);
    return null;
  }
  return date.toISOString().split('T')[0];
};

const getClosestPrice = (prices, targetDate, availableDates) => {
  if (!prices || !availableDates || availableDates.length === 0) return 0;
  
  const sortedDates = [...availableDates].sort((a, b) => new Date(a) - new Date(b));
  
  let closestDate = null;
  let minDiff = Infinity;
  
  for (const date of sortedDates) {
    const diff = Math.abs(new Date(date) - new Date(targetDate));
    if (diff < minDiff) {
      minDiff = diff;
      closestDate = date;
    }
  }
  
  if (closestDate) {
    return prices[closestDate] || 0;
  }
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
  const [historicalPrices, setHistoricalPrices] = useState({});
  const [spyPrices, setSpyPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  console.log('=== PortfolioEvolutionChart MOUNTED ===');

  const sortedTrades = useMemo(() => {
    if (!trades || !Array.isArray(trades)) {
      console.log('sortedTrades: no trades');
      return [];
    }

    const parsed = trades
      .map(t => ({
        ...t,
        parsedDate: parseTradeDate(t.trade_date),
        quantity: Number(t.quantity) || Number(t.cantidad) || 0,
        price: Number(t.price) || Number(t.precioCompra) || 0
      }))
      .filter(t => t.parsedDate && t.ticker && t.quantity !== 0);

    const sorted = parsed.sort((a, b) => new Date(a.parsedDate) - new Date(b.parsedDate));
    
    console.log('sortedTrades:', sorted.length, 'trades');
    if (sorted.length > 0) {
      console.log('  First trade:', sorted[0].parsedDate, sorted[0].ticker, sorted[0].quantity, sorted[0].price);
      console.log('  Last trade:', sorted[sorted.length - 1].parsedDate, sorted[sorted.length - 1].ticker);
    }
    
    return sorted;
  }, [trades]);

  const dateRange = useMemo(() => {
    if (sortedTrades.length === 0) return null;
    
    const dates = sortedTrades.map(t => t.parsedDate);
    const minDate = new Date(Math.min(...dates.map(d => new Date(d))));
    const today = new Date();
    
    console.log('dateRange:', minDate.toISOString().split('T')[0], 'to', today.toISOString().split('T')[0]);
    
    return { start: minDate.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
  }, [sortedTrades]);

  const uniqueTickers = useMemo(() => {
    if (sortedTrades.length === 0) return [];
    const tickers = new Set(sortedTrades.map(t => t.ticker));
    console.log('uniqueTickers:', Array.from(tickers));
    return Array.from(tickers);
  }, [sortedTrades]);

  useEffect(() => {
    if (!dateRange || uniqueTickers.length === 0) {
      console.log('useEffect fetch: skipped - no dateRange or tickers');
      return;
    }

    const { start, end } = dateRange;

    const fetchData = async () => {
      console.log('=== FETCH START ===');
      console.log('Date range:', start, 'to', end);
      setLoading(true);
      setError(null);

      try {
        const pricesMap = {};
        const errors = [];

        for (const ticker of uniqueTickers) {
          try {
            const endpoint = isBondTicker(ticker) ? 'bonds' : 'cedears';
            const url = `https://data912.com/historical/${endpoint}/${ticker}?from=${start}&to=${end}`;
            console.log(`Fetching ${ticker}: ${url}`);

            const response = await fetch(url, { signal: AbortSignal.timeout(30000) });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const tickerPrices = {};

            if (Array.isArray(data)) {
              data.forEach(item => {
                if (item && item.date) {
                  const cleanDate = item.date.split('T')[0];
                  const rawPrice = item.c || item.close || 0;
                  tickerPrices[cleanDate] = normalizePrice(ticker, rawPrice);
                }
              });
            } else if (data && typeof data === 'object') {
              Object.entries(data).forEach(([date, value]) => {
                if (date && value !== undefined && value !== null) {
                  const cleanDate = date.split('T')[0];
                  tickerPrices[cleanDate] = normalizePrice(ticker, Number(value) || 0);
                }
              });
            }

            console.log(`  ${ticker}: ${Object.keys(tickerPrices).length} prices, min=${Math.min(...Object.values(tickerPrices))}, max=${Math.max(...Object.values(tickerPrices))}`);
            pricesMap[ticker] = tickerPrices;
          } catch (e) {
            console.error(`  Fetch ${ticker} failed:`, e.message);
            errors.push(ticker);
          }
        }

        setHistoricalPrices(pricesMap);
        console.log('All prices fetched, tickers:', Object.keys(pricesMap));

        if (showSpy) {
          try {
            const spyUrl = `https://data912.com/historical/cedears/SPY?from=${start}&to=${end}`;
            console.log('Fetching SPY:', spyUrl);

            const response = await fetch(spyUrl, { signal: AbortSignal.timeout(30000) });

            if (response.ok) {
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

              console.log(`SPY: ${Object.keys(spyMap).length} prices`);
              setSpyPrices(spyMap);
            } else {
              console.warn('SPY fetch failed:', response.status);
            }
          } catch (e) {
            console.error('SPY fetch error:', e.message);
          }
        }

        if (errors.length > 0) {
          setError(`Error cargando: ${errors.join(', ')}`);
        }
      } catch (e) {
        console.error('Global fetch error:', e);
        setError(e.message || 'Error cargando datos');
      } finally {
        setLoading(false);
        console.log('=== FETCH END ===');
      }
    };

    fetchData();
  }, [dateRange, uniqueTickers, showSpy]);

  const allDates = useMemo(() => {
    if (!dateRange) {
      console.log('allDates: no dateRange');
      return [];
    }

    const dates = [];
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);

    for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    console.log('allDates:', dates.length, 'days');
    return dates;
  }, [dateRange]);

  const holdingsByDate = useMemo(() => {
    if (sortedTrades.length === 0 || allDates.length === 0) {
      console.log('holdingsByDate: no trades or dates');
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
    if (allDates.length === 0 || Object.keys(historicalPrices).length === 0) {
      console.log('portfolioValues: no dates or prices');
      return {};
    }

    console.log('=== CALCULATING PORTFOLIO VALUES ===');
    const values = {};
    const tickerList = Object.keys(historicalPrices);

    for (const date of allDates) {
      let totalValue = 0;

      for (const ticker of tickerList) {
        const tickerPrices = historicalPrices[ticker];
        const holdingsAtDate = holdingsByDate[date]?.[ticker];

        if (holdingsAtDate && holdingsAtDate.cantidad > 0) {
          let price = tickerPrices[date];
          
          if (!price || price === 0) {
            const availableDates = Object.keys(tickerPrices);
            price = getClosestPrice(tickerPrices, date, availableDates);
          }

          if (price > 0) {
            const positionValue = holdingsAtDate.cantidad * price;
            totalValue += positionValue;
          }
        }
      }

      values[date] = totalValue;
    }

    const nonZeroCount = Object.values(values).filter(v => v > 0).length;
    console.log('Portfolio values: total days', allDates.length, 'with value > 0:', nonZeroCount);
    console.log('Sample values:', Object.entries(values).slice(0, 5).map(([k, v]) => `${k}: ${v.toFixed(2)}`));
    
    return values;
  }, [allDates, historicalPrices, holdingsByDate]);

  const twrData = useMemo(() => {
    if (allDates.length === 0 || Object.keys(portfolioValues).length === 0) {
      console.log('twrData: no data');
      return [];
    }

    console.log('=== CALCULATING TWR ===');
    const values = portfolioValues;
    let cumTWR = 1;
    let prevValue = null;
    const result = [];

    for (const date of allDates) {
      const currentValue = values[date];

      let hpr = 0;
      if (prevValue !== null && prevValue > 0) {
        hpr = (currentValue - prevValue) / prevValue;
        cumTWR *= (1 + hpr);
      } else if (currentValue > 0) {
        cumTWR = 1;
      }

      const returnPct = currentValue > 0 ? (cumTWR - 1) * 100 : 0;

      result.push({
        date,
        return: returnPct,
        value: currentValue
      });

      console.log(`TWR ${date}: value=${currentValue.toFixed(2)}, hpr=${(hpr * 100).toFixed(2)}%, cumTWR=${((cumTWR - 1) * 100).toFixed(2)}%`);
      
      prevValue = currentValue;
    }

    console.log('TWR complete:', result.length, 'points');
    return result;
  }, [allDates, portfolioValues]);

  const spyData = useMemo(() => {
    if (!spyPrices || Object.keys(spyPrices).length === 0) {
      console.log('spyData: no spy prices');
      return {};
    }

    console.log('=== CALCULATING SPY ===');
    const dates = Object.keys(spyPrices).sort((a, b) => new Date(a) - new Date(b));
    
    if (dates.length === 0) return {};

    const spyValues = dates.map(d => ({ date: d, price: spyPrices[d] }));
    const initialPrice = spyValues[0].price;

    console.log('SPY initial price:', initialPrice);

    if (initialPrice <= 0) {
      console.warn('SPY initial price is 0 or negative!');
      return {};
    }

    const result = {};
    for (const { date, price } of spyValues) {
      const cumulative = ((price - initialPrice) / initialPrice) * 100;
      result[date] = cumulative;
    }

    console.log('SPY cumulative calculated:', Object.keys(result).length, 'points');
    return result;
  }, [spyPrices]);

  const chartData = useMemo(() => {
    console.log('=== BUILDING CHART DATA ===');
    console.log('twrData:', twrData.length, 'points');
    console.log('spyData:', Object.keys(spyData).length, 'points');

    if (twrData.length === 0) {
      console.log('chartData: empty');
      return [];
    }

    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - selectedDays);
    
    console.log('Cutoff:', cutoffDate.toISOString().split('T')[0]);

    const filteredTWR = twrData.filter(d => new Date(d.date) >= cutoffDate);
    console.log('Filtered TWR:', filteredTWR.length, 'points');

    if (filteredTWR.length === 0) return [];

    const firstReturn = filteredTWR[0].return;

    const result = filteredTWR.map(day => {
      let spyReturn = null;
      if (spyData[day.date] !== undefined) {
        spyReturn = spyData[day.date];
      }
      
      return {
        date: day.date,
        displayDate: formatDateDisplay(day.date),
        portfolioReturn: day.return - firstReturn,
        spyReturn
      };
    });

    console.log('chartData built:', result.length, 'points');
    console.log('First point:', result[0]);
    console.log('Last 5 points:', result.slice(-5).map(p => `${p.date}: portfolio=${p.portfolioReturn.toFixed(2)}%, spy=${p.spyReturn?.toFixed(2)}%`));

    return result;
  }, [twrData, spyData, selectedDays]);

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
