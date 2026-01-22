-- ============================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- Portfolio Tracker - Seguridad Crítica
-- ============================================
--
-- INSTRUCCIONES:
-- 1. Ir a Supabase Dashboard > SQL Editor
-- 2. Copiar y ejecutar este script completo
-- 3. Verificar en Authentication > Policies que las policies estén activas
--
-- ============================================

-- ============================================
-- 1. HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================

ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. POLICIES PARA TABLA "portfolios"
-- ============================================

-- Política: Los usuarios solo pueden VER sus propios portfolios
CREATE POLICY "Users can view own portfolios"
ON portfolios
FOR SELECT
USING (auth.uid() = user_id);

-- Política: Los usuarios solo pueden CREAR portfolios para sí mismos
CREATE POLICY "Users can create own portfolios"
ON portfolios
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios solo pueden ACTUALIZAR sus propios portfolios
CREATE POLICY "Users can update own portfolios"
ON portfolios
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios solo pueden ELIMINAR sus propios portfolios
CREATE POLICY "Users can delete own portfolios"
ON portfolios
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- 3. POLICIES PARA TABLA "trades"
-- ============================================

-- Política: Los usuarios solo pueden VER trades de sus portfolios
CREATE POLICY "Users can view trades from own portfolios"
ON trades
FOR SELECT
USING (
  portfolio_id IN (
    SELECT id FROM portfolios WHERE user_id = auth.uid()
  )
);

-- Política: Los usuarios solo pueden CREAR trades en sus portfolios
CREATE POLICY "Users can create trades in own portfolios"
ON trades
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND portfolio_id IN (
    SELECT id FROM portfolios WHERE user_id = auth.uid()
  )
);

-- Política: Los usuarios solo pueden ACTUALIZAR trades de sus portfolios
CREATE POLICY "Users can update trades in own portfolios"
ON trades
FOR UPDATE
USING (
  portfolio_id IN (
    SELECT id FROM portfolios WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  portfolio_id IN (
    SELECT id FROM portfolios WHERE user_id = auth.uid()
  )
);

-- Política: Los usuarios solo pueden ELIMINAR trades de sus portfolios
CREATE POLICY "Users can delete trades from own portfolios"
ON trades
FOR DELETE
USING (
  portfolio_id IN (
    SELECT id FROM portfolios WHERE user_id = auth.uid()
  )
);

-- ============================================
-- 4. INDEXES PARA PERFORMANCE
-- ============================================

-- Index para búsquedas frecuentes de portfolios por usuario
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id
ON portfolios(user_id);

-- Index para búsquedas frecuentes de trades por portfolio
CREATE INDEX IF NOT EXISTS idx_trades_portfolio_id
ON trades(portfolio_id);

-- Index compuesto para queries de trades con fecha
CREATE INDEX IF NOT EXISTS idx_trades_portfolio_date
ON trades(portfolio_id, trade_date DESC);

-- Index para buscar portfolio default
CREATE INDEX IF NOT EXISTS idx_portfolios_user_default
ON portfolios(user_id, is_default)
WHERE is_default = true;

-- ============================================
-- 5. VERIFICACIÓN
-- ============================================
-- Ejecutar esto para verificar que RLS está activo:
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('portfolios', 'trades');
--
-- Debería mostrar 'true' en la columna rowsecurity para ambas tablas.
