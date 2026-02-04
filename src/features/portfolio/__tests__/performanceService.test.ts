/**
 * Performance Metrics Tests
 * Unit tests for XIRR, YTD, and TWR calculations
 */

import { describe, it, expect } from 'vitest';
import {
  calculateXIRR,
  calculateXIRRWithDiagnostics,
  calculateYTD,
  calculateYTDWithDiagnostics,
  calculateTWR,
  calculatePeriodReturn,
  annualizeReturn,
  tradesToCashFlows,
  calculateNetFlows,
  CashFlow
} from '../services/performanceService';

describe('XIRR Calculation', () => {
  describe('Basic scenarios', () => {
    it('should calculate correct XIRR for simple buy-hold scenario (50% return in 1 year)', () => {
      // Buy 100 shares at $10 on Jan 1, worth $15 on Dec 31
      const cashFlows: CashFlow[] = [
        { date: new Date('2024-01-01'), amount: -1000 },
        { date: new Date('2024-12-31'), amount: 1500 }
      ];

      const xirr = calculateXIRR(cashFlows);

      // 50% return in ~365 days should be approximately 50% XIRR
      expect(xirr).not.toBeNull();
      expect(xirr!).toBeCloseTo(50, 0); // Within 1% tolerance
    });

    it('should calculate correct XIRR for 0% return', () => {
      const cashFlows: CashFlow[] = [
        { date: new Date('2024-01-01'), amount: -1000 },
        { date: new Date('2024-12-31'), amount: 1000 }
      ];

      const xirr = calculateXIRR(cashFlows);

      expect(xirr).not.toBeNull();
      expect(xirr!).toBeCloseTo(0, 1);
    });

    it('should calculate correct XIRR for negative return (loss)', () => {
      const cashFlows: CashFlow[] = [
        { date: new Date('2024-01-01'), amount: -1000 },
        { date: new Date('2024-12-31'), amount: 800 }
      ];

      const xirr = calculateXIRR(cashFlows);

      expect(xirr).not.toBeNull();
      expect(xirr!).toBeCloseTo(-20, 1); // -20% return
    });

    it('should handle multiple buys correctly', () => {
      const cashFlows: CashFlow[] = [
        { date: new Date('2024-01-01'), amount: -1000 },
        { date: new Date('2024-06-01'), amount: -1000 },
        { date: new Date('2024-12-31'), amount: 2200 }
      ];

      const xirr = calculateXIRR(cashFlows);

      // 2000 invested, 2200 final = 10% gain
      // But since second investment was halfway through year, XIRR will differ
      expect(xirr).not.toBeNull();
      expect(xirr!).toBeGreaterThan(0);
      expect(xirr!).toBeLessThan(20);
    });

    it('should handle partial sells during period', () => {
      const cashFlows: CashFlow[] = [
        { date: new Date('2024-01-01'), amount: -1000 },
        { date: new Date('2024-06-01'), amount: 300 }, // Sold some
        { date: new Date('2024-12-31'), amount: 900 }
      ];

      const xirr = calculateXIRR(cashFlows);

      // 1000 in, 1200 total out = 20% gain
      expect(xirr).not.toBeNull();
      expect(xirr!).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should return null for insufficient cash flows (single flow)', () => {
      const cashFlows: CashFlow[] = [
        { date: new Date('2024-01-01'), amount: -1000 }
      ];

      expect(calculateXIRR(cashFlows)).toBeNull();
    });

    it('should return null for empty cash flows', () => {
      expect(calculateXIRR([])).toBeNull();
    });

    it('should return null for all-positive flows', () => {
      const cashFlows: CashFlow[] = [
        { date: new Date('2024-01-01'), amount: 1000 },
        { date: new Date('2024-12-31'), amount: 1500 }
      ];

      expect(calculateXIRR(cashFlows)).toBeNull();
    });

    it('should return null for all-negative flows', () => {
      const cashFlows: CashFlow[] = [
        { date: new Date('2024-01-01'), amount: -1000 },
        { date: new Date('2024-12-31'), amount: -500 }
      ];

      expect(calculateXIRR(cashFlows)).toBeNull();
    });

    it('should handle same-day transactions', () => {
      const cashFlows: CashFlow[] = [
        { date: new Date('2024-01-01'), amount: -1000 },
        { date: new Date('2024-01-01'), amount: -500 },
        { date: new Date('2024-12-31'), amount: 2000 }
      ];

      const xirr = calculateXIRR(cashFlows);
      expect(xirr).not.toBeNull();
    });

    it('should handle very short period', () => {
      const cashFlows: CashFlow[] = [
        { date: new Date('2024-01-01'), amount: -1000 },
        { date: new Date('2024-01-15'), amount: 1010 } // 1% in 2 weeks
      ];

      const xirr = calculateXIRR(cashFlows);

      // Annualized should be much higher
      expect(xirr).not.toBeNull();
      expect(xirr!).toBeGreaterThan(20); // High annualized rate for short period
    });
  });

  describe('Argentine market scenarios', () => {
    it('should handle high inflation returns correctly (150% in 1 year)', () => {
      // Typical Argentine scenario: 150% nominal return in 1 year
      const cashFlows: CashFlow[] = [
        { date: new Date('2024-01-01'), amount: -1000000 },
        { date: new Date('2024-12-31'), amount: 2500000 }
      ];

      const xirr = calculateXIRR(cashFlows);

      expect(xirr).not.toBeNull();
      expect(xirr!).toBeCloseTo(150, 0); // Within 1% tolerance for high returns
    });

    it('should handle typical CEDEAR returns', () => {
      // Buy CEDEAR, appreciate 30% in 6 months
      const cashFlows: CashFlow[] = [
        { date: new Date('2024-01-01'), amount: -100000 },
        { date: new Date('2024-07-01'), amount: 130000 }
      ];

      const xirr = calculateXIRR(cashFlows);

      // 30% in 6 months should annualize to roughly 69%
      expect(xirr).not.toBeNull();
      expect(xirr!).toBeGreaterThan(50);
      expect(xirr!).toBeLessThan(100);
    });
  });

  describe('XIRR with diagnostics', () => {
    it('should return warning for insufficient data', () => {
      const cashFlows: CashFlow[] = [
        { date: new Date('2024-01-01'), amount: -1000 }
      ];

      const result = calculateXIRRWithDiagnostics(cashFlows);

      expect(result.value).toBeNull();
      expect(result.warning).toBeDefined();
    });

    it('should return warning for no purchases', () => {
      const cashFlows: CashFlow[] = [
        { date: new Date('2024-01-01'), amount: 1000 },
        { date: new Date('2024-12-31'), amount: 1500 }
      ];

      const result = calculateXIRRWithDiagnostics(cashFlows);

      expect(result.value).toBeNull();
      expect(result.warning).toContain('compras');
    });

    it('should return warning for extreme values', () => {
      const cashFlows: CashFlow[] = [
        { date: new Date('2024-01-01'), amount: -100 },
        { date: new Date('2024-01-15'), amount: 1000 } // 900% in 2 weeks
      ];

      const result = calculateXIRRWithDiagnostics(cashFlows);

      expect(result.value).not.toBeNull();
      // High annualized return should trigger warning
      expect(result.warning).toBeDefined();
    });
  });
});

