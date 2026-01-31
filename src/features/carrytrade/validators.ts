/**
 * Carry Trade Validators
 * Validación de datos de entrada para el módulo carry trade
 */

import type { Bond, CarryTradeResult, CarryTradeConfig, CarryTradeOperationResult } from './models';
import { CarryTradeError } from './models';

/**
 * Resultado de una validación
 */
interface ValidationResult {
  valid: boolean;
  error?: CarryTradeError;
  message?: string;
}

/**
 * Valida un objeto Bond
 * @param bond Bono a validar
 * @returns Resultado de la validación
 */
export function validateBond(bond: unknown): ValidationResult {
  if (!bond || typeof bond !== 'object') {
    return {
      valid: false,
      error: CarryTradeError.INVALID_BOND_DATA,
      message: 'El bono debe ser un objeto válido'
    };
  }

  const b = bond as Bond;

  // Validar ticker
  if (!b.ticker || typeof b.ticker !== 'string' || b.ticker.length === 0) {
    return {
      valid: false,
      error: CarryTradeError.INVALID_BOND_DATA,
      message: 'El ticker del bono es inválido'
    };
  }

  // Validar fecha de vencimiento
  if (!(b.maturityDate instanceof Date) || isNaN(b.maturityDate.getTime())) {
    return {
      valid: false,
      error: CarryTradeError.INVALID_BOND_DATA,
      message: `Fecha de vencimiento inválida para ${b.ticker}`
    };
  }

  // Validar payoff
  if (typeof b.payoff !== 'number' || b.payoff <= 0 || !isFinite(b.payoff)) {
    return {
      valid: false,
      error: CarryTradeError.INVALID_BOND_DATA,
      message: `Payoff inválido para ${b.ticker}: ${b.payoff}`
    };
  }

  // Validar precio actual
  if (typeof b.currentPrice !== 'number' || b.currentPrice <= 0 || !isFinite(b.currentPrice)) {
    return {
      valid: false,
      error: CarryTradeError.ZERO_PRICE,
      message: `Precio inválido para ${b.ticker}: ${b.currentPrice}`
    };
  }

  // Validar tipo de bono
  const validTypes = ['LECAP', 'BONCAP', 'DUAL'];
  if (!b.bondType || !validTypes.includes(b.bondType)) {
    return {
      valid: false,
      error: CarryTradeError.INVALID_BOND_DATA,
      message: `Tipo de bono inválido para ${b.ticker}: ${b.bondType}`
    };
  }

  // Validar que el bono no haya vencido
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (b.maturityDate < today) {
    return {
      valid: false,
      error: CarryTradeError.BOND_MATURED,
      message: `El bono ${b.ticker} ya venció el ${b.maturityDate.toISOString().split('T')[0]}`
    };
  }

  return { valid: true };
}

/**
 * Valida un tipo de cambio MEP
 * @param rate Tipo de cambio a validar
 * @returns Resultado de la validación
 */
export function validateMepRate(rate: unknown): ValidationResult {
  if (typeof rate !== 'number') {
    return {
      valid: false,
      error: CarryTradeError.INVALID_MEP_RATE,
      message: 'El tipo de cambio MEP debe ser un número'
    };
  }

  if (rate <= 0) {
    return {
      valid: false,
      error: CarryTradeError.INVALID_MEP_RATE,
      message: `El tipo de cambio MEP debe ser mayor a 0: ${rate}`
    };
  }

  if (!isFinite(rate)) {
    return {
      valid: false,
      error: CarryTradeError.INVALID_MEP_RATE,
      message: 'El tipo de cambio MEP no es un número finito'
    };
  }

  // Validación de rango razonable para MEP (ej: entre 100 y 10000)
  if (rate < 100 || rate > 10000) {
    return {
      valid: false,
      error: CarryTradeError.INVALID_MEP_RATE,
      message: `El tipo de cambio MEP está fuera de rango razonable: ${rate}`
    };
  }

  return { valid: true };
}

/**
 * Valida un resultado de carry trade
 * @param result Resultado a validar
 * @returns Resultado de la validación
 */
