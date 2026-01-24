-- ============================================================================
-- MIGRACIÓN FINANCIACIÓN 2.0 - Eliminar PDF, Agregar Soporte CSV
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- 1. Eliminar vistas y reglas que dependen de la tabla antes de alterar
DROP VIEW IF EXISTS cauciones_resumen;

-- 2. Eliminar columnas relacionadas con PDF (si existen)
ALTER TABLE cauciones DROP COLUMN IF EXISTS pdf_filename;
ALTER TABLE cauciones DROP COLUMN IF EXISTS pdf_url;
ALTER TABLE cauciones DROP COLUMN IF EXISTS pdf_storage_path;
ALTER TABLE cauciones DROP COLUMN IF EXISTS boleto;
ALTER TABLE cauciones DROP COLUMN IF EXISTS raw_text;

-- 3. Agregar columnas para soporte CSV
ALTER TABLE cauciones ADD COLUMN IF NOT EXISTS archivo VARCHAR(100);
ALTER TABLE cauciones ADD COLUMN IF NOT EXISTS portfolio_id UUID REFERENCES portfolios(id);

-- 4. Actualizar columna tna_real para almacenar como porcentaje directo (ej: 33.08)
-- La columna existente está bien, pero aseguremos que el cálculo sea correcto
ALTER TABLE cauciones ALTER COLUMN tna_real TYPE NUMERIC(10, 4);

-- 5. Recrear vista de resumen para incluir portfolio_id (sin OR REPLACE ya que dropeamos arriba)
CREATE VIEW cauciones_resumen AS
SELECT
  user_id,
  portfolio_id,
  COUNT(*) AS total_operaciones,
  SUM(capital) AS capital_total,
  SUM(interes) AS interes_total,
  SUM(capital * tna_real) / NULLIF(SUM(capital), 0) AS tna_promedio_ponderada,
  MIN(fecha_inicio) AS primera_operacion,
  MAX(fecha_fin) AS ultima_operacion,
  SUM(dias) AS dias_totales
FROM cauciones
GROUP BY user_id, portfolio_id;

-- 5. Crear índices para optimizar queries con portfolio_id
CREATE INDEX IF NOT EXISTS idx_cauciones_portfolio ON cauciones(user_id, portfolio_id);
CREATE INDEX IF NOT EXISTS idx_cauciones_portfolio_dates ON cauciones(user_id, portfolio_id, fecha_inicio, fecha_fin);

-- 6. Actualizar políticas RLS para incluir portfolio_id
DROP POLICY IF EXISTS "Users can view own cauciones" ON cauciones;
DROP POLICY IF EXISTS "Users can insert own cauciones" ON cauciones;
DROP POLICY IF EXISTS "Users can delete own cauciones" ON cauciones;
DROP POLICY IF EXISTS "Users can update own cauciones" ON cauciones;

CREATE POLICY "Users can view own cauciones" ON cauciones
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cauciones" ON cauciones
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own cauciones" ON cauciones
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can update own cauciones" ON cauciones
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- Para verificar que todo funcionó correctamente:
-- SELECT * FROM cauciones ORDER BY created_at DESC LIMIT 5;
-- SELECT * FROM cauciones_resumen ORDER BY user_id, portfolio_id;