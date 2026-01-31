/**
 * Carry Trade Calculator
 * Motor de cálculo matemático preciso para operaciones de carry trade
 */

import type { Bond, CarryTradeResult, CarryTradeConfig } from './models';

/**
 * Clase principal para cálculos de carry trade
 * Implementa todas las fórmulas matemáticas con precisión decimal
 */
export class CarryTradeCalculator {
  private config: CarryTradeConfig;

  /**
   * Crea una nueva instancia del calculador
   * @param config Configuración del calculador (usa defaults si no se proporciona)
   */
  constructor(config?: Partial<CarryTradeConfig>) {
    this.config = {
      monthlyInflation: 0.01,      // 1% mensual por defecto
      lowerBandTolerance: 0.95,    // 5% de margen inferior
      upperBandMultiplier: 1.05,   // 5% de margen superior
      ...config
    };
  }

  /**
   * Calcula los días hasta el vencimiento del bono
   * @param bond Bono a analizar
   * @returns Número de días hasta el vencimiento
   */
  calculateDaysToMaturity(bond: Bond): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maturity = new Date(bond.maturityDate);
    maturity.setHours(0, 0, 0, 0);
    
    const diffTime = maturity.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }

  /**
   * Calcula el tipo de cambio breakeven
   * Fórmula: TC_breakeven = (Payoff / Precio_compra) × TC_inicial
   * 
   * @param bond Bono a analizar
   * @param mepRate Tipo de cambio MEP inicial
   * @returns Tipo de cambio breakeven
   */
  calculateBreakeven(bond: Bond, mepRate: number): number {
    if (bond.currentPrice <= 0) {
      throw new Error('El precio actual del bono debe ser mayor a 0');
    }
    
    return (bond.payoff / bond.currentPrice) * mepRate;
  }

  /**
   * Calcula el retorno en dólares para un tipo de cambio final proyectado
   * Fórmula: Retorno_USD = [(Payoff / TC_final) / (Precio / TC_inicial)] - 1
   * 
   * @param bond Bono a analizar
   * @param initialMep Tipo de cambio MEP inicial
   * @param finalMep Tipo de cambio MEP final proyectado
   * @returns Retorno en USD como porcentaje (ej: 5.25 para 5.25%)
   */
  calculateReturnUsd(
    bond: Bond,
    initialMep: number,
    finalMep: number
  ): number {
    if (initialMep <= 0 || finalMep <= 0) {
      throw new Error('Los tipos de cambio deben ser mayores a 0');
    }
    
    if (bond.currentPrice <= 0) {
      throw new Error('El precio actual del bono debe ser mayor a 0');
    }

    const usdInitial = bond.currentPrice / initialMep;
    const usdFinal = bond.payoff / finalMep;
    
    return (usdFinal / usdInitial - 1) * 100;
  }

  /**
   * Calcula la máxima variación del tipo de cambio que puede absorber la operación
   * Fórmula: ((TC_breakeven / TC_inicial) - 1) × 100
   * 
   * @param bond Bono a analizar
   * @param mepRate Tipo de cambio MEP inicial
   * @returns Variación máxima en porcentaje
   */
  calculateMaxVariation(bond: Bond, mepRate: number): number {
    const breakeven = this.calculateBreakeven(bond, mepRate);
    return ((breakeven / mepRate) - 1) * 100;
  }

  /**
   * Calcula las bandas cambiarias proyectadas
   * - Banda superior: TC × (1 + inflación)^meses × 1.05
   * - Banda inferior: TC × 0.95 (estabilidad o leve apreciación)
   * 
   * @param mepRate Tipo de cambio MEP actual
   * @param days Días hasta el vencimiento
   * @returns Tupla [bandaSuperior, bandaInferior]
   */
  calculateBands(mepRate: number, days: number): [number, number] {
    if (days <= 0) {
      return [mepRate, mepRate];
    }

    const months = days / 30;
    
    // Banda superior: proyección con inflación + margen del 5%
    const upperBand = mepRate * 
      Math.pow(1 + this.config.monthlyInflation, months) * 
      this.config.upperBandMultiplier;
    
    // Banda inferior: 5% de margen por debajo
    const lowerBand = mepRate * this.config.lowerBandTolerance;
    
    return [upperBand, lowerBand];
  }

  /**
   * Calcula la TIR (Tasa Interna de Retorno) anualizada en USD
   * Fórmula: TIR = ((1 + return)^(365/dias) - 1) × 100
   * 
   * @param bond Bono a analizar
   * @param initialMep Tipo de cambio MEP inicial
   * @param finalMep Tipo de cambio MEP final proyectado
   * @returns TIR anualizada en USD como porcentaje
   */
  calculateTirUsd(
    bond: Bond,
    initialMep: number,
    finalMep: number
  ): number {
    const days = this.calculateDaysToMaturity(bond);
    
    if (days <= 0) {
      return 0;
    }

    const returnPct = this.calculateReturnUsd(bond, initialMep, finalMep);
    
    // TIR anualizada
    const tir = (Math.pow(1 + returnPct / 100, 365 / days) - 1) * 100;
    
    return tir;
  }

  /**
   * Calcula el spread vs tipo de cambio actual
   * Equivalente a la máxima variación posible
   * 
   * @param bond Bono a analizar
   * @param mepRate Tipo de cambio MEP actual
   * @returns Spread en puntos porcentuales
   */
  calculateSpreadVsTc(bond: Bond, mepRate: number): number {
    return this.calculateMaxVariation(bond, mepRate);
  }

  /**
   * Realiza un análisis completo de carry trade para un bono
   * 
   * @param bond Bono a analizar
   * @param mepRate Tipo de cambio MEP actual
   * @returns Resultado completo del análisis
   */
  analyzeBond(bond: Bond, mepRate: number): CarryTradeResult {
    // Validaciones
    if (mepRate <= 0) {
      throw new Error('El tipo de cambio MEP debe ser mayor a 0');
    }

    const days = this.calculateDaysToMaturity(bond);
    
    if (days <= 0) {
      throw new Error(`El bono ${bond.ticker} ya venció o vence hoy`);
    }

    if (bond.currentPrice <= 0) {
      throw new Error(`El bono ${bond.ticker} tiene precio inválido: ${bond.currentPrice}`);
    }

    // Cálculos principales
    const breakeven = this.calculateBreakeven(bond, mepRate);
    const returnUsd = this.calculateReturnUsd(bond, mepRate, mepRate);
    const maxVar = this.calculateMaxVariation(bond, mepRate);
    const [upperBand, lowerBand] = this.calculateBands(mepRate, days);
    const tir = this.calculateTirUsd(bond, mepRate, mepRate);
    const spread = this.calculateSpreadVsTc(bond, mepRate);

    return {
      bond,
      mepRate,
      breakevenRate: breakeven,
      totalReturnUsd: returnUsd,
      maxVariation: maxVar,
      spreadVsTc: spread,
      upperBand,
      lowerBand,
      tirUsd: tir
    };
  }

  /**
   * Analiza múltiples bonos y devuelve resultados ordenados
   * 
   * @param bonds Lista de bonos a analizar
   * @param mepRate Tipo de cambio MEP actual
   * @param sortBy Campo para ordenar ('totalReturnUsd' | 'tirUsd' | 'maxVariation')
   * @param ascending Orden ascendente (true) o descendente (false)
   * @returns Lista de resultados ordenados
   */
  analyzeBonds(
    bonds: Bond[],
    mepRate: number,
    sortBy: 'totalReturnUsd' | 'tirUsd' | 'maxVariation' = 'totalReturnUsd',
    ascending: boolean = false
  ): CarryTradeResult[] {
    const results: CarryTradeResult[] = [];

    for (const bond of bonds) {
      try {
        const result = this.analyzeBond(bond, mepRate);
        results.push(result);
      } catch (error) {
        console.warn(`Error analizando bono ${bond.ticker}:`, error);
        // Continuamos con el siguiente bono
      }
    }

    // Ordenar resultados
    return results.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      return ascending ? aValue - bValue : bValue - aValue;
    });
  }

  /**
   * Calcula métricas agregadas de un conjunto de análisis
   * 
   * @param results Resultados de análisis
   * @param mepRate Tipo de cambio MEP utilizado
   * @returns Resumen agregado
   */
  calculateSummary(results: CarryTradeResult[], mepRate: number) {
    if (results.length === 0) {
      return {
        mepRate,
        analysisDate: new Date(),
        totalBonds: 0,
        positiveReturnBonds: 0,
        bestBondByReturn: null,
        bestBondByTir: null,
        averageReturnUsd: 0,
        averageTirUsd: 0
      };
    }

    const positiveBonds = results.filter(r => r.totalReturnUsd > 0);
    const bestByReturn = [...results].sort((a, b) => b.totalReturnUsd - a.totalReturnUsd)[0];
    const bestByTir = [...results].sort((a, b) => b.tirUsd - a.tirUsd)[0];
    
    const avgReturn = results.reduce((sum, r) => sum + r.totalReturnUsd, 0) / results.length;
    const avgTir = results.reduce((sum, r) => sum + r.tirUsd, 0) / results.length;

    return {
      mepRate,
      analysisDate: new Date(),
      totalBonds: results.length,
      positiveReturnBonds: positiveBonds.length,
      bestBondByReturn: bestByReturn,
      bestBondByTir: bestByTir,
      averageReturnUsd: avgReturn,
      averageTirUsd: avgTir
    };
  }
}

/**
 * Función helper para crear una instancia del calculador con configuración por defecto
 */
export function createCalculator(config?: Partial<CarryTradeConfig>): CarryTradeCalculator {
  return new CarryTradeCalculator(config);
}

/**
 * Función helper para análisis rápido de un solo bono
 */
export function quickAnalyze(
  bond: Bond,
  mepRate: number,
  config?: Partial<CarryTradeConfig>
): CarryTradeResult {
  const calculator = new CarryTradeCalculator(config);
  return calculator.analyzeBond(bond, mepRate);
}

/**
 * Función helper para convertir fecha string a Date
 */
export function parseDate(dateString: string): Date {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Fecha inválida: ${dateString}`);
  }
  return date;
}
