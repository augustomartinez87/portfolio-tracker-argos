-- ============================================================================
-- SQL 1: CREAR TABLA BASE CAUCIONES
-- Ejecutar PRIMERO en Supabase SQL Editor
-- ============================================================================

-- Tabla de cauciones (solo operaciones cerradas para v1)
CREATE TABLE IF NOT EXISTS cauciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  pdf_filename TEXT NOT NULL,
  pdf_url TEXT,
  boleto VARCHAR(20) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  capital NUMERIC NOT NULL,
  monto_devolver NUMERIC NOT NULL,
  interes NUMERIC GENERATED ALWAYS AS (monto_devolver - capital) STORED,
  dias INT GENERATED ALWAYS AS (fecha_fin - fecha_inicio) STORED,
  tna_real NUMERIC GENERATED ALWAYS AS
    (CASE
      WHEN (fecha_fin - fecha_inicio) = 0 THEN 0
      ELSE (((monto_devolver - capital) / capital) * 365.0 / (fecha_fin - fecha_inicio))
    END) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices básicos
CREATE INDEX IF NOT EXISTS idx_cauciones_user ON cauciones(user_id);
CREATE INDEX IF NOT EXISTS idx_cauciones_fechas ON cauciones(user_id, fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_cauciones_created ON cauciones(user_id, created_at DESC);

-- Habilitar RLS
ALTER TABLE cauciones ENABLE ROW LEVEL SECURITY;

-- Políticas básicas
CREATE POLICY "Users can view own cauciones" ON cauciones
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cauciones" ON cauciones
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own cauciones" ON cauciones
  FOR DELETE USING (auth.uid() = user_id);

-- Verificación
SELECT 'Table cauciones created successfully' as status, COUNT(*) as columns
FROM information_schema.columns 
WHERE table_name = 'cauciones';