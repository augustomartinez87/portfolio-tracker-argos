/**
 * Carry Trade Models
 * Modelos de datos para el análisis de carry trade en bonos argentinos
 */

/**
 * Tipo de bono para carry trade
 * - LECAP: Letras Capitalizables
 * - BONCAP: Bonos Capitalizables
 * - DUAL: Bonos Duales (tasa fija o TAMAR)
 */
export type BondType = 'LECAP' | 'BONCAP' | 'DUAL';

/**
 * Representa un bono argentino para análisis de carry trade
 */
export interface Bond {
  /** Código del bono (ej: 'S15G5', 'T30E6') */
  ticker: string;
  
  /** Fecha de vencimiento del bono */
  maturityDate: Date;
  
  /** Payoff (valor de rescate) al vencimiento en ARS */
  payoff: number;
  
  /** Precio actual del bono en ARS */
  currentPrice: number;
  
  /** Tipo de bono */
  bondType: BondType;
}

/**
 * Resultado del análisis de carry trade para un bono
 */
export interface CarryTradeResult {
  /** Bono analizado */
  bond: Bond;
  
  /** Tipo de cambio MEP actual utilizado en el análisis */
  mepRate: number;
  
  /** Tipo de cambio breakeven (donde el retorno en USD es 0%) */
  breakevenRate: number;
  
  /** Retorno total en USD (porcentaje) */
  totalReturnUsd: number;
  
  /** Máxima variación posible del tipo de cambio (porcentaje) */
  maxVariation: number;
  
  /** Spread vs TC (puntos porcentuales) */
  spreadVsTc: number;
  
  /** Banda superior del tipo de cambio proyectada */
  upperBand: number;
  
  /** Banda inferior del tipo de cambio */
  lowerBand: number;
  
  /** TIR anualizada en USD (porcentaje) */
  tirUsd: number;
}

/**
 * Métricas agregadas del análisis de carry trade
 */
export interface CarryTradeSummary {
  /** Tipo de cambio MEP utilizado */
  mepRate: number;
  
  /** Fecha del análisis */
  analysisDate: Date;
  
  /** Total de bonos analizados */
  totalBonds: number;
  
  /** Bonos con retorno positivo en USD */
  positiveReturnBonds: number;
  
  /** Mejor bono por retorno en USD */
  bestBondByReturn: CarryTradeResult | null;
  
  /** Mejor bono por TIR USD */
  bestBondByTir: CarryTradeResult | null;
  
  /** Promedio de retorno USD */
  averageReturnUsd: number;
  
  /** Promedio de TIR USD */
  averageTirUsd: number;
}

/**
 * Configuración de un bono para el módulo
 */
export interface BondConfig {
  /** Fecha de vencimiento (formato ISO: YYYY-MM-DD) */
  maturity: string;
  
  /** Payoff/valor de rescate en ARS */
  payoff: number;
  
  /** Tipo de bono */
  type: BondType;
}

/**
 * Configuración global del módulo carry trade
 */
export interface CarryTradeConfig {
  /** Inflación mensual esperada (default: 0.01 = 1%) */
  monthlyInflation: number;
  
  /** Tolerancia de banda inferior (default: 0.95 = -5%) */
  lowerBandTolerance: number;
  
  /** Multiplicador de banda superior (default: 1.05 = +5%) */
  upperBandMultiplier: number;
}

/**
 * Errores posibles durante el cálculo de carry trade
 */
export enum CarryTradeError {
  INVALID_BOND_DATA = 'INVALID_BOND_DATA',
  INVALID_MEP_RATE = 'INVALID_MEP_RATE',
  BOND_MATURED = 'BOND_MATURED',
  ZERO_PRICE = 'ZERO_PRICE',
  API_ERROR = 'API_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Resultado de una operación de carry trade (con manejo de errores)
 */
export interface CarryTradeOperationResult {
  /** Éxito de la operación */
  success: boolean;
  
  /** Resultado del cálculo (solo si success es true) */
  result?: CarryTradeResult;
  
  /** Error ocurrido (solo si success es false) */
  error?: CarryTradeError;
  
  /** Mensaje descriptivo del error */
  errorMessage?: string;
}
