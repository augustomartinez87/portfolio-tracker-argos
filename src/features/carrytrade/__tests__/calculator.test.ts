/**
 * Carry Trade Tests
 * Tests unitarios para validar cálculos matemáticos del módulo carry trade
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CarryTradeCalculator, parseDate } from '../calculator';
import type { Bond } from '../models';

describe('CarryTradeCalculator', () => {
  let calculator: CarryTradeCalculator;
  
  // Bono de ejemplo para testing
  const mockBond: Bond = {
    ticker: 'TEST30',
    maturityDate: new Date('2026-06-30'),
    payoff: 146.794,
    currentPrice: 100.0,
    bondType: 'LECAP'
  };

  beforeEach(() => {
    calculator = new CarryTradeCalculator();
  });

  describe('calculateDaysToMaturity', () => {
    it('should calculate correct days to maturity', () => {
      const days = calculator.calculateDaysToMaturity(mockBond);
      expect(days).toBeGreaterThan(0);
      
      // Calcular manualmente para verificar
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const maturity = new Date('2026-06-30');
      maturity.setHours(0, 0, 0, 0);
      const expectedDays = Math.ceil((maturity.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      expect(days).toBe(expectedDays);
    });

    it('should return 0 for matured bond', () => {
      const maturedBond: Bond = {
        ...mockBond,
        maturityDate: new Date('2020-01-01') // Fecha pasada
      };
      
      const days = calculator.calculateDaysToMaturity(maturedBond);
      expect(days).toBe(0);
    });
  });

  describe('calculateBreakeven', () => {
    it('should calculate correct breakeven rate', () => {
      const mepRate = 1000;
      const breakeven = calculator.calculateBreakeven(mockBond, mepRate);
      
      // Fórmula: (Payoff / Precio) × TC
      // (146.794 / 100) × 1000 = 1467.94
      const expected = (mockBond.payoff / mockBond.currentPrice) * mepRate;
      
      expect(breakeven).toBe(expected);
      expect(breakeven).toBeCloseTo(1467.94, 2);
    });

    it('should throw error for zero price', () => {
      const invalidBond: Bond = {
        ...mockBond,
        currentPrice: 0
      };
      
      expect(() => calculator.calculateBreakeven(invalidBond, 1000))
        .toThrow('El precio actual del bono debe ser mayor a 0');
    });
  });

  describe('calculateReturnUsd', () => {
    it('should calculate return USD for stable MEP', () => {
      const mepRate = 1000;
      const returnUsd = calculator.calculateReturnUsd(mockBond, mepRate, mepRate);
      
      // Fórmula: [(Payoff / TC) / (Precio / TC)] - 1
      // [(146.794 / 1000) / (100 / 1000)] - 1
      // [0.146794 / 0.1] - 1 = 0.46794 = 46.794%
      const expected = ((mockBond.payoff / mepRate) / (mockBond.currentPrice / mepRate) - 1) * 100;
      
      expect(returnUsd).toBe(expected);
      expect(returnUsd).toBeCloseTo(46.794, 2);
    });

    it('should calculate negative return when MEP devalues', () => {
      const initialMep = 1000;
      const finalMep = 1500; // 50% devaluación
      
      const returnUsd = calculator.calculateReturnUsd(mockBond, initialMep, finalMep);
      
      // Con devaluación de 50%, el retorno debería ser menor
      expect(returnUsd).toBeLessThan(0);
    });

    it('should throw error for invalid MEP rates', () => {
      expect(() => calculator.calculateReturnUsd(mockBond, 0, 1000))
        .toThrow('Los tipos de cambio deben ser mayores a 0');
      
      expect(() => calculator.calculateReturnUsd(mockBond, 1000, 0))
        .toThrow('Los tipos de cambio deben ser mayores a 0');
    });
  });

  describe('calculateMaxVariation', () => {
    it('should calculate max variation correctly', () => {
      const mepRate = 1000;
      const maxVar = calculator.calculateMaxVariation(mockBond, mepRate);
      
      // Fórmula: [(TC_breakeven / TC_inicial) - 1] × 100
      // TC_breakeven = (146.794 / 100) × 1000 = 1467.94
      // [(1467.94 / 1000) - 1] × 100 = 46.794%
      const breakeven = (mockBond.payoff / mockBond.currentPrice) * mepRate;
      const expected = ((breakeven / mepRate) - 1) * 100;
      
      expect(maxVar).toBe(expected);
      expect(maxVar).toBeCloseTo(46.794, 2);
    });
  });

  describe('calculateBands', () => {
    it('should calculate bands correctly', () => {
      const mepRate = 1000;
      const days = 365;
      const [upperBand, lowerBand] = calculator.calculateBands(mepRate, days);
      
      // Upper: 1000 × (1.01)^12.17 × 1.05
      // Lower: 1000 × 0.95
      expect(upperBand).toBeGreaterThan(mepRate);
      expect(lowerBand).toBeLessThan(mepRate);
      expect(upperBand).toBeGreaterThan(lowerBand);
      expect(lowerBand).toBe(950); // 1000 × 0.95
    });

    it('should return same rate for zero or negative days', () => {
      const mepRate = 1000;
      const [upperBand, lowerBand] = calculator.calculateBands(mepRate, 0);
      
      expect(upperBand).toBe(mepRate);
      expect(lowerBand).toBe(mepRate);
    });
  });

  describe('calculateTirUsd', () => {
    it('should calculate TIR USD correctly', () => {
      const mepRate = 1000;
      const tir = calculator.calculateTirUsd(mockBond, mepRate, mepRate);
      
      // TIR anualizada para retorno del 46.794% en ~1.4 años
      // Debería ser mayor al retorno simple anualizado
      expect(tir).toBeGreaterThan(0);
      expect(tir).toBeGreaterThan(30); // Aproximadamente 30% anual
    });

    it('should return 0 for matured bond', () => {
      const maturedBond: Bond = {
        ...mockBond,
        maturityDate: new Date('2020-01-01')
      };
      
      const tir = calculator.calculateTirUsd(maturedBond, 1000, 1000);
      expect(tir).toBe(0);
    });
  });

  describe('analyzeBond', () => {
    it('should return complete analysis', () => {
      const mepRate = 1000;
      const result = calculator.analyzeBond(mockBond, mepRate);
      
      expect(result.bond).toEqual(mockBond);
      expect(result.mepRate).toBe(mepRate);
      expect(result.breakevenRate).toBeGreaterThan(0);
      expect(result.totalReturnUsd).toBeGreaterThan(0);
      expect(result.maxVariation).toBeGreaterThan(0);
      expect(result.upperBand).toBeGreaterThan(result.lowerBand);
      expect(result.tirUsd).toBeGreaterThan(0);
    });

    it('should throw error for invalid MEP', () => {
      expect(() => calculator.analyzeBond(mockBond, 0))
        .toThrow('El tipo de cambio MEP debe ser mayor a 0');
      
      expect(() => calculator.analyzeBond(mockBond, -100))
        .toThrow('El tipo de cambio MEP debe ser mayor a 0');
    });

    it('should throw error for matured bond', () => {
      const maturedBond: Bond = {
        ...mockBond,
        maturityDate: new Date('2020-01-01')
      };
      
      expect(() => calculator.analyzeBond(maturedBond, 1000))
        .toThrow('ya venció');
    });
  });

  describe('analyzeBonds', () => {
    it('should analyze multiple bonds', () => {
      const bonds: Bond[] = [
        mockBond,
        {
          ...mockBond,
          ticker: 'TEST31',
          payoff: 150,
          currentPrice: 110
        }
      ];
      
      const mepRate = 1000;
      const results = calculator.analyzeBonds(bonds, mepRate);
      
      expect(results).toHaveLength(2);
      expect(results[0].mepRate).toBe(mepRate);
      expect(results[1].mepRate).toBe(mepRate);
    });

    it('should sort results correctly', () => {
      const bonds: Bond[] = [
        { ...mockBond, ticker: 'LOW', payoff: 110, currentPrice: 100 },
        { ...mockBond, ticker: 'HIGH', payoff: 150, currentPrice: 100 }
      ];
      
      const mepRate = 1000;
      
      // Orden descendente por retorno
      const resultsDesc = calculator.analyzeBonds(bonds, mepRate, 'totalReturnUsd', false);
      expect(resultsDesc[0].bond.ticker).toBe('HIGH');
      
      // Orden ascendente por retorno
      const resultsAsc = calculator.analyzeBonds(bonds, mepRate, 'totalReturnUsd', true);
      expect(resultsAsc[0].bond.ticker).toBe('LOW');
    });

    it('should skip bonds with errors', () => {
      const bonds: Bond[] = [
        mockBond,
        { ...mockBond, ticker: 'INVALID', currentPrice: 0 }
      ];
      
      const mepRate = 1000;
      const results = calculator.analyzeBonds(bonds, mepRate);
      
      // Solo debería retornar el bono válido
      expect(results).toHaveLength(1);
      expect(results[0].bond.ticker).toBe('TEST30');
    });
  });

  describe('calculateSummary', () => {
    it('should calculate summary correctly', () => {
      const mepRate = 1000;
      const results = calculator.analyzeBonds([mockBond], mepRate);
      const summary = calculator.calculateSummary(results, mepRate);
      
      expect(summary.mepRate).toBe(mepRate);
      expect(summary.totalBonds).toBe(1);
      expect(summary.positiveReturnBonds).toBeGreaterThanOrEqual(0);
      expect(summary.bestBondByReturn).toBeDefined();
      expect(summary.averageReturnUsd).toBeGreaterThan(0);
    });

    it('should handle empty results', () => {
      const mepRate = 1000;
      const summary = calculator.calculateSummary([], mepRate);
      
      expect(summary.totalBonds).toBe(0);
      expect(summary.bestBondByReturn).toBeNull();
      expect(summary.averageReturnUsd).toBe(0);
    });
  });
});

describe('parseDate', () => {
  it('should parse valid date string', () => {
    const date = parseDate('2026-06-30');
    expect(date).toBeInstanceOf(Date);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(5); // Junio = 5 (0-indexed)
    expect(date.getDate()).toBe(30);
  });

  it('should throw error for invalid date string', () => {
    expect(() => parseDate('invalid')).toThrow('Fecha inválida');
    expect(() => parseDate('')).toThrow('Fecha inválida');
    expect(() => parseDate('2026-13-45')).toThrow('Fecha inválida');
  });
});

// Test de integración con bonos reales
describe('Integration with real bond data', () => {
  const calculator = new CarryTradeCalculator();

  it('should correctly analyze T30E6-like bond', () => {
    const t30e6Like: Bond = {
      ticker: 'T30E6',
      maturityDate: new Date('2026-01-30'),
      payoff: 142.22,
      currentPrice: 100.0,
      bondType: 'LECAP'
    };

    const mepRate = 1500;
    const result = calculator.analyzeBond(t30e6Like, mepRate);

    // Breakeven: (142.22 / 100) × 1500 = 2133.30
    expect(result.breakevenRate).toBeCloseTo(2133.30, 2);

    // Retorno USD: (142.22 / 1500) / (100 / 1500) - 1 = 42.22%
    expect(result.totalReturnUsd).toBeCloseTo(42.22, 2);

    // Máx variación: [(2133.30 / 1500) - 1] × 100 = 42.22%
    expect(result.maxVariation).toBeCloseTo(42.22, 2);
  });

  it('should correctly analyze bond with high discount', () => {
    const discountedBond: Bond = {
      ticker: 'DISC',
      maturityDate: new Date('2026-12-31'),
      payoff: 200,
      currentPrice: 80, // 60% de descuento
      bondType: 'BONCAP'
    };

    const mepRate = 1500;
    const result = calculator.analyzeBond(discountedBond, mepRate);

    // Retorno: (200 / 80 - 1) = 150%
    expect(result.totalReturnUsd).toBeCloseTo(150, 2);

    // Breakeven: (200 / 80) × 1500 = 3750
    expect(result.breakevenRate).toBeCloseTo(3750, 2);
  });
});

// Test de validación de configuración
describe('Configuration validation', () => {
  it('should use default configuration', () => {
    const calculator = new CarryTradeCalculator();
    
    const mepRate = 1000;
    const days = 30; // 1 mes
    const [upper, lower] = calculator.calculateBands(mepRate, days);
    
    // Con configuración default (1% mensual, 1.05 multiplicador)
    // Upper: 1000 × (1.01)^1 × 1.05 = 1060.5
    expect(upper).toBeCloseTo(1060.5, 2);
    // Lower: 1000 × 0.95 = 950
    expect(lower).toBe(950);
  });

  it('should accept custom configuration', () => {
    const calculator = new CarryTradeCalculator({
      monthlyInflation: 0.02,      // 2% mensual
      upperBandMultiplier: 1.10    // 10% margen
    });
    
    const mepRate = 1000;
    const days = 30;
    const [upper, lower] = calculator.calculateBands(mepRate, days);
    
    // Upper: 1000 × (1.02)^1 × 1.10 = 1122
    expect(upper).toBeCloseTo(1122, 2);
    // Lower debería seguir siendo el default: 950
    expect(lower).toBe(950);
  });
});
