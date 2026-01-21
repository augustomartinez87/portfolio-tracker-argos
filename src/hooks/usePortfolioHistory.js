import { useState, useEffect, useMemo } from 'react';
import { data912 } from '../utils/data912';
import { isBonoPesos } from './useBondPrices';

export function usePortfolioHistory(trades, days = 90) {
  const [historicalData, setHistoricalData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!trades || trades.length === 0) {
      setHistoricalData({});
      return;
    }

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);

      try {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);

        const uniqueTickers = [...new Set(trades.map(t => t.ticker))];
        const tickerData = uniqueTickers.map(ticker => ({ ticker }));

        const { data, errors } = await data912.getBatchHistorical(tickerData, fromDate.toISOString().split('T')[0]);

        const successfulData = {};
        let hasErrors = false;

        Object.keys(data).forEach(ticker => {
          if (data[ticker] && data[ticker].length > 0) {
            successfulData[ticker] = data[ticker];
          }
        });

        if (Object.keys(errors).length > 0) {
          console.warn('Some tickers failed to fetch historical data:', errors);
        }

        setHistoricalData(successfulData);
      } catch (err) {
        console.error('Error fetching portfolio history:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [trades, days]);

  const portfolioValue = useMemo(() => {
    if (!trades || trades.length === 0 || Object.keys(historicalData).length === 0) {
      return [];
    }

    const tradesByDate = {};
    trades.forEach(trade => {
      const date = trade.fecha;
      if (!tradesByDate[date]) {
        tradesByDate[date] = [];
      }
      tradesByDate[date].push(trade);
    });

    const allDates = new Set();
    Object.values(historicalData).forEach(data => {
      data.forEach(item => {
        if (item.date) {
          allDates.add(item.date);
        }
      });
    });

    const tradeDates = Object.keys(tradesByDate).sort();
    if (tradeDates.length > 0) {
      const earliestTrade = new Date(tradeDates[0]);
      allDates.add(earliestTrade.toISOString().split('T')[0]);
    }

    const sortedDates = [...allDates].sort((a, b) => new Date(a) - new Date(b));

    const dailyHoldings = {};
    let currentHoldings = {};

    sortedDates.forEach(date => {
      if (tradesByDate[date]) {
        tradesByDate[date].forEach(trade => {
          if (!currentHoldings[trade.ticker]) {
            currentHoldings[trade.ticker] = 0;
          }
          currentHoldings[trade.ticker] += trade.cantidad;
        });
      }
      dailyHoldings[date] = { ...currentHoldings };
    });

    const result = sortedDates.map(date => {
      const holdings = dailyHoldings[date];
      let totalValueARS = 0;
      let totalValueUSD = 0;

      Object.keys(holdings).forEach(ticker => {
        const quantity = holdings[ticker];
        if (quantity <= 0) return;

        const tickerData = historicalData[ticker];
        if (!tickerData) return;

        const dayData = tickerData.find(d => d.date === date);
        if (dayData && dayData.c > 0) {
          const price = dayData.c;
          totalValueARS += quantity * price;

          if (isBonoPesos(ticker)) {
            totalValueUSD += quantity * price;
          }
        }
      });

      return {
        date,
        valueARS: totalValueARS,
        valueUSD: totalValueUSD,
        holdings: { ...holdings }
      };
    });

    return result.filter(day => day.valueARS > 0);
  }, [trades, historicalData]);

  return {
    data: portfolioValue,
    loading,
    error,
    rawHistorical: historicalData
  };
}
