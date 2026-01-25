// ============================================================================
// LEGACY - DEPRECATED - Usar financingService.js en su lugar
// Este archivo se mantiene temporalmente por compatibilidad pero está obsoleto
// ============================================================================

import { financingService } from './financingService';
import { supabase } from '../lib/supabase';

// Re-exportar para compatibilidad hacia atrás
export const caucionService = {
  ...financingService,

  // Canonical wrappers for the new single-source path (backwards compatibility kept briefly)
  async getCauciones(userId, portfolioId) {
    return financingService.getCauciones(userId, portfolioId);
  },

  async getResumen(userId) {
    // Global summary across all portfolios for the user
    return financingService.getResumen(userId);
  },

  async deleteCaucion(userId, id) {
    return financingService.deleteOperation(userId, id);
  },

  async deleteAllCauciones(userId, portfolioId) {
    return financingService.deleteAllOperations(userId, portfolioId);
  },

  async existePDF(userId, pdfName) {
    // Check across all cauciones for a matching pdf/archivo name
    try {
      const { data, error } = await supabase
        .from('cauciones')
        .select('id')
        .eq('user_id', userId)
        .or(`archivo.eq.${pdfName},pdf_filename.eq.${pdfName}`);
      if (error) throw error;
      return !!(data && data.length > 0);
    } catch (err) {
      // In case of error, assume not exists to avoid blocking flow
      console.error('❌ Error checking PDF existence:', err);
      return false;
    }
  },

  async uploadPDFAndTriggerParsing(userId, file) {
    // PDF ingestion via remote service is deprecated. UI now uses CSV.
    // Return a neutral success to keep compatibility for older flows.
    return { success: true, operations: [] };
  },

  async insertCauciones() {
    throw new Error('❌ insertCauciones está descontinuado. Use financingService.ingestFromCsv en su lugar.');
  },
  async existePDFDeprecated() {
    throw new Error('❌ existePDF está descontinuado. Use CSV ingestion with financingService.');
  }
};

// Exportar el nuevo servicio por defecto
export default financingService;
