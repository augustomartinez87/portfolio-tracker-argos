-- ============================================================================
-- MIGRACIÓN: 015_cleanup_pdf_and_external_ingestion.sql
-- DESCRIPCIÓN: Limpieza total del flujo de cauciones. Elimina todo rastro de:
--   - PDF parsing
--   - Google Sheets sync
--   - Ingesta automática
--   - Columnas de auditoría PDF
-- SOLO QUEDA: CSV upload manual → Supabase cauciones
-- ============================================================================

-- ============================================================================
-- 1. LIMPIEZA DE STORAGE (PDF BUCKET)
-- ============================================================================

-- Eliminar bucket de PDFs (esto elimina todos los archivos también)
DELETE FROM storage.objects WHERE bucket_id = 'caucion-pdfs';
DELETE FROM storage.buckets WHERE id = 'caucion-pdfs';

-- Eliminar políticas del bucket (si quedaron huérfanas)
DROP POLICY IF EXISTS "Users can upload own caucion PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own caucion PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own caucion PDFs" ON storage.objects;

-- ============================================================================
-- 2. LIMPIEZA DE TABLAS Y COLUMNAS PDF
-- ============================================================================

-- Eliminar tabla de rechazados (solo usada por PDF parser)
DROP TABLE IF EXISTS public.cauciones_rejected CASCADE;

-- Eliminar columnas relacionadas con PDF de la tabla cauciones
ALTER TABLE public.cauciones DROP COLUMN IF EXISTS raw_text;
ALTER TABLE public.cauciones DROP COLUMN IF EXISTS parse_version;
ALTER TABLE public.cauciones DROP COLUMN IF EXISTS pdf_url;
ALTER TABLE public.cauciones DROP COLUMN IF EXISTS pdf_storage_path;
ALTER TABLE public.cauciones DROP COLUMN IF EXISTS pdf_filename;
ALTER TABLE public.cauciones DROP COLUMN IF EXISTS boleto;

-- Eliminar columnas de auditoría de procesamiento PDF
ALTER TABLE public.cauciones DROP COLUMN IF EXISTS tipo_operacion;
ALTER TABLE public.cauciones DROP COLUMN IF EXISTS fecha_liquidacion;
ALTER TABLE public.cauciones DROP COLUMN IF EXISTS boleto_numero;
ALTER TABLE public.cauciones DROP COLUMN IF EXISTS garantias_hash;
ALTER TABLE public.cauciones DROP COLUMN IF EXISTS status;
ALTER TABLE public.cauciones DROP COLUMN IF EXISTS validation_metadata;
ALTER TABLE public.cauciones DROP COLUMN IF EXISTS processing_logs;

-- ============================================================================
-- 3. LIMPIEZA DE ÍNDICES Y CONSTRAINTS HUÉRFANOS
-- ============================================================================

-- Eliminar índices relacionados con columnas eliminadas
DROP INDEX IF EXISTS idx_cauciones_pdf_path;
DROP INDEX IF EXISTS idx_cauciones_operation_key;

-- NOTA: NO eliminamos idx_cauciones_idempotency (unique en operation_key)
-- porque es CRÍTICO para el flujo CSV

-- ============================================================================
-- 4. DOCUMENTACIÓN DEL CAMPO CSV
-- ============================================================================

-- Agregar comentarios a columnas CSV (opcional pero útil)
COMMENT ON TABLE public.cauciones IS 'Operaciones de caución - Solo vía CSV upload';
COMMENT ON COLUMN public.cauciones.fecha_inicio IS 'Fecha de inicio (YYYY-MM-DD) - CSV: fecha_apertura';
COMMENT ON COLUMN public.cauciones.fecha_fin IS 'Fecha de fin (YYYY-MM-DD) - CSV: fecha_cierre';
COMMENT ON COLUMN public.cauciones.capital IS 'Capital caucionado';
COMMENT ON COLUMN public.cauciones.monto_devolver IS 'Monto total a devolver (capital + interes)';
COMMENT ON COLUMN public.cauciones.interes IS 'Interés calculado (monto_devolver - capital)';
COMMENT ON COLUMN public.cauciones.dias IS 'Días de duración de la caución';
COMMENT ON COLUMN public.cauciones.tna_real IS 'TNA real (ej: 33.08 para 33.08%)';
COMMENT ON COLUMN public.cauciones.archivo IS 'Nombre del archivo CSV origen';
COMMENT ON COLUMN public.cauciones.operation_key IS 'ID único para idempotencia (obligatorio en CSV)';
COMMENT ON COLUMN public.cauciones.user_id IS 'Usuario propietario (RLS)';
COMMENT ON COLUMN public.cauciones.portfolio_id IS 'Portfolio asociado (RLS + scope)';

-- ============================================================================
-- 5. VERIFICACIÓN DE LIMPIEZA
-- ============================================================================

-- Verificar columnas restantes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cauciones' 
ORDER BY ordinal_position;

-- Verificar que no queden tablas de rechazados
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%caucion%';

-- Verificar buckets de storage
SELECT id, name 
FROM storage.buckets 
WHERE id LIKE '%caucion%';

-- ============================================================================
-- 6. NOTAS DE IMPLEMENTACIÓN
-- ============================================================================

/*
POST-MIGRACIÓN:

1. Frontend debe eliminar:
   - Botón "Sincronizar Sheets"
   - Código de ingestFromUrl()
   - Cualquier referencia a PDF upload

2. CSV obligatorio con headers:
   fecha_apertura,fecha_cierre,capital,monto_devolver,interes,dias,tna_real,archivo,operation_key

3. Formato de fechas: YYYY-MM-DD
   Ejemplo: 2024-01-15

4. operation_key: string único por operación
   Ejemplo: 2024-01-15_1000000_1002739.73_2739.73_boleto123

5. La idempotency se mantiene vía UNIQUE INDEX en (user_id, portfolio_id, operation_key)
   NO ELIMINAR este índice bajo ninguna circunstancia.
*/
