-- ============================================================================
-- MÓDULO SPREAD v1 - Funding Engine
-- Ejecutar en Supabase SQL Editor
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

-- Índices para optimización de queries frecuentes
CREATE INDEX IF NOT EXISTS idx_cauciones_user ON cauciones(user_id);
CREATE INDEX IF NOT EXISTS idx_cauciones_fechas ON cauciones(user_id, fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_cauciones_created ON cauciones(user_id, created_at DESC);

-- Policies RLS (Row Level Security)
ALTER TABLE cauciones ENABLE ROW LEVEL SECURITY;

-- Usuarios solo pueden ver sus propias cauciones
CREATE POLICY "Users can view own cauciones" ON cauciones
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cauciones" ON cauciones
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own cauciones" ON cauciones
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can update own cauciones" ON cauciones
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- VISTAS ÚTILES
-- ============================================================================

-- View: Resumen de métricas por usuario
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

-- ============================================================================
-- EJEMPLO DE CONSULTA PARA VER DATOS
-- ============================================================================
-- SELECT * FROM cauciones ORDER BY created_at DESC LIMIT 10;
