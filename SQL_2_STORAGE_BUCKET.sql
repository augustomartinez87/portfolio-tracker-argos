-- ============================================================================
-- SQL 2: CREAR STORAGE BUCKET Y POLÍTICAS
-- Ejecutar SEGUNDO en Supabase SQL Editor (después del SQL 1)
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

-- 2. Políticas RLS para el bucket
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

-- Verificación
SELECT 'Storage bucket created' as status, name, public, file_size_limit
FROM storage.buckets 
WHERE id = 'caucion-pdfs';