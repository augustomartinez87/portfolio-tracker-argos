// ============================================================================
// FINANCIAL CALCULATIONS - Pure functions for financial arithmetic
// ============================================================================

import Decimal from 'decimal.js';
import { Caucion, FinancingMetrics, Result } from '../types/finance';

// Type alias for Decimal to avoid repeating InstanceType<typeof Decimal>
type DecimalValue = InstanceType<typeof Decimal>;

// ============================================================================
// CORE CALCULATION FUNCTIONS - Pure, testable, no side effects
// ============================================================================

/**
 * Calculate total capital sum from an array of cauciones
 * @param cauciones - Array of caucion objects
 * @returns Total capital as Decimal
 */
export function calculateCapitalTotal(cauciones: Caucion[]): DecimalValue {
  return cauciones.reduce((sum, c) => sum.plus(c.capital), new Decimal(0));
}

/**
 * Calculate total interest sum from an array of cauciones  
 * @param cauciones - Array of caucion objects
 * @returns Total interest as Decimal
 */
export function calculateInterestTotal(cauciones: Caucion[]): DecimalValue {
  return cauciones.reduce((sum, c) => sum.plus(c.interes), new Decimal(0));
}

/**
 * Calculate total monto devolver sum from an array of cauciones
 * @param cauciones - Array of caucion objects
 * @returns Total monto devolver as Decimal
 */
export function calculateMontoDevolverTotal(cauciones: Caucion[]): DecimalValue {
  return cauciones.reduce((sum, c) => sum.plus(c.montoDevolver), new Decimal(0));
}

/**
 * Calculate weighted average TNA using capital*dias weighting
 * Formula: Σ(capital_i × tna_i × dias_i) / Σ(capital_i × dias_i)
 * @param cauciones - Array of caucion objects
 * @returns Weighted average TNA as Decimal (decimal format: 0.3308)
 */
export function calculateWeightedTNA(cauciones: Caucion[]): DecimalValue {
  if (cauciones.length === 0) {
    return new Decimal(0);
  }

  const totalWeighted = cauciones.reduce((sum, c) => 
    sum.plus(c.capital.times(c.tna).times(c.dias)), new Decimal(0)
  );
  
  const totalCapitalDays = cauciones.reduce((sum, c) => 
    sum.plus(c.capital.times(c.dias)), new Decimal(0)
  );
  
  return totalCapitalDays.isZero() ? new Decimal(0) : totalWeighted.div(totalCapitalDays);
}

/**
 * Calculate simple average TNA (not weighted by capital or days)
 * @param cauciones - Array of caucion objects
 * @returns Simple average TNA as Decimal
 */
export function calculateSimpleTNA(cauciones: Caucion[]): DecimalValue {
  if (cauciones.length === 0) {
    return new Decimal(0);
  }

  const totalTNA = cauciones.reduce((sum, c) => sum.plus(c.tna), new Decimal(0));
  return totalTNA.div(cauciones.length);
}

/**
 * Calculate average days (simple average, not weighted)
 * @param cauciones - Array of caucion objects  
 * @returns Average days as number
 */
export function calculateAverageDays(cauciones: Caucion[]): number {
  if (cauciones.length === 0) {
    return 0;
  }

  const totalDays = cauciones.reduce((sum, c) => sum + c.dias, 0);
  return totalDays / cauciones.length;
}

/**
 * Find earliest operation date from cauciones
 * @param cauciones - Array of caucion objects
 * @returns Earliest date or null if no cauciones
 */
export function getFirstOperationDate(cauciones: Caucion[]): Date | null {
  if (cauciones.length === 0) {
    return null;
  }

  return cauciones.reduce((earliest, c) => 
    c.fechaInicio < earliest ? c.fechaInicio : earliest,
    cauciones[0].fechaInicio
  );
}

/**
 * Find latest operation date from cauciones
 * @param cauciones - Array of caucion objects
 * @returns Latest date or null if no cauciones
 */
export function getLastOperationDate(cauciones: Caucion[]): Date | null {
  if (cauciones.length === 0) {
    return null;
  }

  return cauciones.reduce((latest, c) => 
    c.fechaInicio > latest ? c.fechaInicio : latest,
    cauciones[0].fechaInicio
  );
}

