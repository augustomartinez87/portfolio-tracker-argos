// ============================================================================
// API DEPRECATED - INGESTIÓN CSV SERVER-SIDE DESCONTINUADA
// ============================================================================
// ESTE ARCHIVO ESTÁ OBSOLETO Y DESCONTINUADO
// 
// El sistema ahora procesa CSV directamente en el cliente:
// - Use el componente CSVUploadView en el frontend
// - Los datos se persisten directamente via financingService.js
// - Ya no se necesita procesamiento server-side
// ============================================================================

export default async function handler(req: any, res: any) {
  return res.status(501).json({
    error: 'Server-side CSV ingestion is discontinued',
    message: 'Use CSV upload in the frontend. CSV processing is now client-side.',
    type: 'DISCONTINUED',
    alternative: 'Use the CSV upload feature in the Financing module',
    workflow: 'CSV → Client parsing → Supabase direct insertion'
  });
}