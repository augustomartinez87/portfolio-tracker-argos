// ============================================================================
// API DEPRECATED - PARSEO PDF DESCONTINUADO
// ============================================================================
// ESTE ARCHIVO ESTÁ OBSOLETO Y DESCONTINUADO
// 
// El sistema ahora opera en modo CSV-only:
// - Use /api/ingest-csv-spread para ingestión de datos
// - Los PDFs ya no son soportados
// ============================================================================

export default async function handler(req: any, res: any) {
  return res.status(501).json({
    error: 'PDF parsing is discontinued',
    message: 'Use CSV upload instead. PDF processing is no longer supported.',
    type: 'DISCONTINUED',
    alternative: 'Use the CSV upload feature in the Financing module',
    documentation: 'See financingService.js for CSV ingestion'
  });
}