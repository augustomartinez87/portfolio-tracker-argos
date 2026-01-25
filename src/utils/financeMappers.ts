// ============================================================================
// FINANCE MAPPERS - Safe data transformation between layers
// ============================================================================

import Decimal from 'decimal.js';
import { Caucion, DatabaseCaucion, Result, ValidationError } from '../types/finance';
import { CauccionInsert } from '../types/supabase';

// Type alias for cleaner code
type DecimalValue = InstanceType<typeof Decimal>;

// Create a proper ValidationError class that implements the interface
class ValidationErrorImpl extends Error implements ValidationError {
  code: ValidationError['code'];
  field?: string;
  value?: unknown;

  constructor(message: string, code: ValidationError['code'], field?: string, value?: unknown) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.field = field;
    this.value = value;
  }
}

// ============================================================================
// DATABASE ROW MAPPING - Convert database rows to typed entities
// ============================================================================

/**
 * Safely map a database row to a typed Caucion with validation
 * @param row - Database row object from Supabase
 * @returns Result with typed Caucion or validation error
 */
export function mapRowToCauccion(row: DatabaseCauccion): Result<Cauccion, ValidationError> {
  try {
    // Validate row is an object with required fields
    if (!row || typeof row !== 'object') {
      return { 
        success: false, 
        error: new ValidationErrorImpl('Row must be an object', 'INVALID_TYPE') 
      };
    }

    // Validate required string fields
    const requiredStringFields: Array<'id' | 'user_id' | 'portfolio_id' | 'fecha_inicio' | 'fecha_fin' | 'archivo'> = [
      'id', 'user_id', 'portfolio_id', 'fecha_inicio', 'fecha_fin', 'archivo'
    ];
    for (const field of requiredStringFields) {
      if (!row[field] || typeof row[field] !== 'string') {
        return { 
          success: false, 
          error: new ValidationErrorImpl(`Missing or invalid ${String(field)}`, 'MISSING_FIELD') 
        };
      }
    }

    // Validate and parse date fields
    const fechaInicio = parseDatabaseDate(row.fecha_inicio);
    if (!fechaInicio.success) {
      return { 
        success: false, 
        error: fechaInicio.error 
      };
    }

    const fechaFin = parseDatabaseDate(row.fecha_fin);
    if (!fechaFin.success) {
      return { 
        success: false, 
        error: fechaFin.error 
      };
    }

    // Validate and convert numeric fields to Decimal
    const capitalResult = safeToDecimal(row.capital, 'capital');
    if (!capitalResult.success) {
      return { success: false, error: capitalResult.error };
    }

    const montoDevolverResult = safeToDecimal(row.monto_devolver, 'monto_devolver');
    if (!montoDevolverResult.success) {
      return { success: false, error: montoDevolverResult.error };
    }

    const interesResult = safeToDecimal(row.interes, 'interes');
    if (!interesResult.success) {
      return { success: false, error: interesResult.error };
    }

    const tnaResult = safeToDecimal(row.tna_real, 'tna_real');
    if (!tnaResult.success) {
      return { success: false, error: tnaResult.error };
    }

    // Validate dias field
    if (!Number.isInteger(row.dias) || row.dias < 0) {
      return { 
        success: false, 
        error: new ValidationErrorImpl(`Invalid dias value: ${row.dias}`, 'INVALID_TYPE') 
      };
    }

    // Build typed Caucion object
    const caucion: Caucion = {
      id: row.id,
      portfolioId: row.portfolio_id,
      capital: capitalResult.data,
      montoDevolver: montoDevolverResult.data,
      interes: interesResult.data,
      dias: row.dias,
      tna: tnaResult.data,
      fechaInicio: fechaInicio.data,
      fechaFin: fechaFin.data,
      archivo: row.archivo
    };

    return { success: true, data: caucion };

  } catch (error) {
    return { 
      success: false, 
      error: error instanceof ValidationErrorImpl ? error : new ValidationErrorImpl(
        `Unexpected error mapping row: ${error instanceof Error ? error.message : String(error)}`,
        'INVALID_TYPE'
      ) 
    };
  }
}