describe('YTD Calculation', () => {
  describe('Basic scenarios', () => {
    it('should calculate positive YTD correctly', () => {
      const ytd = calculateYTD(1000, 1200, 0);

      // (1200 - 1000 - 0) / 1000 = 20%
      expect(ytd).toBe(20);
    });

    it('should calculate negative YTD correctly', () => {
      const ytd = calculateYTD(1000, 800, 0);

      // (800 - 1000 - 0) / 1000 = -20%
      expect(ytd).toBe(-20);
    });

    it('should handle net flows (additional investments)', () => {
      const ytd = calculateYTD(1000, 1300, 200);

      // (1300 - 1000 - 200) / 1000 = 10%
      expect(ytd).toBe(10);
    });

    it('should handle withdrawals (negative net flows)', () => {
      const ytd = calculateYTD(1000, 700, -200);

      // (700 - 1000 - (-200)) / 1000 = -10%
      expect(ytd).toBe(-10);
    });

    it('should return null for zero start value', () => {
      const ytd = calculateYTD(0, 1000, 0);
      expect(ytd).toBeNull();
    });
  });

  describe('YTD with diagnostics', () => {
    it('should handle first year portfolio', () => {
      const result = calculateYTDWithDiagnostics(0, 1200, 1000, true);

      // Portfolio started this year with 1000 invested, now worth 1200
      // Return = (1200 - 1000) / 1000 = 20%
      expect(result.value).toBe(20);
      expect(result.warning).toContain('primer aporte');
    });

    it('should return warning for no start value and not first year', () => {
      const result = calculateYTDWithDiagnostics(0, 1200, 1000, false);

      expect(result.value).toBeNull();
      expect(result.warning).toContain('valor inicial');
    });
  });
});

