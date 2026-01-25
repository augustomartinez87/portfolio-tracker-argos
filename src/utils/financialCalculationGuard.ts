// ============================================================================
// FINANCIAL CALCULATION GUARD - Enforces Decimal-based calculations
// ============================================================================
// This module prevents legacy Number-based financial calculations by:
// 1. Deprecating direct Number arithmetic for financial values
// 2. Providing runtime validation for calculation safety
// 3. Enforcing the use of Decimal or FinancingService for all financial math
// ============================================================================

import Decimal from 'decimal.js';

type DecimalValue = InstanceType<typeof Decimal>;

/**
 * Runtime guard to validate that financial calculations use Decimal
 * @param calculationName - Name of the calculation being performed
 * @param inputs - Input values to validate
 * @throws Error if any validation fails
 */
export function validateFinancialCalculation(
  calculationName: string,
  ...inputs: (number | DecimalValue | string)[]
): void {
  // Check for suspicious patterns that suggest Number-based calculations
  for (const input of inputs) {
    if (typeof input === 'number') {
      // Allow small integers for counts, days, etc.
      if (input > 1000000 || input < -1000000) {
        console.warn(`⚠️  [FINANCIAL GUARD] Large Number detected in ${calculationName}: ${input}. Consider using Decimal for precision.`);
      }
      
      // Check for floating point arithmetic on financial values
      if (!Number.isInteger(input) && Math.abs(input) > 0.01) {
        throw new Error(
          `❌ [FINANCIAL GUARD] Forbidden floating-point arithmetic in ${calculationName}: ${input}. ` +
          `Use Decimal for all financial calculations to avoid precision errors.`
        );
      }
    }
  }
}

/**
 * Deprecated Number-based interest calculation (BLOCKED)
 * This function is intentionally broken to prevent usage
 * @deprecated Use calculateExpectedInterest from financialCalculations.ts instead
 */
export function calculateInterestLegacy(
  _capital: number,
  _rate: number,
  _days: number
): never {
  throw new Error(
    '❌ [BLOCKED] calculateInterestLegacy is deprecated and blocked.\n' +
    '📱 Use calculateExpectedInterest(capital: Decimal, rate: Decimal, days: number) from financialCalculations.ts\n' +
    '🔒 This prevents precision errors that cause real money losses.'
  );
}

/**
 * Deprecated Number-based TNA calculation (BLOCKED)
 * This function is intentionally broken to prevent usage
 * @deprecated Use calculateTnaFromLegacy from financialCalculations.ts instead
 */
export function calculateTNALegacy(
  _interest: number,
  _capital: number,
  _days: number
): never {
  throw new Error(
    '❌ [BLOCKED] calculateTNALegacy is deprecated and blocked.\n' +
    '📱 Use calculateTnaFromLegacy(capital: number, interest: number, days: number) from financialCalculations.ts\n' +
    '🔒 This prevents precision errors that cause real money losses.'
  );
}

/**
 * Validate that a calculation result is a proper Decimal instance
 * @param result - Calculation result to validate
 * @param calculationName - Name of the calculation for error reporting
 * @returns The validated Decimal
 */
export function validateDecimalResult(
  result: DecimalValue,
  calculationName: string
): DecimalValue {
  if (!(result instanceof Decimal)) {
    throw new Error(
      `❌ [FINANCIAL GUARD] Invalid result in ${calculationName}: expected Decimal, got ${typeof result}. ` +
      'All financial calculations must return Decimal instances.'
    );
  }
  
  if (result.isNaN()) {
    throw new Error(`❌ [FINANCIAL GUARD] NaN result in ${calculationName}. Check input values.`);
  }
  
  return result;
}

/**
 * TypeScript guard for financial data types
 * This ensures that financial objects use the proper Decimal-based types
 */
export interface StrictFinancialCalculation {
  // This interface enforces that all financial properties use Decimal
  capital: DecimalValue;
  interes: DecimalValue;
  montoDevolver: DecimalValue;
  tna: DecimalValue;
  dias: number; // days can remain as number (integer)
}

/**
 * Runtime guard to validate financial object structure
 * @param obj - Object to validate
 * @param objName - Name of the object for error reporting
 */
export function validateFinancialObject(
  obj: any,
  objName: string
): asserts obj is StrictFinancialCalculation {
  const requiredFields = ['capital', 'interes', 'montoDevolver', 'tna'];
  
  for (const field of requiredFields) {
    if (!(field in obj)) {
      throw new Error(`❌ [FINANCIAL GUARD] Missing required field '${field}' in ${objName}`);
    }
    
    if (!(obj[field] instanceof Decimal)) {
      throw new Error(
        `❌ [FINANCIAL GUARD] Field '${field}' in ${objName} must be Decimal, got ${typeof obj[field]}. ` +
        'Use new Decimal(value) to create proper Decimal instances.'
      );
    }
  }
  
  if (typeof obj.dias !== 'number' || !Number.isInteger(obj.dias) || obj.dias < 0) {
    throw new Error(`❌ [FINANCIAL GUARD] Field 'dias' in ${objName} must be a non-negative integer, got ${obj.dias}`);
  }
}

/**
 * Development-time warning system for financial calculations
 * This logs warnings during development to guide developers toward proper usage
 */
export function financialCalculationWarning(
  calculationName: string,
  recommendation: string
): void {
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      `⚠️  [FINANCIAL GUARD] ${calculationName}\n` +
      `💡 Recommendation: ${recommendation}\n` +
      `📚 Documentation: Use financialCalculations.ts for all math operations\n` +
      `🔒 This prevents precision errors that cause real money losses`
    );
  }
}

// ============================================================================
// ENFORCEMENT - Global protection against legacy patterns
// ============================================================================

/**
 * Global override to detect and block unsafe Number arithmetic
 * This is a development-time safety net
 */
if (process.env.NODE_ENV === 'development') {
  // Override console.log to detect suspicious financial calculations
  const originalLog = console.log;
  console.log = function(...args: any[]) {
    const message = args.join(' ');
    
    // Detect patterns that suggest legacy calculations
    if (message.includes('*') && (message.includes('0.') || message.includes('interés'))) {
      financialCalculationWarning(
        'Suspicious calculation detected',
        'Use Decimal.times() instead of Number multiplication for financial values'
      );
    }
    
    originalLog.apply(console, args);
  };
}