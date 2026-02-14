import Decimal from 'decimal.js';

/**
 * Performance Metrics Service
 *
 * Provides calculations for:
 * - XIRR (Extended Internal Rate of Return) - Money weighted return
 * - YTD (Year to Date Return) - Simple return since Jan 1
 * - TWR (Time Weighted Return) - Return eliminating cash flow effects
 */

export interface CashFlow {
  date: Date;
  amount: number; // negative = outflow (buy), positive = inflow (sell/current value)
}

export interface MetricResult<T> {
  value: T | null;
  warning?: string;
  error?: string;
}

/**
 * Calculate XIRR (Extended Internal Rate of Return)
 * Uses Newton-Raphson method with bisection fallback
 *
 * @param cashFlows Array of cash flows with dates and amounts
 *   - Buy trades: negative amounts (money going out)
 *   - Sell trades: positive amounts (money coming in)
 *   - Final valuation: positive amount (current portfolio value)
 * @returns Annualized return as percentage (e.g., 15.5 for 15.5%), or null if calculation fails
 */
export function calculateXIRR(cashFlows: CashFlow[]): number | null {
  if (cashFlows.length < 2) return null;

  // Sort by date ascending
  const sorted = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Validate: need at least one negative and one positive flow
  const hasNegative = sorted.some(cf => cf.amount < 0);
  const hasPositive = sorted.some(cf => cf.amount > 0);
  if (!hasNegative || !hasPositive) return null;

  const firstDate = sorted[0].date.getTime();
  const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

  // NPV function: sum of discounted cash flows
  const npv = (rate: number): number => {
    return sorted.reduce((acc, cf) => {
      const years = (cf.date.getTime() - firstDate) / MS_PER_YEAR;
      const denominator = Math.pow(1 + rate, years);
      if (denominator === 0 || !isFinite(denominator)) return acc;
      return acc + cf.amount / denominator;
    }, 0);
  };

  // Derivative of NPV for Newton-Raphson
  const npvDerivative = (rate: number): number => {
    return sorted.reduce((acc, cf) => {
      const years = (cf.date.getTime() - firstDate) / MS_PER_YEAR;
      if (years === 0) return acc;
      const denominator = Math.pow(1 + rate, years + 1);
      if (denominator === 0 || !isFinite(denominator)) return acc;
      return acc - (years * cf.amount) / denominator;
    }, 0);
  };

  // Newton-Raphson iteration
  let guess = 0.1; // Start with 10%
  const tolerance = 1e-7;
  const maxIterations = 100;

  for (let i = 0; i < maxIterations; i++) {
    const npvValue = npv(guess);

    if (Math.abs(npvValue) < tolerance) {
      return guess * 100; // Convert to percentage
    }

    const derivValue = npvDerivative(guess);
    if (Math.abs(derivValue) < 1e-10) break; // Avoid division by zero

    let nextGuess = guess - npvValue / derivValue;

    // Bounds check - keep rate reasonable (-99% to 1000%)
    if (nextGuess < -0.99) nextGuess = -0.99;
    if (nextGuess > 10) nextGuess = 10;

    if (Math.abs(nextGuess - guess) < tolerance) {
      return nextGuess * 100;
    }

    guess = nextGuess;
  }

  // Fallback: Bisection method for robustness
  return bisectionXIRR(npv);
}

/**
 * Bisection method fallback for XIRR when Newton-Raphson fails
 */
function bisectionXIRR(npvFn: (rate: number) => number): number | null {
  let low = -0.99;
  let high = 10;
  const tolerance = 1e-6;
  const maxIterations = 200;

  // Find bounds where NPV changes sign
  const npvLow = npvFn(low);
  const npvHigh = npvFn(high);

  if (npvLow * npvHigh > 0) {
    // Same sign - try to find crossing point
    for (let rate = -0.9; rate < 5; rate += 0.1) {
      if (npvFn(rate) * npvFn(rate + 0.1) < 0) {
        low = rate;
        high = rate + 0.1;
        break;
      }
    }
  }

  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const npvValue = npvFn(mid);

    if (Math.abs(npvValue) < tolerance) {
      return mid * 100;
    }

    if (npvFn(low) * npvValue < 0) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return null; // Did not converge
}

