// ============================================================================
// FINANCING SERVICE - Type-safe financing operations with Decimal precision
// ============================================================================

// @ts-ignore - Supabase types are complex, use any for now
import { supabase } from '@/lib/supabase';
import { ingestFromCsv } from '../utils/csvSpreadIngestor';
import { Caucion, Result, FinancingMetrics } from '@/types/finance';
import Decimal from 'decimal.js';

// ============================================================================
// AUDIT LOG TYPES
// ============================================================================

interface AuditLogEntry {
  user_id: string | null;
  action: 'EMERGENCY_DELETE_ALL' | 'CLEAR_USER_CAUCIONES' | 'DELETE_ALL_OPERATIONS';
  details: {
    deleted_count: number;
    portfolio_id?: string;
    timestamp: string;
    ip_address?: string;
    user_agent?: string;
  };
  created_at?: string;
}

// ============================================================================
// MAIN SERVICE CLASS - Single source of truth for financing operations
// ============================================================================

export class FinancingService {

  /**
   * Log an audit event for admin/destructive operations
   * @param entry - Audit log entry to persist
   */
  private async _logAuditEvent(entry: AuditLogEntry): Promise<void> {
    try {
      // Try to get browser info if available (won't exist in Node/server context)
      const userAgent = typeof window !== 'undefined' ? window.navigator?.userAgent : 'server';

      const auditRecord = {
        user_id: entry.user_id,
        action: entry.action,
        details: {
          ...entry.details,
          user_agent: userAgent,
        },
        created_at: new Date().toISOString(),
      };

      // Attempt to insert into audit_logs table (create if doesn't exist)
      const { error } = await supabase
        .from('admin_audit_logs')
        .insert([auditRecord]);

      if (error) {
        // If table doesn't exist, log to console as fallback
        // The audit still happens, just to console instead of DB
        console.warn('📋 AUDIT LOG (fallback to console - table may not exist):', JSON.stringify(auditRecord, null, 2));
      } else {
        console.log('📋 AUDIT LOG recorded:', entry.action, 'deleted:', entry.details.deleted_count);
      }
    } catch (err) {
      // Never fail the main operation due to audit logging errors
      console.error('⚠️ Audit logging failed (non-blocking):', err);
      console.warn('📋 AUDIT LOG (fallback):', JSON.stringify(entry, null, 2));
    }
  }

