-- Migration: 004_consolidate_cauciones_v2
-- Description: Creates cauciones_v2 with portfolio_id, strict types, and FKs. Replaces legacy table.

-- 1. Create new table with correct schema (V2)
CREATE TABLE IF NOT EXISTS public.cauciones_new (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
    
    -- Core Business Data (matches CSV fields)
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    capital NUMERIC(20, 2) NOT NULL, -- Increased precision for large portfolios
    monto_devolver NUMERIC(20, 2) NOT NULL,
    interes NUMERIC(20, 2) NOT NULL,
    dias INTEGER NOT NULL,
    tna_real NUMERIC(10, 4) NOT NULL, -- Stored as decimal e.g. 33.08 (percentage value) or 0.3308?
    -- DECISION: Existing CSV ingestor stores it as passed (e.g. 29.24). 
    -- The financeService uses it as is. Let's stick to NUMERIC.
    
    -- Metadata
    archivo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.cauciones_new ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Users can view their own cauciones_new" ON public.cauciones_new
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cauciones_new" ON public.cauciones_new
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cauciones_new" ON public.cauciones_new
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cauciones_new" ON public.cauciones_new
    FOR DELETE USING (auth.uid() = user_id);

-- 4. Indexes for Performance
CREATE INDEX idx_cauciones_new_portfolio ON public.cauciones_new(portfolio_id);
CREATE INDEX idx_cauciones_new_user ON public.cauciones_new(user_id);
CREATE INDEX idx_cauciones_new_fechas ON public.cauciones_new(user_id, fecha_inicio);

-- 5. Trigger for updated_at
CREATE TRIGGER update_cauciones_new_updated_at
    BEFORE UPDATE ON public.cauciones_new
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- MIGRATION STRATEGY: SWAP TABLES
-- Note: Since legacy table lacked portfolio_id, automatic data migration is risky/impossible 
-- without arbitrarily assigning a portfolio. 
-- Recommendation: START FRESH (Empty Table) and let user re-upload CSVs.
-- ==============================================================================

-- 6. Swap tables (Backup old one first just in case)
ALTER TABLE public.cauciones RENAME TO cauciones_legacy_backup;
ALTER TABLE public.cauciones_new RENAME TO cauciones;

-- 7. Grant permissions (standard for Supabase)
GRANT ALL ON TABLE public.cauciones TO authenticated;
GRANT ALL ON TABLE public.cauciones TO service_role;

-- 8. Cleanup View (recreate view pointing to new table)
DROP VIEW IF EXISTS public.cauciones_resumen;
CREATE OR REPLACE VIEW public.cauciones_resumen AS
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
FROM public.cauciones
GROUP BY user_id, portfolio_id;

-- Comment
COMMENT ON TABLE public.cauciones IS 'Operaciones de caución (v2) con soporte multi-portfolio';
