// ============================================================================
// FINANCE FORMATTERS - UI formatting helpers for financial data
// ============================================================================

import Decimal from 'decimal.js';
import { Caucion, DisplayCaucion, FinancingMetrics } from '../types/finance';

// Type alias for cleaner code
type DecimalValue = InstanceType<typeof Decimal>;

// ============================================================================
// TNA FORMATTING - Convert decimal TNA to display format
// ============================================================================

/**
 * Convert decimal TNA to percentage for UI display
 * @param tnaDecimal - TNA as decimal (0.3308)
 * @param decimals - Number of decimal places to show (default: 2)
 * @returns TNA formatted as percentage string (e.g., "33.08%")
 */
export function formatTNAForDisplay(tnaDecimal: DecimalValue, decimals: number = 2): string {
  return `${tnaDecimal.times(100).toFixed(decimals)}%`;
}

/**
 * Convert percentage string back to decimal TNA
 * @param percentage - Percentage string (e.g., "33.08%")
 * @returns TNA as decimal (0.3308)
 */
export function parsePercentageToTNA(percentage: string): DecimalValue {
  // Remove % sign and convert to number, then divide by 100
  const cleanValue = percentage.replace('%', '').trim();
  const parsed = parseFloat(cleanValue);
  if (!Number.isFinite(parsed)) {
    return new Decimal(0);
  }
  return new Decimal(parsed).div(100);
}

// ============================================================================
// CURRENCY FORMATTING - Format Decimal amounts for display
// ============================================================================

/**
 * Format Decimal amount as Argentine Pesos currency
 * @param amount - Decimal amount
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted ARS string (e.g., "$ 1.234.567,89")
 */
export function formatARS(amount: DecimalValue, decimals: number = 2): string {
  // Use Decimal's built-in formatting with Argentine formatting
  const formatted = amount.toFormat(decimals);
  return `$ ${formatted}`;
}

/**
 * Format Decimal amount as US Dollars currency
 * @param amount - Decimal amount
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted USD string (e.g., "US$ 1,234,567.89")
 */
export function formatUSD(amount: DecimalValue, decimals: number = 2): string {
  // Use Decimal's built-in formatting with US formatting
  const formatted = amount.toFormat(decimals);
  return `US$ ${formatted}`;
}

/**
 * Generic currency formatter
 * @param amount - Decimal amount
 * @param currency - Currency type ('ARS' or 'USD')
 * @param decimals - Number of decimal places
 * @returns Formatted currency string
 */
export function formatCurrency(amount: DecimalValue, currency: 'ARS' | 'USD' = 'ARS', decimals: number = 2): string {
  return currency === 'ARS' ? formatARS(amount, decimals) : formatUSD(amount, decimals);
}

// ============================================================================
// CAUCION DISPLAY FORMATTING - Format entire caucion for UI
// ============================================================================

/**
 * Convert a typed Caucion to display format with formatted strings
 * @param caucion - Typed Caucion object
 * @returns DisplayCaucion with all monetary and TNA values formatted
 */
export function formatCauccionForDisplay(caucion: Caucion): DisplayCaucion {
  return {
    ...caucion,
    tnaDisplay: formatTNAForDisplay(caucion.tna),
    capitalDisplay: formatARS(caucion.capital),
    montoDevolverDisplay: formatARS(caucion.montoDevolver),
    interesDisplay: formatARS(caucion.interes)
  };
}

/**
 * Convert multiple cauciones to display format
 * @param cauciones - Array of typed Caucion objects
 * @returns Array of DisplayCauccion objects
 */
export function formatCauccionesForDisplay(cauciones: Caucion[]): DisplayCaucion[] {
  return cauciones.map(formatCauccionForDisplay);
}

// ============================================================================
// METRICS FORMATTING - Format comprehensive metrics for dashboard
// ============================================================================

/**
 * Format financing metrics for dashboard display
 * @param metrics - FinancingMetrics object with Decimal values
 * @returns Object with all values formatted for UI
 */