// ============================================================================
// COMPREHENSIVE METRICS CALCULATION
// ============================================================================

/**
 * Calculate comprehensive financing metrics from cauciones array
 * @param cauciones - Array of caucion objects
 * @returns Complete financing metrics
 */
export function calculateFinancingMetrics(cauciones: Caucion[]): FinancingMetrics {
  return {
    capitalTotal: calculateCapitalTotal(cauciones),
    interesTotal: calculateInterestTotal(cauciones),
    montoDevolverTotal: calculateMontoDevolverTotal(cauciones),
    tnaPromedioPonderada: calculateWeightedTNA(cauciones),
    diasPromedio: calculateAverageDays(cauciones),
    totalOperaciones: cauciones.length,
    primeraOperacion: getFirstOperationDate(cauciones),
    ultimaOperacion: getLastOperationDate(cauciones)
  };
}

/**
 * Calculate comprehensive financing metrics with Result pattern for error handling
 * @param cauciones - Array of caucion objects
 * @returns Result with metrics or error
 */
export function calculateFinancingMetricsSafe(cauciones: Caucion[]): Result<FinancingMetrics> {
  try {
    if (!Array.isArray(cauciones)) {
      return { 
        success: false, 
        error: new Error('cauciones must be an array') 
      };
    }

    // Validate each caucion has required properties
    for (let i = 0; i < cauciones.length; i++) {
      const c = cauciones[i];
      if (!c || typeof c !== 'object') {
        return { 
          success: false, 
          error: new Error(`caucion at index ${i} is not an object`) 
        };
      }
      
      if (!(c.capital instanceof Decimal) || 
          !(c.montoDevolver instanceof Decimal) ||
          !(c.interes instanceof Decimal) ||
          !(c.tna instanceof Decimal)) {
        return { 
          success: false, 
          error: new Error(`caucion at index ${i} has invalid Decimal properties`) 
        };
      }
      
      if (typeof c.dias !== 'number' || c.dias < 0) {
        return { 
          success: false, 
          error: new Error(`caucion at index ${i} has invalid dias: ${c.dias}`) 
        };
      }
    }

    const metrics = calculateFinancingMetrics(cauciones);
    return { success: true, data: metrics };

  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error(String(error)) 
    };
  }
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate that a Decimal represents a valid financial amount
 * @param amount - Decimal to validate
 * @returns Result with validation status
 */
export function validateFinancialAmount(amount: InstanceType<typeof Decimal>): Result<InstanceType<typeof Decimal>> {
  if (amount.isNaN()) {
    return { success: false, error: new Error('Amount is NaN') };
  }
  
  if (amount.isNegative()) {
    return { success: false, error: new Error('Amount cannot be negative') };
  }
  
  if (amount.greaterThan(new Decimal('999999999999.99'))) {
    return { success: false, error: new Error('Amount exceeds maximum allowed value') };
  }
  
  return { success: true, data: amount };
}

/**
 * Validate that a TNA is within reasonable bounds (0-100% as decimal: 0-1.0)
 * @param tna - Decimal TNA to validate
 * @returns Result with validation status
 */
export function validateTNA(tna: InstanceType<typeof Decimal>): Result<InstanceType<typeof Decimal>> {
  if (tna.isNaN()) {
    return { success: false, error: new Error('TNA is NaN') };
  }
  
  if (tna.isNegative()) {
    return { success: false, error: new Error('TNA cannot be negative') };
  }
  
  if (tna.greaterThan(2)) { // 200% as upper bound
    return { success: false, error: new Error('TNA exceeds reasonable maximum (200%)') };
  }
  
  return { success: true, data: tna };
}

/**
 * Validate days is within reasonable bounds
 * @param days - Number of days to validate
 * @returns Result with validation status
 */
export function validateDays(days: number): Result<number> {
  if (!Number.isInteger(days)) {
    return { success: false, error: new Error('Days must be an integer') };
  }
  
  if (days < 0) {
    return { success: false, error: new Error('Days cannot be negative') };
  }
  
  if (days > 3650) { // 10 years as upper bound
    return { success: false, error: new Error('Days exceeds reasonable maximum (3650)') };
  }
  
  return { success: true, data: days };
}

// ============================================================================
// CALCULATION HELPERS
// ============================================================================