/**
 * Map multiple database rows to typed cauciones
 * @param rows - Array of database rows from Supabase
 * @returns Result with array of typed cauciones or first error encountered
 */
export function mapRowsToCaucciones(rows: DatabaseCauccion[]): Result<Cauccion[], ValidationError> {
  if (!Array.isArray(rows)) {
    return { 
      success: false, 
      error: new ValidationErrorImpl('Rows must be an array', 'INVALID_TYPE') 
    };
  }

  const cauciones: Caucion[] = [];
  
  for (let i = 0; i < rows.length; i++) {
    const result = mapRowToCauccion(rows[i]);
    if (!result.success) {
      return { 
        success: false, 
        error: new ValidationErrorImpl(
          `Error mapping row ${i}: ${result.error.message}`,
          result.error.code
        ) 
      };
    }
    cauciones.push(result.data);
  }

  return { success: true, data: cauciones };
}

/**
 * Convert a typed Caucion back to database insert format
 * @param caucion - Typed Caucion object
 * @param userId - User ID for database record
 * @returns Database insert object
 */
export function mapCauccionToDatabaseInsert(caucion: Caucion, userId: string): CauccionInsert {
  return {
    user_id: userId,
    portfolio_id: caucion.portfolioId,
    fecha_inicio: caucion.fechaInicio.toISOString().split('T')[0],
    fecha_fin: caucion.fechaFin.toISOString().split('T')[0],
    capital: caucion.capital.toNumber(),
    monto_devolver: caucion.montoDevolver.toNumber(),
    interes: caucion.interes.toNumber(),
    dias: caucion.dias,
    tna_real: caucion.tna.toNumber(),
    archivo: caucion.archivo || ''
  };
}

// ============================================================================
// CSV RECORD MAPPING - Convert CSV records to database format
// ============================================================================

/**
 * Convert a CSV record (from csvSpreadIngestor) to database insert format
 * @param record - CSV record from ingestor
 * @param userId - User ID for database record
 * @param portfolioId - Portfolio ID for the database record
 * @returns Database insert object
 */
export function mapCsvRecordToDatabaseInsert(
  record: import('../types/finance').CsvRecord,
  userId: string,
  portfolioId: string
): CauccionInsert {
  return {
    user_id: userId,
    portfolio_id: portfolioId,
    fecha_inicio: record.fecha_apertura,
    fecha_fin: record.fecha_cierre,
    capital: record.capital,
    monto_devolver: record.monto_devolver,
    interes: record.interes,
    dias: record.dias,
    tna_real: record.tna_real,
    archivo: record.archivo
  };
}

/**
 * Convert a CSV record to typed Caucion (for validation purposes)
 * @param record - CSV record from ingestor
 * @param portfolioId - Portfolio ID for caucion
 * @param id - ID for caucion (optional)
 * @returns Result with typed Caucion or validation error
 */
