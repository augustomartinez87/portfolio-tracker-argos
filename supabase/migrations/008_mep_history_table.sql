-- ============================================================================
-- MIGRACIÓN 008: Tabla mep_history para historial de cotizaciones MEP
-- ============================================================================

-- Tabla para almacenar el historial diario del dólar MEP
CREATE TABLE IF NOT EXISTS mep_history (
  date DATE PRIMARY KEY,
  price NUMERIC(12, 4) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para búsquedas por rango de fechas
CREATE INDEX IF NOT EXISTS idx_mep_history_date ON mep_history(date DESC);

-- Habilitar RLS
ALTER TABLE mep_history ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública para usuarios autenticados
CREATE POLICY "Enable read access for authenticated users" ON mep_history
  FOR SELECT USING (auth.role() = 'authenticated');

-- Política de lectura pública para anon (Streamlit usa service_role pero por si acaso)
CREATE POLICY "Enable read access for anon" ON mep_history
  FOR SELECT USING (true);

-- Comentario
COMMENT ON TABLE mep_history IS 'Historial diario de cotizaciones del dólar MEP';