/**
 * Calculate expected interest based on capital, TNA, and days
 * Formula: capital × tna × (days/365)
 * @param capital - Principal amount
 * @param tna - Annual rate as decimal (0.3308)
 * @param days - Number of days
 * @returns Expected interest as Decimal
 */
export function calculateExpectedInterest(
  capital: DecimalValue, 
  tna: DecimalValue, 
  days: number
): DecimalValue {
  return capital.times(tna).times(days).div(365);
}

/**
 * Calculate expected monto devolver (principal + interest)
 * @param capital - Principal amount
 * @param interest - Interest amount
 * @returns Total amount to return as Decimal
 */
export function calculateExpectedMontoDevolver(
  capital: DecimalValue, 
  interest: DecimalValue
): DecimalValue {
  return capital.plus(interest);
}

/**
 * Calculate yield rate (interest/capital)
 * @param interest - Interest amount
 * @param capital - Principal amount
 * @returns Yield rate as Decimal
 */
export function calculateYieldRate(
  interest: DecimalValue, 
  capital: DecimalValue
): Result<DecimalValue> {
  if (capital.isZero()) {
    return { success: false, error: new Error('Cannot calculate yield on zero capital') };
  }
  
  return { success: true, data: interest.div(capital) };
}

// ============================================================================
// LEGACY COMPATIBILITY LAYER - For UI components still using old data format
// These functions bridge the gap between legacy Number-based data and Decimal calculations
// ============================================================================

/**
 * Calculate days between dates using precise calculation (legacy format)
 * @param startDate - Start date string or Date object
 * @param endDate - End date string or Date object
 * @returns Number of days (always positive integer)
 */
export function calculateDaysPrecise(
  startDate: string | Date, 
  endDate: string | Date
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays : 0;
}

/**
 * Calculate interest from legacy data format using Decimal precision
 * @param capital - Capital amount (Number, will be converted to Decimal)
 * @param montoDevolver - Total amount to return (Number, will be converted to Decimal)
 * @returns Interest as Decimal
 */
export function calculateInterestFromLegacy(
  capital: number, 
  montoDevolver: number
): DecimalValue {
  const capitalDecimal = new Decimal(capital || 0);
  const montoDevolverDecimal = new Decimal(montoDevolver || 0);
  
  return montoDevolverDecimal.minus(capitalDecimal);
}

/**
 * Convert legacy record to proper Caucion format for calculations
 * @param legacyRecord - Legacy record with capital, monto_devolver, fecha_inicio, fecha_fin, tna_real
 * @returns Proper Caucion object with Decimal values
 */
export function convertLegacyToCaucion(legacyRecord: any): Caucion {
  const dias = calculateDaysPrecise(
    legacyRecord.fecha_inicio, 
    legacyRecord.fecha_fin
  );
  
  return {
    id: legacyRecord.id,
    portfolioId: legacyRecord.portfolioId || 'legacy',
    capital: new Decimal(legacyRecord.capital || 0),
    montoDevolver: new Decimal(legacyRecord.monto_devolver || 0),
    interes: calculateInterestFromLegacy(
      legacyRecord.capital, 
      legacyRecord.monto_devolver
    ),
    dias,
    tna: new Decimal(legacyRecord.tna_real || 0),
    fechaInicio: new Date(legacyRecord.fecha_inicio),
    fechaFin: new Date(legacyRecord.fecha_fin),
    archivo: legacyRecord.archivo || legacyRecord.pdf_filename
  };
}

/**
 * Calculate TNA from legacy data using Decimal precision
 * Formula: (interes/capital) * (365/dias)
 * @param capital - Principal amount
 * @param interest - Interest amount  
 * @param days - Number of days
 * @returns TNA as Decimal (decimal format: 0.3308)
 */
export function calculateTnaFromLegacy(
  capital: number, 
  interest: number, 
  days: number
): DecimalValue {
  if (capital <= 0 || days <= 0) {
    return new Decimal(0);
  }
  
  const capitalDecimal = new Decimal(capital);
  const interestDecimal = new Decimal(interest);
  const daysDecimal = new Decimal(days);
  
  return interestDecimal
    .div(capitalDecimal)
    .times(new Decimal(365))
    .div(daysDecimal);
}