export function validateCarryTradeResult(result: unknown): ValidationResult {
  if (!result || typeof result !== 'object') {
    return {
      valid: false,
      error: CarryTradeError.INVALID_BOND_DATA,
      message: 'El resultado debe ser un objeto válido'
    };
  }

  const r = result as CarryTradeResult;

  // Validar campos numéricos
  const numericFields: (keyof CarryTradeResult)[] = [
    'mepRate',
    'breakevenRate',
    'totalReturnUsd',
    'maxVariation',
    'spreadVsTc',
    'upperBand',
    'lowerBand',
    'tirUsd'
  ];

  for (const field of numericFields) {
    const value = r[field];
    if (typeof value !== 'number' || !isFinite(value)) {
      return {
        valid: false,
        error: CarryTradeError.INVALID_BOND_DATA,
        message: `Campo ${field} inválido en resultado: ${value}`
      };
    }
  }

  // Validar que upperBand > lowerBand
  if (r.upperBand <= r.lowerBand) {
    return {
      valid: false,
      error: CarryTradeError.INVALID_BOND_DATA,
      message: 'Banda superior debe ser mayor a banda inferior'
    };
  }

  return { valid: true };
}

/**
 * Valida una configuración de carry trade
 * @param config Configuración a validar
 * @returns Resultado de la validación
 */
export function validateConfig(config: unknown): ValidationResult {
  if (!config || typeof config !== 'object') {
    return {
      valid: false,
      error: CarryTradeError.INVALID_BOND_DATA,
      message: 'La configuración debe ser un objeto'
    };
  }

  const c = config as CarryTradeConfig;

  // Validar inflación mensual
  if (typeof c.monthlyInflation !== 'number' || 
      c.monthlyInflation < 0 || 
      c.monthlyInflation > 1 ||
      !isFinite(c.monthlyInflation)) {
    return {
      valid: false,
      error: CarryTradeError.INVALID_BOND_DATA,
      message: `Inflación mensual inválida: ${c.monthlyInflation}`
    };
  }

  // Validar tolerancia de banda inferior
  if (typeof c.lowerBandTolerance !== 'number' || 
      c.lowerBandTolerance <= 0 || 
      c.lowerBandTolerance > 1 ||
      !isFinite(c.lowerBandTolerance)) {
    return {
      valid: false,
      error: CarryTradeError.INVALID_BOND_DATA,
      message: `Tolerancia de banda inferior inválida: ${c.lowerBandTolerance}`
    };
  }

  // Validar multiplicador de banda superior
  if (typeof c.upperBandMultiplier !== 'number' || 
      c.upperBandMultiplier < 1 ||
      !isFinite(c.upperBandMultiplier)) {
    return {
      valid: false,
      error: CarryTradeError.INVALID_BOND_DATA,
      message: `Multiplicador de banda superior inválido: ${c.upperBandMultiplier}`
    };
  }

  return { valid: true };
}

/**
 * Función segura para ejecutar análisis con manejo de errores
 * @param operation Función a ejecutar
 * @returns Resultado de la operación con manejo de errores
 */
export async function safeExecute<T>(
  operation: () => Promise<T>
): Promise<CarryTradeOperationResult> {
  try {
    const result = await operation();
    return {
      success: true,
      result: result as CarryTradeResult
    };
  } catch (error) {
    let errorType = CarryTradeError.UNKNOWN_ERROR;
    let message = 'Error desconocido';

    if (error instanceof Error) {
      message = error.message;
      
      // Mapear tipos de error conocidos
      if (message.includes('venció') || message.includes('matured')) {
        errorType = CarryTradeError.BOND_MATURED;
      } else if (message.includes('precio') || message.includes('price')) {
        errorType = CarryTradeError.ZERO_PRICE;
      } else if (message.includes('MEP') || message.includes('cambio')) {
        errorType = CarryTradeError.INVALID_MEP_RATE;
      } else if (message.includes('API') || message.includes('fetch')) {
        errorType = CarryTradeError.API_ERROR;
      }
    }

    return {
      success: false,
      error: errorType,
      errorMessage: message
    };
  }
}

/**
 * Valida una lista de bonos
 * @param bonds Lista de bonos
 * @returns Lista de bonos válidos y lista de errores
 */
export function validateBondList(bonds: unknown[]): { valid: Bond[]; errors: string[] } {
  const valid: Bond[] = [];
  const errors: string[] = [];

  for (const bond of bonds) {
    const result = validateBond(bond);
    
    if (result.valid) {
      valid.push(bond as Bond);
    } else {
      errors.push(result.message || 'Error de validación desconocido');
    }
  }

  return { valid, errors };
}

/**
 * Validador de rango para tipos de cambio de escenarios
 * @param scenarios Lista de escenarios TC a validar
 * @returns Escenarios válidos filtrados
 */
export function validateScenarioRates(scenarios: number[]): number[] {
  return scenarios.filter(rate => {
    const validation = validateMepRate(rate);
    return validation.valid;
  });
}
