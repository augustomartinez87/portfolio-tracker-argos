// ============================================================================
// FINANCING SERVICE - Type-safe financing operations with Decimal precision
// ============================================================================

// @ts-ignore - Supabase types are complex, use any for now
import { supabase } from '../lib/supabase';
import { ingestFromCsv } from '../ingest/csvSpreadIngestor';
import { Caucion, Result, FinancingMetrics } from '../types/finance';

// ============================================================================
// MAIN SERVICE CLASS - Single source of truth for financing operations
// ============================================================================

export class FinancingService {
  
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
  ): Promise<Result<{ success: true; records: Caucion[]; totalInserted: number } | { success: false; error: Error }>> {
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
        archivo: r.archivo
      }));

      console.log('📝 Insertando', dbRecords.length, 'registros en Supabase...');

      // Insert in batch for better performance
      const { data, error } = await supabase
        .from('cauciones')
        .insert(dbRecords)
        .select();

      if (error) {
        console.error('❌ Error inserting records:', error);
        return { 
          success: false, 
          error: new Error(`Error guardando en base de datos: ${error.message}`) 
        };
      }

      console.log('✅', data?.length || 0, 'registros guardados exitosamente');

      // Convert CSV records to typed Caucion for return
      const typedRecords: Caucion[] = parsed.records.map(record => ({
        id: '', // Will be filled by database
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
          records: typedRecords,
          totalInserted: data?.length || 0
        } as { success: true; records: Caucion[]; totalInserted: number }
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
      let totalWeightedTna = new Decimal(0);
      let totalCapitalDays = new Decimal(0);
      
      for (const c of typedRecords) {
        const weighted = c.capital.times(c.tna).times(c.dias);
        const capitalDays = c.capital.times(c.dias);
        totalWeightedTna = totalWeightedTna.plus(weighted);
        totalCapitalDays = totalCapitalDays.plus(capitalDays);
      }
      
      const tnaPromedioPonderada = totalCapitalDays.isZero() 
        ? new Decimal(0) 
        : totalWeightedTna.div(totalCapitalDays);

      const capitalTotal = typedRecords.reduce((sum, c) => sum.plus(c.capital), new Decimal(0));
      const interesTotal = typedRecords.reduce((sum, c) => sum.plus(c.interes), new Decimal(0));
      const montoDevolverTotal = typedRecords.reduce((sum, c) => sum.plus(c.montoDevolver), new Decimal(0));
      
      const diasPromedio = typedRecords.length > 0 
        ? typedRecords.reduce((sum, c) => sum + c.dias, 0) / typedRecords.length 
        : 0;

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
        tnaPromedioPonderada: metrics.tnaPromedioPonderada.times(100).toFixed(4) + '%',
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
   * Check for duplicate operations with improved logic
   * @param userId - User ID for scoping
   * @param portfolioId - Portfolio ID for data isolation
   * @param csvRecords - Records to check for duplicates
   * @returns Result with duplicate analysis
   */
  async checkDuplicateOperations(
    userId: string, 
    portfolioId: string, 
    csvRecords: import('../types/finance').CsvRecord[]
  ): Promise<Result<{ duplicates: number; duplicateRecords: import('../types/finance').CsvRecord[] }>> {
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
      const duplicates: import('../types/finance').CsvRecord[] = [];
      
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
}

// ============================================================================
// DEFAULT EXPORT - Backward compatibility
// ============================================================================

export const financingService = new FinancingService();

// Export default for compatibility with existing imports
export default financingService;