-- ============================================================================
-- SQL 3: ACTUALIZAR CAMPOS FALTANTES
-- Ejecutar TERCERO en Supabase SQL Editor (después del SQL 1 y 2)
-- ============================================================================

-- 1. Actualizar tabla cauciones con campos faltantes para server-side parsing
ALTER TABLE cauciones 
ADD COLUMN IF NOT EXISTS raw_text TEXT,
ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;

-- 2. Actualizar índice para storage path
CREATE INDEX IF NOT EXISTS idx_cauciones_pdf_path ON cauciones(user_id, pdf_storage_path);

-- 3. Crear vista de resumen
CREATE OR REPLACE VIEW cauciones_resumen AS
SELECT
  user_id,
  COUNT(*) AS total_operaciones,
  SUM(capital) AS capital_total,
  SUM(interes) AS interes_total,
  SUM(capital * tna_real) / NULLIF(SUM(capital), 0) AS tna_promedio_ponderada,
  MIN(fecha_inicio) AS primera_operacion,
  MAX(fecha_fin) AS ultima_operacion,
  SUM(dias) AS dias_totales
FROM cauciones
GROUP BY user_id;

-- Verificación final completa
SELECT 
  'Table Columns' as component,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'cauciones' 

UNION ALL

SELECT 
  'Storage Info' as component,
  'bucket' as column_name,
  id::text as data_type,
  'active' as is_nullable
FROM storage.buckets 
WHERE id = 'caucion-pdfs'

UNION ALL

SELECT 
  'Policies Count' as component,
  COUNT(*)::text as column_name,
  'policies' as data_type,
  'active' as is_nullable
FROM pg_policies 
WHERE tablename = 'cauciones' OR tablename = 'objects';