  /**
   * Parse CSV and persist in database with full type safety
   * @param userId - User ID for scoping
   * @param csvText - CSV content to parse
   * @param portfolioId - Portfolio ID for data isolation
   * @returns Result with ingestion results
   */
  async ingestFromCsv(
    userId: string,
    csvText: string,
    portfolioId: string
  ): Promise<Result<{ success: true; records: Caucion[]; totalInserted: number; summary: any }>> {
    try {
      // Input validation
      if (!userId || !portfolioId) {
        return {
          success: false,
          error: new Error('Se requieren userId y portfolioId para la persistencia')
        };
      }

      console.log('🔄 Parseando CSV para user:', userId, 'portfolio:', portfolioId);

      // Parse CSV using existing TypeScript logic
      const parsed = await ingestFromCsv(csvText);
      console.log('✅ CSV parseado - registros:', parsed.records.length);

      if (parsed.records.length === 0) {
        return {
          success: false,
          error: new Error('CSV no contiene registros válidos')
        };
      }

      // Map CSV records to database insert format
      const dbRecords = parsed.records.map(r => ({
        user_id: userId,
        portfolio_id: portfolioId,
        fecha_inicio: r.fecha_apertura,
        fecha_fin: r.fecha_cierre,
        capital: r.capital,
        monto_devolver: r.monto_devolver,
        interes: r.interes,
        dias: r.dias,
        tna_real: r.tna_real,
        archivo: r.archivo,
        // STRICT: operation_key must come from CSV, no fallback
        operation_key: r.operation_key
      }));

      console.log('📝 Upserting', dbRecords.length, 'registros en Supabase (Idempotency Active)...');

      // Use UPSERT instead of INSERT to handle duplicates effectively
      // On conflict (user_id, portfolio_id, operation_key), update the fields to keep them fresh
      const { data, error } = await supabase
        .from('cauciones')
        .upsert(dbRecords, {
          onConflict: 'user_id, portfolio_id, operation_key' // MUST match the unique index
        })
        .select();

      if (error) {
        console.error('❌ Error upserting records:', error);
        return {
          success: false,
          error: new Error(`Error guardando en base de datos: ${error.message}`)
        };
      }

      console.log('✅', data?.length || 0, 'registros procesados (insertados/actualizados)');

      // Convert CSV records to typed Caucion for return
      const typedRecords: Caucion[] = parsed.records.map((record, i) => ({
        id: data && data[i] ? data[i].id : '', // Try to map ID from response
        portfolioId,
        capital: new Decimal(record.capital),
        montoDevolver: new Decimal(record.monto_devolver),
        interes: new Decimal(record.interes),
        dias: record.dias,
        tna: new Decimal(record.tna_real),
        fechaInicio: record.fecha_apertura_dt || new Date(),
        fechaFin: record.fecha_cierre_dt || new Date(),
        archivo: record.archivo
      }));

      return {
        success: true,
        data: {
          success: true,
          records: typedRecords,
          totalInserted: data?.length || 0,
          summary: parsed.summary
        }
      };

    } catch (error) {
      console.error('❌ Error en ingestFromCsv:', error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Retrieve operations from database with type safety
   * @param userId - User ID for scoping
   * @param portfolioId - Portfolio ID for data isolation
   * @returns Result with array of typed cauciones
   */
  async getOperations(
    userId: string,
    portfolioId: string
  ): Promise<Result<Caucion[]>> {
    try {
      console.log('📋 Obteniendo operaciones para user:', userId, 'portfolio:', portfolioId);

      const { data, error } = await supabase
        .from('cauciones')
        .select('*')
        .eq('user_id', userId)
        .eq('portfolio_id', portfolioId)
        .order('fecha_inicio', { ascending: false });

      if (error) throw error;

      console.log('✅', data?.length || 0, 'operaciones obtenidas');

      if (!data || data.length === 0) {
        return { success: true, data: [] };
      }

      // Convert database rows to typed cauciones
      const typedRecords: Caucion[] = data.map((row: any) => ({
        id: row.id,
        portfolioId: row.portfolio_id,
        capital: new Decimal(row.capital),
        montoDevolver: new Decimal(row.monto_devolver),
        interes: new Decimal(row.interes),
        dias: row.dias,
        tna: new Decimal(row.tna_real),
        fechaInicio: new Date(row.fecha_inicio),
        fechaFin: new Date(row.fecha_fin),
        archivo: row.archivo
      }));

      return { success: true, data: typedRecords };

    } catch (error) {
      console.error('❌ Error obteniendo operaciones:', error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Canonical API surface (Single Source of Truth)
  // ---------------------------------------------------------------------------

  /**
   * Canonical read: fetch cauciones for a user, optionally scoped to a portfolio.
   * This replaces legacy read paths and is the single source of truth for UI reads.
   */
  async getCauciones(
    userId: string,
    portfolioId?: string
  ): Promise<Result<Array<{
    id: string;
    fecha_inicio: string;
    fecha_fin: string;
    capital: number;
    monto_devolver: number;
    dias: number;
    tna_real: number;
    archivo?: string;
  }>>> {
    try {
      if (!userId) {
        return { success: false, error: new Error('Se requiere userId') };
      }

      // Build query: across all portfolios if no portfolioId provided, else scoped
      let query = supabase.from('cauciones').select('*').eq('user_id', userId);
      if (portfolioId) {
        query = query.eq('portfolio_id', portfolioId);
      }
      query = query.order('fecha_inicio', { ascending: false });

      const { data, error } = await query as any;
      if (error) throw error;

      if (!data || data.length === 0) {
        return { success: true, data: [] };
      }

      const processed = data.map((row: any) => {
        const dias = this._calculateDaysForRecord(row.fecha_inicio, row.fecha_fin);
        const interes = this._calculateInterestForRecord(row.capital, row.monto_devolver);
        return {
          id: row.id,
          fecha_inicio: row.fecha_inicio,
          fecha_fin: row.fecha_fin,
          capital: row.capital,
          monto_devolver: row.monto_devolver,
          interes: interes.toNumber(),
          dias: row.dias || dias, // Prefer DB days if available
          tna_real: row.tna_real,
          archivo: row.archivo,
          pdf_filename: row.pdf_filename
        };
      });

      return { success: true, data: processed };
    } catch (error) {
      console.error('❌ Error obteniendo cauciones (getCauciones):', error);
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  /**
   * Canonical metrics across all cauciones for a user (no portfolio scope).
   * This is used by UI dashboards where a global view is required.
   */
  async getResumen(userId: string): Promise<any> {
    try {
      if (!userId) {
        return { success: false, error: new Error('Se requiere userId') };
      }

      const { data, error } = await (supabase.from('cauciones')
        .select('capital, monto_devolver, interes, dias, tna_real, fecha_inicio')
        .eq('user_id', userId));

      if (error) throw error;
      const records = data || [];

      if (records.length === 0) {
        return {
          capitalTotal: 0,
          interesTotal: 0,
          montoDevolverTotal: 0,
          tnaPromedioPonderada: 0,
          diasPromedio: 0,
          totalOperaciones: 0,
          primeraOperacion: null,
          ultimaOperacion: null
        };
      }

      // Compute metrics similar to getMetrics, but over all portfolios/records for the user
      const capitalTotal = records.reduce((sum: any, r: any) => sum + Number(r.capital || 0), 0);
      const montoDevolverTotal = records.reduce((sum: any, r: any) => sum + Number(r.monto_devolver || 0), 0);
      const interesTotal = records.reduce((sum: any, r: any) => sum + Number(r.interes || 0), 0);

      const tnaWeightedNumerator = records.reduce((sum: any, r: any) => {
        const cap = Number(r.capital || 0);
        const t = Number(r.tna_real || 0);
        // weight by capital * tna
        return sum + (isNaN(cap) ? 0 : cap) * (isNaN(t) ? 0 : t);
      }, 0);

      const totalDiasWeighted = records.reduce((sum: any, r: any) => {
        const cap = Number(r.capital || 0);
        const d = Number(r.dias || 0);
        return sum + (isNaN(cap) ? 0 : cap) * (isNaN(d) ? 0 : d);
      }, 0);

      const tnaPromedioPonderada = capitalTotal > 0 ? tnaWeightedNumerator / capitalTotal : 0;
      const diasPromedio = capitalTotal > 0 ? totalDiasWeighted / capitalTotal : 0;

      const primeraOperacion = records
        .map((r: any) => new Date(r.fecha_inicio))
        .sort((a: Date, b: Date) => a.getTime() - b.getTime())[0] || null;
      const ultimaOperacion = records
        .map((r: any) => new Date(r.fecha_inicio))
        .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0] || null;

      return {
        capitalTotal: capitalTotal,
        interesTotal: interesTotal,
        montoDevolverTotal: montoDevolverTotal,
        tnaPromedioPonderada: tnaPromedioPonderada,
        diasPromedio: diasPromedio,
        totalOperaciones: records.length,
        primeraOperacion,
        ultimaOperacion
      };
    } catch (error) {
      console.error('❌ Error calculando resumen (getResumen):', error);
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  // Existing methods kept for backward compatibility
  async deleteCaucion(userId: string, operationId: string) {
    return this.deleteOperation(userId, operationId);
  }

  async deleteAllCauciones(userId: string, portfolioId: string) {
    return this.deleteAllOperations(userId, portfolioId);
  }

  /**
   * Calculate comprehensive metrics with corrected TNA formula
   * @param userId - User ID for scoping
   * @param portfolioId - Portfolio ID for data isolation
   * @returns Result with FinancingMetrics using proper weighted TNA
   */
  async getMetrics(
    userId: string,
    portfolioId: string
  ): Promise<Result<FinancingMetrics>> {
    try {
      console.log('📊 Calculando métricas para user:', userId, 'portfolio:', portfolioId);

      const { data, error } = await supabase
        .from('cauciones')
        .select('capital, monto_devolver, interes, dias, tna_real, fecha_inicio, fecha_fin')
        .eq('user_id', userId)
        .eq('portfolio_id', portfolioId);

      if (error) throw error;

      if (!data || data.length === 0) {
        console.log('📭 No hay operaciones, retornando métricas vacías');

        const emptyMetrics: FinancingMetrics = {
          capitalTotal: new Decimal(0),
          interesTotal: new Decimal(0),
          montoDevolverTotal: new Decimal(0),
          tnaPromedioPonderada: new Decimal(0),
          diasPromedio: 0,
          totalOperaciones: 0,
          primeraOperacion: null,
          ultimaOperacion: null
        };

        return { success: true, data: emptyMetrics };
      }

      console.log('📈 Calculando métricas sobre', data.length, 'operaciones');

      // Convert database rows to typed cauciones
      const typedRecords: Caucion[] = data.map((row: any) => ({
        id: row.id,
        portfolioId: row.portfolio_id,
        capital: new Decimal(row.capital),
        montoDevolver: new Decimal(row.monto_devolver),
        interes: new Decimal(row.interes),
        dias: row.dias,
        tna: new Decimal(row.tna_real),
        fechaInicio: new Date(row.fecha_inicio),
        fechaFin: new Date(row.fecha_fin),
        archivo: row.archivo
      }));

      // Calculate weighted TNA properly
      // TNA weighted by Capital (Standard)
      // Duration weighted by Capital
      let capitalTotal = new Decimal(0);
      let totalWeightedTna = new Decimal(0);
      let totalWeightedDays = new Decimal(0);

      for (const c of typedRecords) {
        capitalTotal = capitalTotal.plus(c.capital);

        // Weight TNA by capital
        totalWeightedTna = totalWeightedTna.plus(c.capital.times(c.tna));

        // Weight Days by capital
        totalWeightedDays = totalWeightedDays.plus(c.capital.times(c.dias));
      }

      const tnaPromedioPonderada = capitalTotal.isZero()
        ? new Decimal(0)
        : totalWeightedTna.div(capitalTotal);

      const diasPromedio = capitalTotal.isZero()
        ? 0
        : totalWeightedDays.div(capitalTotal).toNumber();

      const interesTotal = typedRecords.reduce((sum, c) => sum.plus(c.interes), new Decimal(0));
      const montoDevolverTotal = typedRecords.reduce((sum, c) => sum.plus(c.montoDevolver), new Decimal(0));

      const fechas = typedRecords.map(c => c.fechaInicio).sort((a, b) => a.getTime() - b.getTime());
      const primeraOperacion = fechas.length > 0 ? fechas[0] : null;
      const ultimaOperacion = fechas.length > 0 ? fechas[fechas.length - 1] : null;

      const metrics: FinancingMetrics = {
        capitalTotal,
        interesTotal,
        montoDevolverTotal,
        tnaPromedioPonderada,
        diasPromedio,
        totalOperaciones: typedRecords.length,
        primeraOperacion,
        ultimaOperacion
      };

      console.log('✅ Métricas calculadas:', {
        capitalTotal: metrics.capitalTotal.toString(),
        tnaPromedioPonderada: metrics.tnaPromedioPonderada.toString(),
        diasPromedio: metrics.diasPromedio,
        totalOperaciones: metrics.totalOperaciones
      });

      return { success: true, data: metrics };

    } catch (error) {
      console.error('❌ Error calculando métricas:', error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Delete specific operation with safety checks
   * @param userId - User ID for authorization
   * @param operationId - Operation ID to delete
   * @returns Result indicating success or error
   */
  async deleteOperation(
    userId: string,
    operationId: string
  ): Promise<Result<{ success: true }>> {
    try {
      // Input validation
      if (!userId || !operationId) {
        return {
          success: false,
          error: new Error('Se requieren userId y operationId')
        };
      }

      const { error } = await supabase
        .from('cauciones')
        .delete()
        .eq('id', operationId)
        .eq('user_id', userId);

      if (error) throw error;

      console.log('✅ Operación eliminada:', operationId);
      return { success: true, data: { success: true } };

    } catch (error) {
      console.error('❌ Error eliminando operación:', error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Clear all cauciones for all portfolios (debug/admin function)
   * @param userId - User ID for authorization
   * @returns Result with number of deleted operations
   */
  async clearAllUserCauciones(userId: string): Promise<Result<{ deletedCount: number }>> {
    try {
      // Input validation
      if (!userId) {
        return {
          success: false,
          error: new Error('Se requiere userId')
        };
      }

      console.log('🗑️  LIMPIEZA TOTAL - Eliminando TODAS las cauciones para usuario:', userId);

      const { error, count } = await supabase
        .from('cauciones')
        .delete({ count: 'exact' })
        .eq('user_id', userId);

      if (error) throw error;

      const deletedCount = count || 0;

      // Audit logging for admin operation
      await this._logAuditEvent({
        user_id: userId,
        action: 'CLEAR_USER_CAUCIONES',
        details: {
          deleted_count: deletedCount,
          timestamp: new Date().toISOString(),
        },
      });

      console.log('✅ LIMPIEZA TOTAL - Todas las cauciones eliminadas:', deletedCount);
      return {
        success: true,
        data: { deletedCount }
      };

    } catch (error) {
      console.error('❌ Error en limpieza total:', error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * EMERGENCY: Force delete ALL cauciones from database (admin cleanup)
   * This method bypasses user_id and portfolio_id restrictions
   * IMPORTANT: This operation is audit-logged for security compliance
   * @param adminUserId - Optional admin user ID for audit trail (strongly recommended)
   * @returns Result with number of deleted operations
   */
  async emergencyDeleteAllCauciones(adminUserId?: string): Promise<Result<{ deletedCount: number }>> {
    try {
      console.log('🚨 EMERGENCY DELETE - Eliminando TODAS las cauciones de la base de datos');

      const { error, count } = await supabase
        .from('cauciones')
        .delete({ count: 'exact' })
        .neq('id', ''); // Delete ALL records (no restriction)

      let deletedCount = 0;

      if (error) {
        console.error('❌ Error en emergencia:', error);
        // Try alternative method
        const { error: altError, count: altCount } = await supabase
          .rpc('clear_all_cauciones'); // If RPC function exists

        if (altError) {
          throw altError;
        }

        deletedCount = altCount || 0;
        console.log('✅ LIMPIEZA EMERGENCIA por RPC:', deletedCount);
      } else {
        deletedCount = count || 0;
        console.log('✅ LIMPIEZA EMERGENCIA exitosa:', deletedCount);
      }

      // CRITICAL: Audit logging for emergency admin operation
      await this._logAuditEvent({
        user_id: adminUserId || null,
        action: 'EMERGENCY_DELETE_ALL',
        details: {
          deleted_count: deletedCount,
          timestamp: new Date().toISOString(),
        },
      });

      return {
        success: true,
        data: { deletedCount }
      };

    } catch (error) {
      console.error('❌ Error en limpieza emergencia:', error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Delete all cauciones for a user and portfolio
   * @param userId - User ID for authorization
   * @param portfolioId - Portfolio ID for data isolation
   * @returns Result with number of deleted operations
   */
  async deleteAllOperations(
    userId: string,
    portfolioId: string
  ): Promise<Result<{ deletedCount: number }>> {
    try {
      // Input validation
      if (!userId || !portfolioId) {
        return {
          success: false,
          error: new Error('Se requieren userId y portfolioId')
        };
      }

      console.log('🗑️  Eliminando todas las cauciones para usuario:', userId, 'portfolio:', portfolioId);

      const { error, count } = await supabase
        .from('cauciones')
        .delete({ count: 'exact' })
        .eq('user_id', userId)
        .eq('portfolio_id', portfolioId);

      if (error) throw error;

      const deletedCount = count || 0;

      // Audit logging for bulk delete operation
      await this._logAuditEvent({
        user_id: userId,
        action: 'DELETE_ALL_OPERATIONS',
        details: {
          deleted_count: deletedCount,
          portfolio_id: portfolioId,
          timestamp: new Date().toISOString(),
        },
      });

      console.log('✅ Todas las cauciones eliminadas:', deletedCount);
      return {
        success: true,
        data: { deletedCount }
      };

    } catch (error) {
      console.error('❌ Error eliminando todas las cauciones:', error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Check for duplicate operations with improved logic
   * @param userId - User ID for scoping
   * @param portfolioId - Portfolio ID for data isolation
   * @param csvRecords - Records to check for duplicates
   * @returns Result with duplicate analysis
   */
  async checkDuplicateOperations(
    userId: string,
    portfolioId: string,
    csvRecords: import('@/types/finance').CsvRecord[]
  ): Promise<Result<{ duplicates: number; duplicateRecords: import('@/types/finance').CsvRecord[] }>> {
    try {
      // Search for existing operations with same fecha_inicio and capital
      const { data, error } = await supabase
        .from('cauciones')
        .select('fecha_inicio, capital')
        .eq('user_id', userId)
        .eq('portfolio_id', portfolioId);

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          success: true,
          data: { duplicates: 0, duplicateRecords: [] }
        };
      }

      // Find potential duplicates with Decimal comparison for precision
      const duplicates: import('@/types/finance').CsvRecord[] = [];

      csvRecords.forEach(record => {
        const existing = data.find((existing: any) =>
          existing.fecha_inicio === record.fecha_apertura
        );

        if (existing) {
          // Use Decimal comparison for precision (avoid floating point issues)
          const existingCapital = new Decimal(existing.capital);
          const recordCapital = new Decimal(record.capital);
          const difference = existingCapital.minus(recordCapital).abs();

          // Consider duplicate if difference is less than 0.01 (1 centavo precision)
          if (difference.lessThan(new Decimal('0.01'))) {
            duplicates.push(record);
          }
        }
      });

      console.log('🔍 Análisis de duplicados:', {
        totalRecords: csvRecords.length,
        duplicatesFound: duplicates.length
      });

      return {
        success: true,
        data: {
          duplicates: duplicates.length,
          duplicateRecords: duplicates
        }
      };

    } catch (error) {
      console.error('❌ Error verificando duplicados:', error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  // ============================================================================
  // UI CALCULATION METHODS - Expose calculations for UI components
  // These are the ONLY methods UI components should use for calculations
  // ============================================================================

  /**
   * Get cauciones with all calculated fields for UI display
   * @param userId - User ID for authorization
   * @param portfolioId - Portfolio ID for data isolation
   * @returns Result with cauciones array including calculated fields
   */
  async getCaucionesWithCalculations(
    userId: string,
    portfolioId: string
  ): Promise<Result<Array<{
    id: string;
    fecha_inicio: string;
    fecha_fin: string;
    capital: number;
    monto_devolver: number;
    interes: number;
    dias: number;
    tna_real: number;
    archivo?: string;
    pdf_filename?: string;
  }>>> {
    try {
      // Validate inputs
      if (!userId || !portfolioId) {
        return {
          success: false,
          error: new Error('Se requieren userId y portfolioId')
        };
      }

      // Fetch raw data
      console.log('🔍 Querying cauciones for userId:', userId, 'portfolioId:', portfolioId);
      const { data, error } = await supabase
        .from('cauciones')
        .select('*')
        .eq('user_id', userId)
        .eq('portfolio_id', portfolioId)
        .order('fecha_fin', { ascending: false });

      if (error) {
        console.error('❌ Supabase error:', error);
        throw error;
      }

      console.log('📊 Raw cauciones data:', data.length, 'records');

      if (!data || data.length === 0) {
        return { success: true, data: [] };
      }

      // Process each record with calculations using internal financialCalculations
      const processedData = data.map((row: any) => {
        const dias = this._calculateDaysForRecord(row.fecha_inicio, row.fecha_fin);
        const interes = this._calculateInterestForRecord(row.capital, row.monto_devolver);

        return {
          id: row.id,
          fecha_inicio: row.fecha_inicio,
          fecha_fin: row.fecha_fin,
          capital: row.capital,
          monto_devolver: row.monto_devolver,
          interes: interes.toNumber(),
          dias,
          tna_real: row.tna_real,
          archivo: row.archivo
        };
      });

      return { success: true, data: processedData };

    } catch (error) {
      console.error('❌ Error obteniendo cauciones con cálculos:', error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Calculate days between dates (internal method)
   * Only FinancingService can call this
   */
  private _calculateDaysForRecord(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }

  /**
   * Calculate interest from capital and monto_devolver (internal method)
   * Only FinancingService can call this
   */
  private _calculateInterestForRecord(capital: number, montoDevolver: number): InstanceType<typeof Decimal> {
    const capitalDecimal = new Decimal(capital || 0);
    const montoDevolverDecimal = new Decimal(montoDevolver || 0);
    return montoDevolverDecimal.minus(capitalDecimal);
  }

  /**
   * Get calculated TNA for a single record
   * @param capital - Principal amount
   * @param interest - Interest amount
   * @param days - Number of days
   * @returns TNA as decimal (0.3308)
   */
  calculateTnaForRecord(capital: number, interest: number, days: number): number {
    if (capital <= 0 || days <= 0) {
      return 0;
    }

    const capitalDecimal = new Decimal(capital);
    const interestDecimal = new Decimal(interest);
    const daysDecimal = new Decimal(days);

    const tnaDecimal = interestDecimal
      .div(capitalDecimal)
      .times(new Decimal(365))
      .div(daysDecimal);

    return tnaDecimal.toNumber();
  }

  /**
   * Calculate spread between two rates
   * @param rate1 - First rate (as decimal: 0.3308)
   * @param rate2 - Second rate (as decimal: 0.2500)
   * @returns Spread as decimal (0.0808)
   */
  calculateSpread(rate1: number, rate2: number): number {
    const rate1Decimal = new Decimal(rate1 || 0);
    const rate2Decimal = new Decimal(rate2 || 0);
    return rate1Decimal.minus(rate2Decimal).toNumber();
  }
}

// Export singleton instance as default to maintain compatibility with JS imports
// This allows imports like: import financingService from './financingService'
export const financingService = new FinancingService();
export default financingService;