describe('TWR Calculation', () => {
  describe('Basic scenarios', () => {
    it('should calculate TWR with single period', () => {
      const periodReturns = [0.1]; // 10% return
      const twr = calculateTWR(periodReturns);

      expect(twr).toBeCloseTo(10, 5);
    });

    it('should chain multiple period returns', () => {
      const periodReturns = [0.1, 0.2]; // 10% then 20%
      const twr = calculateTWR(periodReturns);

      // (1.1 * 1.2) - 1 = 0.32 = 32%
      expect(twr).toBeCloseTo(32, 5);
    });

    it('should handle negative returns', () => {
      const periodReturns = [0.1, -0.1]; // 10% gain, then 10% loss
      const twr = calculateTWR(periodReturns);

      // (1.1 * 0.9) - 1 = -0.01 = -1%
      expect(twr).toBeCloseTo(-1, 1);
    });

    it('should return null for empty periods', () => {
      expect(calculateTWR([])).toBeNull();
    });
  });

  describe('Period return calculation', () => {
    it('should calculate period return correctly', () => {
      const periodReturn = calculatePeriodReturn(100, 120);
      expect(periodReturn).toBe(0.2); // 20%
    });

    it('should handle zero start value', () => {
      const periodReturn = calculatePeriodReturn(0, 100);
      expect(periodReturn).toBe(0);
    });

    it('should calculate negative return', () => {
      const periodReturn = calculatePeriodReturn(100, 80);
      expect(periodReturn).toBe(-0.2); // -20%
    });
  });
});

describe('Annualize Return', () => {
  it('should annualize 6-month return', () => {
    const totalReturn = 0.15; // 15% in 6 months
    const days = 182; // ~6 months

    const annualized = annualizeReturn(totalReturn, days);

    // Compound: (1.15)^(365/182) - 1 ≈ 32.25%
    expect(annualized).toBeGreaterThan(30);
    expect(annualized).toBeLessThan(35);
  });

  it('should not compound short periods (< 30 days)', () => {
    const totalReturn = 0.05; // 5% in 10 days
    const days = 10;

    const annualized = annualizeReturn(totalReturn, days);

    // Linear: 5% * (365/10) = 182.5%
    expect(annualized).toBeCloseTo(182.5, 0);
  });

  it('should return 0 for zero days', () => {
    expect(annualizeReturn(0.1, 0)).toBe(0);
  });
});