/**
 * Calculate XIRR with diagnostic information
 */
export function calculateXIRRWithDiagnostics(cashFlows: CashFlow[]): MetricResult<number> {
  if (cashFlows.length < 2) {
    return { value: null, warning: 'Se necesitan al menos 2 transacciones' };
  }

  const hasNegative = cashFlows.some(cf => cf.amount < 0);
  const hasPositive = cashFlows.some(cf => cf.amount > 0);

  if (!hasNegative) {
    return { value: null, warning: 'No hay compras registradas' };
  }
  if (!hasPositive) {
    return { value: null, warning: 'No hay valor actual positivo' };
  }

  try {
    const result = calculateXIRR(cashFlows);

    if (result === null) {
      return { value: null, error: 'El cálculo no convergió' };
    }

    // Check for extreme values that might indicate data issues
    if (result < -95) {
      return { value: result, warning: 'Retorno muy negativo - verificar datos' };
    }
    if (result > 500) {
      return { value: result, warning: 'Retorno muy alto - puede ser por período corto' };
    }

    return { value: result };
  } catch (err) {
    return { value: null, error: err instanceof Error ? err.message : 'Error desconocido' };
  }
}

/**
 * Calculate YTD (Year-to-Date) return
 * Uses Modified Dietz method: (EndValue - StartValue - NetFlows) / StartValue
 *
 * @param startValue Portfolio value at start of year (Jan 1 or first trade date)
 * @param endValue Current portfolio value
 * @param netFlows Sum of cash flows during the period (buys positive, sells negative)
 * @returns YTD return as percentage, or null if calculation not possible
 */
export function calculateYTD(
  startValue: number,
  endValue: number,
  netFlows: number
): number | null {
  // If no starting value, we can't calculate YTD
  if (startValue <= 0) return null;

  // Simple YTD formula (Modified Dietz approximation)
  const gain = endValue - startValue - netFlows;
  const ytd = (gain / startValue) * 100;

  return ytd;
}

/**
 * Calculate YTD with diagnostics
 */
export function calculateYTDWithDiagnostics(
  startValue: number,
  endValue: number,
  netFlows: number,
  isFirstYearPortfolio: boolean = false
): MetricResult<number> {
  if (startValue <= 0) {
    if (isFirstYearPortfolio && netFlows > 0) {
      // Portfolio started this year - calculate return on invested capital
      const gain = endValue - netFlows;
      const ytd = (gain / netFlows) * 100;
      return { value: ytd, warning: 'Calculado desde primer aporte del año' };
    }
    return { value: null, warning: 'Sin valor inicial para calcular YTD' };
  }

  const ytd = calculateYTD(startValue, endValue, netFlows);

  if (ytd === null) {
    return { value: null, error: 'Error en cálculo YTD' };
  }

  return { value: ytd };
}

/**
 * Calculate Modified Dietz Return
 *
 * Better than simple TWR when historical valuations are unavailable.
 * Weights each cash flow by the fraction of the period it was invested.
 *
 * R = (V1 - V0 - CF) / (V0 + Σ(CF_i × W_i))
 * where W_i = (T - t_i) / T is the time weight of each flow.
 *
 * @param startValue Portfolio value at start (V0) - estimated from cumulative invested before period
 * @param endValue Portfolio value at end (V1) - current valuation
 * @param cashFlows Cash flows during the period (negative = buy, positive = sell)
 * @param totalDays Total days in the period (T)
 * @returns Modified Dietz return as decimal (e.g., 0.15 for 15%), or null
 */
