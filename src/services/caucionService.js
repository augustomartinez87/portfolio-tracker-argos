// ============================================================================
// LEGACY - DEPRECATED - Usar financingService.js en su lugar
// Este archivo se mantiene temporalmente por compatibilidad pero está obsoleto
// ============================================================================

import { financingService } from './financingService';

// Re-exportar para compatibilidad hacia atrás
export const caucionService = {
  ...financingService,
  
  // Métodos deprecados con warnings
  async uploadPDFAndTriggerParsing() {
    throw new Error('❌ PDF upload está descontinuado. Use CSV upload en su lugar.');
  },
  
  async insertCauciones() {
    throw new Error('❌ insertCauciones está descontinuado. Use financingService.ingestFromCsv en su lugar.');
  },
  
  async existePDF() {
    throw new Error('❌ existePDF está descontinuado. Solo se soporta CSV.');
  }
};

// Exportar el nuevo servicio por defecto
export default financingService;