export function formatMetricsForDisplay(metrics: FinancingMetrics) {
  return {
    capitalTotal: formatARS(metrics.capitalTotal),
    interesTotal: formatARS(metrics.interesTotal),
    montoDevolverTotal: formatARS(metrics.montoDevolverTotal),
    tnaPromedioPonderada: formatTNAForDisplay(metrics.tnaPromedioPonderada),
    diasPromedio: metrics.diasPromedio.toFixed(1),
    totalOperaciones: metrics.totalOperaciones.toString(),
    primeraOperacion: metrics.primeraOperacion ? formatDate(metrics.primeraOperacion) : 'N/A',
    ultimaOperacion: metrics.ultimaOperacion ? formatDate(metrics.ultimaOperacion) : 'N/A',
    // Keep raw values for calculations if needed
    rawMetrics: metrics
  };
}

// ============================================================================
// DATE FORMATTING - Format dates for display
// ============================================================================

/**
 * Format date for display in DD/MM/YYYY format
 * @param date - Date object
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Format date with time for display
 * @param date - Date object
 * @returns Formatted date-time string
 */
export function formatDateTime(date: Date): string {
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format ISO date for input fields (YYYY-MM-DD)
 * @param date - Date object
 * @returns ISO date string
 */
export function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ============================================================================
// NUMBER FORMATTING - General number formatting utilities
// ============================================================================

/**
 * Format number with thousands separator and decimal places
 * @param value - Number to format
 * @param decimals - Number of decimal places
 * @returns Formatted number string
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format percentage for display
 * @param value - Number value (0-100)
 * @param decimals - Number of decimal places
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${formatNumber(value, decimals)}%`;
}

// ============================================================================
// YIELD AND RETURN FORMATTING
// ============================================================================

/**
 * Format yield rate as percentage
 * @param yieldRate - Yield rate as Decimal (0.1234)
 * @param decimals - Number of decimal places
 * @returns Formatted yield percentage
 */
export function formatYieldRate(yieldRate: DecimalValue, decimals: number = 2): string {
  return formatTNAForDisplay(yieldRate, decimals);
}

/**
 * Format return on investment (ROI) as percentage
 * @param profit - Profit amount
 * @param investment - Investment amount
 * @param decimals - Number of decimal places
 * @returns Formatted ROI percentage
 */
export function formatROI(profit: DecimalValue, investment: DecimalValue, decimals: number = 2): string {
  if (investment.isZero()) {
    return formatPercentage(0, decimals);
  }
  const roi = profit.div(investment).times(100);
  return `${roi.toFixed(decimals)}%`;
}

// ============================================================================
// INPUT PARSING - Parse user input back to Decimal
// ============================================================================

/**
 * Parse currency input string back to Decimal
 * @param currencyString - Formatted currency string (e.g., "$ 1.234,56")
 * @returns Decimal value
 */
export function parseCurrencyInput(currencyString: string): DecimalValue {
  // Remove currency symbols, spaces, and convert decimal separators
  const cleanString = currencyString
    .replace(/[USD$ARS$\s]/g, '') // Remove currency symbols and spaces
    .replace(/\./g, '') // Remove thousands separators
    .replace(/,/g, '.'); // Convert decimal separator to dot
  
  const parsed = parseFloat(cleanString);
  if (!Number.isFinite(parsed)) {
    return new Decimal(0);
  }
  return new Decimal(parsed);
}

/**
 * Parse number input string back to Decimal
 * @param numberString - Formatted number string
 * @returns Decimal value
 */
export function parseNumberInput(numberString: string): DecimalValue {
  const cleanString = numberString
    .replace(/\./g, '') // Remove thousands separators
    .replace(/,/g, '.'); // Convert decimal separator to dot
  
  const parsed = parseFloat(cleanString);
  if (!Number.isFinite(parsed)) {
    return new Decimal(0);
  }
  return new Decimal(parsed);
}