export function calculateModifiedDietz(
  startValue: number,
  endValue: number,
  cashFlows: CashFlow[],
  totalDays: number
): number | null {
  if (totalDays <= 0) return null;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - totalDays);
  const startTime = startDate.getTime();
  const msPerDay = 1000 * 60 * 60 * 24;

  // Sum of cash flows
  let totalCF = 0;
  // Sum of time-weighted cash flows
  let weightedCF = 0;

  for (const cf of cashFlows) {
    const daysSinceStart = (cf.date.getTime() - startTime) / msPerDay;
    const weight = Math.max(0, Math.min(1, (totalDays - daysSinceStart) / totalDays));
    // For Modified Dietz, we use the absolute flow direction:
    // buys (negative amounts) increase the denominator, sells (positive) decrease it
    totalCF += cf.amount;
    weightedCF += cf.amount * weight;
  }

  const denominator = startValue + weightedCF;
  if (denominator <= 0) return null;

  const gain = endValue - startValue - totalCF;
  return gain / denominator;
}

/**
 * Calculate TWR (Time Weighted Return)
 * Chains sub-period returns to eliminate effect of cash flows
 *
 * @param periodReturns Array of decimal returns for each sub-period (e.g., 0.05 for 5%)
 * @returns TWR as percentage, or null if no periods
 */
export function calculateTWR(periodReturns: number[]): number | null {
  if (periodReturns.length === 0) return null;

  // Chain returns: TWR = [(1+r1) * (1+r2) * ... * (1+rn)] - 1
  const cumulativeReturn = periodReturns.reduce((acc, r) => {
    return acc * (1 + r);
  }, 1);

  return (cumulativeReturn - 1) * 100;
}

/**
 * Calculate a single period return for TWR
 *
 * @param startValue Value at start of period
 * @param endValue Value at end of period (before any cash flow)
 * @returns Decimal return (e.g., 0.05 for 5%)
 */
export function calculatePeriodReturn(startValue: number, endValue: number): number {
  if (startValue <= 0) return 0;
  return (endValue - startValue) / startValue;
}

/**
 * Annualize a return based on number of days
 *
 * @param totalReturn Total return as decimal (e.g., 0.15 for 15%)
 * @param days Number of days in the period
 * @returns Annualized return as percentage
 */
export function annualizeReturn(totalReturn: number, days: number): number {
  if (days <= 0) return 0;

  // For very short periods, just scale linearly to avoid extreme numbers
  if (days < 30) {
    return totalReturn * (365 / days) * 100;
  }

  // Compound annualization: (1 + r)^(365/days) - 1
  const annualized = Math.pow(1 + totalReturn, 365 / days) - 1;
  return annualized * 100;
}

/**
 * Convert trades to cash flows for XIRR calculation
 *
 * @param trades Array of trades from the database
 * @param currentValuation Current portfolio value to add as final cash flow
 * @param currency Currency to use for amounts ('ARS' or 'USD')
 * @returns Array of cash flows suitable for XIRR calculation
 */
export function tradesToCashFlows(
  trades: Array<{
    trade_date: string | Date;
    trade_type: 'buy' | 'sell';
    total_amount: number;
    quantity: number;
    price: number;
  }>,
  currentValuation: number,
  currency: 'ARS' | 'USD' = 'ARS'
): CashFlow[] {
  const cashFlows: CashFlow[] = trades.map(trade => {
    const date = trade.trade_date instanceof Date
      ? trade.trade_date
      : new Date(trade.trade_date);

    // Use total_amount if available, otherwise calculate from quantity * price
    const amount = trade.total_amount || (trade.quantity * trade.price);

    return {
      date,
      // Buy = money going out (negative), Sell = money coming in (positive)
      amount: trade.trade_type === 'buy' ? -Math.abs(amount) : Math.abs(amount)
    };
  });

  // Add current valuation as final positive cash flow
  cashFlows.push({
    date: new Date(),
    amount: currentValuation
  });

  return cashFlows;
}

/**
 * Calculate net flows for a period (for YTD calculation)
 *
 * @param trades Trades during the period
 * @returns Net cash outflow (positive = net investment, negative = net withdrawal)
 */
export function calculateNetFlows(
  trades: Array<{
    trade_type: 'buy' | 'sell';
    total_amount: number;
    quantity: number;
    price: number;
  }>
): number {
  return trades.reduce((sum, trade) => {
    const amount = trade.total_amount || (trade.quantity * trade.price);
    // Buys increase invested capital (positive), sells decrease it (negative)
    return sum + (trade.trade_type === 'buy' ? amount : -amount);
  }, 0);
}
