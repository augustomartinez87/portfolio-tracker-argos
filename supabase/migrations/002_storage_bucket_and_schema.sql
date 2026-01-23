-- ============================================================================
-- MIGRACIÓN FASE 1 - Storage Bucket y Schema Updates
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- 1. Crear bucket para PDFs de caución
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'caucion-pdfs',
  'caucion-pdfs',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- 2. Políticas RLS para el bucket de Storage
CREATE POLICY "Users can upload own caucion PDFs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'caucion-pdfs' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own caucion PDFs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'caucion-pdfs' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own caucion PDFs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'caucion-pdfs' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 3. Actualizar tabla cauciones con campos faltantes
ALTER TABLE cauciones 
ADD COLUMN IF NOT EXISTS raw_text TEXT,
ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT,
ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- 4. Actualizar índices para optimización
CREATE INDEX IF NOT EXISTS idx_cauciones_pdf_path ON cauciones(user_id, pdf_storage_path);

-- 5. Actualizar vista de resumen para incluir nuevos campos
DROP VIEW IF EXISTS cauciones_resumen;
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

-- 6. Verificar que todo esté creado correctamente
SELECT 
  'Storage Buckets' as component,
  name,
  public,
  file_size_limit
FROM storage.buckets 
WHERE id = 'caucion-pdfs'

UNION ALL

SELECT 
  'Table Columns' as component,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'cauciones' 
  AND column_name IN ('raw_text', 'pdf_storage_path', 'pdf_url')

UNION ALL

SELECT 
  'Policies Created' as component,
  policyname,
  policytype::text,
  'Active' as status
FROM pg_policies 
WHERE tablename = 'cauciones' OR tablename = 'objects';