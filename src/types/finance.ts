// ============================================================================
// FINANCE TYPES - Core financing module type definitions
// ============================================================================

import Decimal from 'decimal.js';

// ============================================================================
// RESULT PATTERN - Robust error handling throughout the system
// ============================================================================

export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// ============================================================================
// CORE FINANCIAL ENTITY - Single source of truth for financing data
// ============================================================================

export interface Caucion {
  id: string;
  portfolioId: string;
  capital: InstanceType<typeof Decimal>;           // Exact decimal arithmetic
  montoDevolver: InstanceType<typeof Decimal>;     // Amount to be returned
  interes: InstanceType<typeof Decimal>;           // Interest earned
  dias: number;               // Number of days (integer)
  tna: InstanceType<typeof Decimal>;               // TNA as decimal (0.3308), NOT percentage
  fechaInicio: Date;          // Start date
  fechaFin: Date;            // End date
  archivo?: string;           // Source CSV file name
}

// ============================================================================
// DATABASE MAPPING - Direct mapping to Supabase cauciones table
// ============================================================================

export interface DatabaseCaucion {
  id: string;
  user_id: string;
  portfolio_id: string;
  fecha_inicio: string;       // ISO date string from DB
  fecha_fin: string;         // ISO date string from DB
  capital: number;            // Numeric value from DB
  monto_devolver: number;    // Numeric value from DB
  interes: number;           // Numeric value from DB
  dias: number;              // Integer from DB
  tna_real: number;          // TNA as decimal (0.3308) from DB - NO CONVERSION
  archivo: string;           // Source file name
  created_at?: string;       // Creation timestamp (optional)
}

// ============================================================================
// FINANCIAL METRICS - Aggregated calculations for dashboard
// ============================================================================

export interface FinancingMetrics {
  capitalTotal: InstanceType<typeof Decimal>;              // Total capital using Decimal
  interesTotal: InstanceType<typeof Decimal>;              // Total interest using Decimal
  montoDevolverTotal: InstanceType<typeof Decimal>;        // Total amount to return using Decimal
  tnaPromedioPonderada: InstanceType<typeof Decimal>;      // Weighted average TNA (capital*dias weighted)
  diasPromedio: number;               // Average days (simple average)
  totalOperaciones: number;           // Number of operations
  primeraOperacion: Date | null;      // First operation date
  ultimaOperacion: Date | null;       // Last operation date
}

// ============================================================================
// UI FORMATTING INTERFACES - For display layer only
// ============================================================================

export interface DisplayCaucion extends Omit<Caucion, 'tna'> {
  tnaDisplay: string;                 // TNA formatted as percentage (33.08%)
  capitalDisplay: string;             // Capital formatted as currency
  montoDevolverDisplay: string;       // Amount to return formatted as currency
  interesDisplay: string;             // Interest formatted as currency
}

// ============================================================================
// CSV PROCESSING INTERFACES - Integration with existing CSV ingestor
// ============================================================================

export interface CsvRecord {
  fecha_apertura: string;
  fecha_cierre: string;
  capital: number;
  monto_devolver: number;
  interes: number;
  dias: number;
  tna_real: number;                  // Decimal format (0.3308)
  archivo: string;
}

export interface DerivedRecord extends CsvRecord {
  fecha_apertura_dt?: Date;
  fecha_cierre_dt?: Date;
}

export interface TenorCurvePoint {
  tenor: number;
  totalCapital: number;
  totalMontoDevolver: number;
  totalInteres: number;
  curveTnaProm: number;               // Weighted average tna_real for this tenor
}

export interface IngestResult {
  records: DerivedRecord[];
  summary: {
    totalCapital: number;
    totalMontoDevolver: number;
    totalInteres: number;
    tnaPromedioSimple: number;
    tnaPromedioPonderado: number;
    totalRecords: number;
  };
  curve: TenorCurvePoint[];
  spreads?: { tenor: number; avgSpread: number; }[];
}

// ============================================================================
// VALIDATION INTERFACES - Type safety and validation
// ============================================================================

export interface ValidationError extends Error {
  field?: string;
  value?: unknown;
  code: 'INVALID_TYPE' | 'MISSING_FIELD' | 'INVALID_DATE' | 'INVALID_DECIMAL';
}

export interface DatabaseRowValidation {
  id: boolean;
  user_id: boolean;
  portfolio_id: boolean;
  fecha_inicio: boolean;
  fecha_fin: boolean;
  capital: boolean;
  monto_devolver: boolean;
  interes: boolean;
  dias: boolean;
  tna_real: boolean;
  archivo: boolean;
}

// ============================================================================
// OPERATION INTERFACES - Service layer operations
// ============================================================================

export interface CaucionCreateInput {
  portfolioId: string;
  capital: InstanceType<typeof Decimal>;
  montoDevolver: InstanceType<typeof Decimal>;
  interes: InstanceType<typeof Decimal>;
  dias: number;
  tna: InstanceType<typeof Decimal>;
  fechaInicio: Date;
  fechaFin: Date;
  archivo?: string;
}

export interface CaucionUpdateInput {
  capital?: InstanceType<typeof Decimal>;
  montoDevolver?: InstanceType<typeof Decimal>;
  interes?: InstanceType<typeof Decimal>;
  dias?: number;
  tna?: InstanceType<typeof Decimal>;
  fechaInicio?: Date;
  fechaFin?: Date;
  archivo?: string;
}

// ============================================================================
// CONFIGURATION AND CONSTANTS
// ============================================================================

export const FINANCE_CONFIG = {
  // TNA is stored as decimal (0.3308) not percentage (33.08)
  TNA_DECIMAL_PRECISION: 4,
  CURRENCY_DECIMAL_PLACES: 2,
  DATE_FORMAT: 'YYYY-MM-DD',
  DEFAULT_DIAS_OPERATION: 1,
} as const;

// ============================================================================
// TYPE GUARDS - Runtime type checking utilities
// ============================================================================

export function isDatabaseCaucion(obj: unknown): obj is DatabaseCaucion {
  return typeof obj === 'object' && obj !== null &&
    'id' in obj && 'user_id' in obj && 'portfolio_id' in obj &&
    'fecha_inicio' in obj && 'fecha_fin' in obj &&
    'capital' in obj && 'monto_devolver' in obj && 'interes' in obj &&
    'dias' in obj && 'tna_real' in obj && 'archivo' in obj;
}

export function isCauccion(obj: unknown): obj is Caucion {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  
  const cast = obj as Record<string, unknown>;
  return 'id' in cast && 'portfolioId' in cast &&
    cast['capital'] instanceof Decimal &&
    cast['montoDevolver'] instanceof Decimal &&
    cast['interes'] instanceof Decimal &&
    cast['tna'] instanceof Decimal;
}