export function mapCsvRecordToCauccion(
  record: import('../types/finance').CsvRecord,
  portfolioId: string,
  id?: string
): Result<Cauccion, ValidationError> {
  try {
    // Validate numeric fields
    const capitalResult = safeToDecimal(record.capital, 'capital');
    if (!capitalResult.success) {
      return { success: false, error: capitalResult.error };
    }

    const montoDevolverResult = safeToDecimal(record.monto_devolver, 'monto_devolver');
    if (!montoDevolverResult.success) {
      return { success: false, error: montoDevolverResult.error };
    }

    const interesResult = safeToDecimal(record.interes, 'interes');
    if (!interesResult.success) {
      return { success: false, error: interesResult.error };
    }

    const tnaResult = safeToDecimal(record.tna_real, 'tna_real');
    if (!tnaResult.success) {
      return { success: false, error: tnaResult.error };
    }

    // Validate and parse dates
    const fechaInicio = parseDatabaseDate(record.fecha_apertura);
    if (!fechaInicio.success) {
      return { success: false, error: fechaInicio.error };
    }

    const fechaFin = parseDatabaseDate(record.fecha_cierre);
    if (!fechaFin.success) {
      return { success: false, error: fechaFin.error };
    }

    // Validate dias
    if (!Number.isInteger(record.dias) || record.dias < 0) {
      return { 
        success: false, 
        error: new ValidationErrorImpl(`Invalid dias value: ${record.dias}`, 'INVALID_TYPE') 
      };
    }

    const caucion: Caucion = {
      id: id || '',
      portfolioId: portfolioId,
      capital: capitalResult.data,
      montoDevolver: montoDevolverResult.data,
      interes: interesResult.data,
      dias: record.dias,
      tna: tnaResult.data,
      fechaInicio: fechaInicio.data,
      fechaFin: fechaFin.data,
      archivo: record.archivo
    };

    return { success: true, data: caucion };

  } catch (error) {
    return { 
      success: false, 
      error: error instanceof ValidationErrorImpl ? error : new ValidationErrorImpl(
        `Unexpected error mapping CSV record: ${error instanceof Error ? error.message : String(error)}`,
        'INVALID_TYPE'
      ) 
    };
  }
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate that an object is a proper DatabaseCauccion row
 * @param obj - Object to validate
 * @returns Result with DatabaseCauccion or validation error
 */
export function validateDatabaseRow(obj: unknown): Result<DatabaseCauccion, ValidationError> {
  if (!obj || typeof obj !== 'object') {
    return { 
      success: false, 
      error: new ValidationErrorImpl('Object must be an object', 'INVALID_TYPE') 
    };
  }

  const row = obj as Record<string, unknown>;
  
  // Check required string fields
  const requiredStringFields: Array<'id' | 'user_id' | 'portfolio_id' | 'fecha_inicio' | 'fecha_fin' | 'archivo'> = [
    'id', 'user_id', 'portfolio_id', 'fecha_inicio', 'fecha_fin', 'archivo'
  ];
  
  for (const field of requiredStringFields) {
    if (!row[field] || typeof row[field] !== 'string') {
      return { 
        success: false, 
        error: new ValidationErrorImpl(`Missing or invalid ${String(field)}`, 'MISSING_FIELD') 
      };
    }
  }

  // Check required numeric fields
  const requiredNumericFields: Array<'capital' | 'monto_devolver' | 'interes' | 'dias' | 'tna_real'> = [
    'capital', 'monto_devolver', 'interes', 'dias', 'tna_real'
  ];
  
  for (const field of requiredNumericFields) {
    const value = row[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { 
        success: false, 
        error: new ValidationErrorImpl(`Invalid ${String(field)}: ${value}`, 'INVALID_TYPE') 
      };
    }
  }

  return { success: true, data: row as DatabaseCauccion };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Safely convert a value to Decimal with validation
 * @param value - Value to convert
 * @param fieldName - Field name for error reporting
 * @returns Result with Decimal or validation error
 */
function safeToDecimal(value: unknown, fieldName: string): Result<DecimalValue, ValidationError> {
  try {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return { success: true, data: new Decimal(value) };
    }
    
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (Number.isFinite(parsed)) {
        return { success: true, data: new Decimal(parsed) };
      }
    }

    return { 
      success: false, 
      error: new ValidationErrorImpl(
        `Invalid decimal value for ${fieldName}: ${value}`,
        'INVALID_DECIMAL'
      ) 
    };
  } catch (error) {
    return { 
      success: false, 
      error: new ValidationErrorImpl(
        `Error converting ${fieldName} to decimal: ${error instanceof Error ? error.message : String(error)}`,
        'INVALID_DECIMAL'
      ) 
    };
  }
}

/**
 * Parse a database date string to a Date object
 * @param dateString - Date string from database
 * @returns Result with Date or validation error
 */
function parseDatabaseDate(dateString: string): Result<Date, ValidationError> {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return { 
        success: false, 
        error: new ValidationErrorImpl(`Invalid date: ${dateString}`, 'INVALID_DATE') 
      };
    }
    return { success: true, data: date };
  } catch (error) {
    return { 
      success: false, 
      error: new ValidationErrorImpl(
        `Error parsing date ${dateString}: ${error instanceof Error ? error.message : String(error)}`,
        'INVALID_DATE'
      ) 
    };
  }
}