describe('Trades to Cash Flows conversion', () => {
  it('should convert buy trades to negative cash flows', () => {
    const trades = [
      { trade_date: '2024-01-15', trade_type: 'buy' as const, total_amount: 1000, quantity: 10, price: 100 }
    ];

    const cashFlows = tradesToCashFlows(trades, 1500, 'ARS');

    expect(cashFlows).toHaveLength(2); // 1 trade + 1 final valuation
    expect(cashFlows[0].amount).toBe(-1000);
  });

  it('should convert sell trades to positive cash flows', () => {
    const trades = [
      { trade_date: '2024-01-15', trade_type: 'buy' as const, total_amount: 1000, quantity: 10, price: 100 },
      { trade_date: '2024-06-15', trade_type: 'sell' as const, total_amount: 600, quantity: 5, price: 120 }
    ];

    const cashFlows = tradesToCashFlows(trades, 800, 'ARS');

    expect(cashFlows).toHaveLength(3); // 2 trades + 1 final valuation
    expect(cashFlows[0].amount).toBe(-1000); // Buy
    expect(cashFlows[1].amount).toBe(600); // Sell
    expect(cashFlows[2].amount).toBe(800); // Final valuation
  });

  it('should add current valuation as final positive flow', () => {
    const trades = [
      { trade_date: '2024-01-15', trade_type: 'buy' as const, total_amount: 1000, quantity: 10, price: 100 }
    ];

    const currentValuation = 1500;
    const cashFlows = tradesToCashFlows(trades, currentValuation, 'ARS');

    const lastFlow = cashFlows[cashFlows.length - 1];
    expect(lastFlow.amount).toBe(currentValuation);
    expect(lastFlow.date.toDateString()).toBe(new Date().toDateString());
  });
});

describe('Net Flows Calculation', () => {
  it('should calculate net investment (buys only)', () => {
    const trades = [
      { trade_type: 'buy' as const, total_amount: 1000, quantity: 10, price: 100 },
      { trade_type: 'buy' as const, total_amount: 500, quantity: 5, price: 100 }
    ];

    const netFlows = calculateNetFlows(trades);

    expect(netFlows).toBe(1500); // 1000 + 500
  });

  it('should calculate net withdrawal (sells exceed buys)', () => {
    const trades = [
      { trade_type: 'buy' as const, total_amount: 1000, quantity: 10, price: 100 },
      { trade_type: 'sell' as const, total_amount: 1500, quantity: 10, price: 150 }
    ];

    const netFlows = calculateNetFlows(trades);

    expect(netFlows).toBe(-500); // 1000 - 1500
  });

  it('should handle mixed trades', () => {
    const trades = [
      { trade_type: 'buy' as const, total_amount: 1000, quantity: 10, price: 100 },
      { trade_type: 'sell' as const, total_amount: 300, quantity: 2, price: 150 },
      { trade_type: 'buy' as const, total_amount: 500, quantity: 5, price: 100 }
    ];

    const netFlows = calculateNetFlows(trades);

    expect(netFlows).toBe(1200); // 1000 - 300 + 500
  });

  it('should return 0 for empty trades', () => {
    expect(calculateNetFlows([])).toBe(0);
  });
});

describe('Integration tests', () => {
  it('should calculate realistic portfolio XIRR', () => {
    // Simulate a real portfolio: multiple buys over time, current value
    const trades = [
      { trade_date: '2024-01-15', trade_type: 'buy' as const, total_amount: 100000, quantity: 100, price: 1000 },
      { trade_date: '2024-03-01', trade_type: 'buy' as const, total_amount: 50000, quantity: 45, price: 1111 },
      { trade_date: '2024-06-15', trade_type: 'sell' as const, total_amount: 30000, quantity: 20, price: 1500 },
      { trade_date: '2024-09-01', trade_type: 'buy' as const, total_amount: 75000, quantity: 50, price: 1500 }
    ];

    // Current portfolio: 175 shares at 1600 each = 280,000
    const currentValuation = 280000;

    const cashFlows = tradesToCashFlows(trades, currentValuation, 'ARS');
    const xirr = calculateXIRR(cashFlows);

    expect(xirr).not.toBeNull();
    // Should be a reasonable positive return
    expect(xirr!).toBeGreaterThan(0);
  });
});
