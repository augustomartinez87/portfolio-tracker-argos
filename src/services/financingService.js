// ============================================================================
// FINANCIACIÓN 2.0 - SERVICIO DE PERSISTENCIA CSV
// Reemplaza caucionService.js para operación CSV-only con Supabase
// ============================================================================

import { supabase } from '../lib/supabase';
import { ingestFromCsv } from '../ingest/csvSpreadIngestor';

export const financingService = {
  // 1. Parsear CSV y persistir en DB (core de la persistencia)
  async ingestFromCsv(userId, csvText, portfolioId) {
    try {
      if (!userId || !portfolioId) {
        throw new Error('Se requieren userId y portfolioId para la persistencia');
      }

      console.log('🔄 Parseando CSV para user:', userId, 'portfolio:', portfolioId);
      
      // Parsear CSV usando lógica existente
      const parsed = await ingestFromCsv(csvText);
      console.log('✅ CSV parseado - registros:', parsed.records.length);
      
      if (parsed.records.length === 0) {
        throw new Error('CSV no contiene registros válidos');
      }
      
      // Transformar registros para insertar en DB
      const dbRecords = parsed.records.map(r => ({
        user_id: userId,
        portfolio_id: portfolioId,
        fecha_inicio: r.fecha_apertura,
        fecha_fin: r.fecha_cierre,
        capital: r.capital,
        monto_devolver: r.monto_devolver,
        archivo: r.archivo
        // Nota: tna_real se calcula automáticamente en DB
        // interes, dias también se calculan automáticamente
      }));

      console.log('📝 Insertando', dbRecords.length, 'registros en Supabase...');

      // Insertar en lote para mejor performance
      const { data, error } = await supabase
        .from('cauciones')
        .insert(dbRecords)
        .select();

      if (error) {
        console.error('❌ Error inserting records:', error);
        throw new Error(`Error guardando en base de datos: ${error.message}`);
      }

      console.log('✅', data.length, 'registros guardados exitosamente');

      return {
        success: true,
        records: data,
        summary: parsed.summary,
        curve: parsed.curve,
        totalInserted: data.length
      };

    } catch (error) {
      console.error('❌ Error en ingestFromCsv:', error);
      throw error;
    }
  },

  // 2. Obtener operaciones desde DB (para React Query)
  async getOperations(userId, portfolioId) {
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
      return data || [];

    } catch (error) {
      console.error('❌ Error obteniendo operaciones:', error);
      throw error;
    }
  },

  // 3. Calcular métricas desde DB (single source of truth)
  async getMetrics(userId, portfolioId) {
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

      console.log('📈 Calculando métricas sobre', data.length, 'operaciones');

      // Calcular métricas usando datos reales de la DB
      const capitalTotal = data.reduce((sum, c) => sum + Number(c.capital || 0), 0);
      const montoDevolverTotal = data.reduce((sum, c) => sum + Number(c.monto_devolver || 0), 0);
      const interesTotal = data.reduce((sum, c) => sum + Number(c.interes || 0), 0);
      
      // TNA promedio ponderada por capital (formato % desde DB)
      const tnaPromedioPonderada = capitalTotal > 0 
        ? data.reduce((sum, c) => sum + (Number(c.capital || 0) * Number(c.tna_real || 0)), 0) / capitalTotal
        : 0;

      const diasPromedio = data.length > 0 
        ? data.reduce((sum, c) => sum + Number(c.dias || 0), 0) / data.length 
        : 0;

      const fechas = data.map(c => new Date(c.fecha_inicio)).sort((a, b) => a - b);

      const metrics = {
        capitalTotal,
        montoDevolverTotal,
        interesTotal,
        tnaPromedioPonderada,
        diasPromedio,
        totalOperaciones: data.length,
        primeraOperacion: fechas[0],
        ultimaOperacion: fechas[fechas.length - 1]
      };

      console.log('✅ Métricas calculadas:', {
        capitalTotal: metrics.capitalTotal,
        tnaPromedioPonderada: metrics.tnaPromedioPonderada.toFixed(2) + '%',
        totalOperaciones: metrics.totalOperaciones
      });

      return metrics;

    } catch (error) {
      console.error('❌ Error calculando métricas:', error);
      throw error;
    }
  },

  // 4. Eliminar operación específica (para futuro CRUD)
  async deleteOperation(userId, operationId) {
    try {
      const { error } = await supabase
        .from('cauciones')
        .delete()
        .eq('id', operationId)
        .eq('user_id', userId);

      if (error) throw error;

      console.log('✅ Operación eliminada:', operationId);
      return { success: true };

    } catch (error) {
      console.error('❌ Error eliminando operación:', error);
      throw error;
    }
  },

  // 5. Obtener cauciones (wrapper para compatibilidad)
  async getCauciones(userId, portfolioId) {
    return this.getOperations(userId, portfolioId);
  },

  // 6. Obtener resumen global (para SpreadPage)
  async getResumen(userId) {
    try {
      console.log('📊 Obteniendo resumen global para user:', userId);

      const { data, error } = await supabase
        .from('cauciones')
        .select('capital, monto_devolver, interes, dias, tna_real, fecha_inicio, fecha_fin')
        .eq('user_id', userId);

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          capitalTotal: 0,
          interesTotal: 0,
          montoDevolverTotal: 0,
          tnaPromedioPonderada: 0,
          diasPromedio: 0,
          totalOperaciones: 0
        };
      }

      const capitalTotal = data.reduce((sum, c) => sum + Number(c.capital || 0), 0);
      const montoDevolverTotal = data.reduce((sum, c) => sum + Number(c.monto_devolver || 0), 0);
      const interesTotal = data.reduce((sum, c) => sum + Number(c.interes || 0), 0);
      
      const tnaPromedioPonderada = capitalTotal > 0 
        ? data.reduce((sum, c) => sum + (Number(c.capital || 0) * Number(c.tna_real || 0)), 0) / capitalTotal
        : 0;

      const diasPromedio = data.length > 0 
        ? data.reduce((sum, c) => sum + Number(c.dias || 0), 0) / data.length 
        : 0;

      return {
        capitalTotal,
        montoDevolverTotal,
        interesTotal,
        tnaPromedioPonderada,
        diasPromedio,
        totalOperaciones: data.length
      };

    } catch (error) {
      console.error('❌ Error obteniendo resumen:', error);
      throw error;
    }
  },

  // 7. Verificar si CSV ya fue procesado (duplicados)
  async checkDuplicateOperations(userId, portfolioId, csvRecords) {
    try {
      // Buscar operaciones con misma fecha_inicio y capital en mismo período
      const { data, error } = await supabase
        .from('cauciones')
        .select('fecha_inicio, capital')
        .eq('user_id', userId)
        .eq('portfolio_id', portfolioId);

      if (error) throw error;

      if (!data || data.length === 0) return { duplicates: 0, duplicateRecords: [] };

      // Encontrar duplicados potenciales
      const duplicates = [];
      csvRecords.forEach(record => {
        const existing = data.find(existing => 
          existing.fecha_inicio === record.fecha_apertura && 
          Math.abs(Number(existing.capital) - Number(record.capital)) < 0.01
        );
        if (existing) {
          duplicates.push(record);
        }
      });

      return {
        duplicates: duplicates.length,
        duplicateRecords: duplicates
      };

    } catch (error) {
      console.error('❌ Error verificando duplicados:', error);
      throw error;
    }
  }
};

// Exportar por defecto para compatibilidad
export default financingService;