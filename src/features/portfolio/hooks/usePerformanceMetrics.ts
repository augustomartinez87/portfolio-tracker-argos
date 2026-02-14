import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  calculateXIRRWithDiagnostics,
  calculateYTDWithDiagnostics,
  calculateTWR,
  calculateModifiedDietz,
  tradesToCashFlows,
  calculateNetFlows,
  annualizeReturn,
  MetricResult
} from '../services/performanceService';
import type { PortfolioTotals } from '@/types';

interface Trade {
  id?: string;
  ticker: string;
  trade_date: string | Date;
  trade_type: 'buy' | 'sell';
  quantity: number;
  price: number;
  total_amount: number;
}

export interface PerformanceMetrics {
  xirr: MetricResult<number>;
  ytd: MetricResult<number>;
  twr: MetricResult<number>;
  isLoading: boolean;
  error: string | null;
}

interface UsePerformanceMetricsOptions {
  enabled?: boolean;
  currency?: 'ARS' | 'USD';
}

/**
 * Hook to calculate portfolio performance metrics
 *
 * @param trades All trades for the portfolio
 * @param totals Current portfolio totals (valuation, invested, etc.)
 * @param options Configuration options
 * @returns Performance metrics (XIRR, YTD, TWR) with loading and error states
 */
export function usePerformanceMetrics(
  trades: Trade[],
  totals: PortfolioTotals,
  options: UsePerformanceMetricsOptions = {}
): PerformanceMetrics {
  const { enabled = true, currency = 'ARS' } = options;

  // Get valuation based on currency
  const currentValuation = currency === 'ARS' ? totals.valuation : totals.valuationUSD;
  const currentInvested = currency === 'ARS' ? totals.invested : totals.investedUSD;

  // XIRR: Computed synchronously (no API calls needed)
  const xirrResult = useMemo<MetricResult<number>>(() => {
    if (!enabled || trades.length === 0 || !currentValuation || currentValuation <= 0) {
      return { value: null, warning: 'Sin datos suficientes' };
    }

    try {
      const cashFlows = tradesToCashFlows(trades, currentValuation, currency);
      return calculateXIRRWithDiagnostics(cashFlows);
    } catch (err) {
      return { value: null, error: err instanceof Error ? err.message : 'Error calculando XIRR' };
    }
  }, [trades, currentValuation, currency, enabled]);

  // YTD: Calculate year-to-date return
  // For now, we use a simplified calculation based on invested vs current value
  // Full implementation with historical prices will come in Phase 3
  const ytdResult = useMemo<MetricResult<number>>(() => {
    if (!enabled || trades.length === 0 || !currentValuation || currentValuation <= 0) {
      return { value: null, warning: 'Sin datos suficientes' };
    }

    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // Filter trades from this year
    const ytdTrades = trades.filter(t => {
      const tradeDate = t.trade_date instanceof Date ? t.trade_date : new Date(t.trade_date);
      return tradeDate >= yearStart;
    });

    // Filter trades from before this year
    const preYearTrades = trades.filter(t => {
      const tradeDate = t.trade_date instanceof Date ? t.trade_date : new Date(t.trade_date);
      return tradeDate < yearStart;
    });

    // Calculate net flows this year
    const ytdNetFlows = calculateNetFlows(ytdTrades);

    // Determine if portfolio existed before this year
    const isFirstYearPortfolio = preYearTrades.length === 0;

    if (isFirstYearPortfolio) {
      // Portfolio started this year - use total invested as start value
      const totalInvestedThisYear = ytdNetFlows;
      if (totalInvestedThisYear <= 0) {
        return { value: null, warning: 'Sin inversión este año' };
      }
      return calculateYTDWithDiagnostics(0, currentValuation, ytdNetFlows, true);
    }

    // Portfolio existed before this year
    // Estimate start value as: current invested - net flows this year
    // This is an approximation; accurate calculation requires historical prices
    const estimatedStartValue = currentInvested - ytdNetFlows;

    if (estimatedStartValue <= 0) {
      return { value: null, warning: 'No se puede estimar valor inicial del año' };
    }

    return calculateYTDWithDiagnostics(estimatedStartValue, currentValuation, ytdNetFlows, false);
  }, [trades, currentValuation, currentInvested, enabled]);

  // TWR: Time Weighted Return using Modified Dietz method
  // Weights cash flows by the fraction of the period they were invested,
  // which is significantly better than the simple (V1-V0)/V0 approach.
  const twrResult = useMemo<MetricResult<number>>(() => {
    if (!enabled || trades.length === 0 || !currentValuation || currentValuation <= 0) {
      return { value: null, warning: 'Sin datos suficientes' };
    }

    // Get date range
    const tradeDates = trades.map(t =>
      t.trade_date instanceof Date ? t.trade_date : new Date(t.trade_date)
    );
    const firstTradeDate = new Date(Math.min(...tradeDates.map(d => d.getTime())));
    const now = new Date();

    const daysHeld = Math.ceil((now.getTime() - firstTradeDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysHeld < 1) {
      return { value: null, warning: 'Período muy corto para calcular TWR' };
    }

    // Build cash flows for Modified Dietz (excluding the final valuation)
    const cashFlows = trades.map(trade => {
      const date = trade.trade_date instanceof Date
        ? trade.trade_date
        : new Date(trade.trade_date);
      const amount = trade.total_amount || (trade.quantity * trade.price);
      return {
        date,
        amount: trade.trade_type === 'buy' ? -Math.abs(amount) : Math.abs(amount)
      };
    });

    // Start value = 0 (portfolio didn't exist before first trade)
    const modDietzReturn = calculateModifiedDietz(0, currentValuation, cashFlows, daysHeld);

    if (modDietzReturn === null) {
      return { value: null, warning: 'No se pudo calcular Modified Dietz' };
    }

    // For short periods, don't annualize
    if (daysHeld < 365) {
      return {
        value: modDietzReturn * 100,
        warning: `Retorno de ${daysHeld} días (no anualizado)`
      };
    }

    // Annualize for periods >= 1 year
    const annualized = annualizeReturn(modDietzReturn, daysHeld);

    return { value: annualized };
  }, [trades, currentValuation, currentInvested, enabled]);

  return {
    xirr: xirrResult,
    ytd: ytdResult,
    twr: twrResult,
    isLoading: false, // Currently all synchronous
    error: null
  };
}

export default usePerformanceMetrics;
