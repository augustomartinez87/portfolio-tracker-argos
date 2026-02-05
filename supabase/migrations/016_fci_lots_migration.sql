-- Migration: 016_fci_lots_migration.sql
-- Descripción: Refactor FCI de modelo agregado (fci_transactions) a modelo por lotes (fci_lots).
-- Introduce also tabla `lugares` para etiquetar posiciones por broker/institución.
-- fci_transactions se retiene como audit trail; no se escribe más.

-- =============================================================================
-- A. Tabla: lugares (por-usuario)
-- =============================================================================
CREATE TABLE IF NOT EXISTS lugares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lugares_user_nombre
  ON lugares(user_id, nombre);

ALTER TABLE lugares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own lugares" ON lugares
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lugares" ON lugares
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lugares" ON lugares
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own lugares" ON lugares
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE lugares IS 'Lugares de inversión por usuario (etiqueta organizacional: broker, app, etc.)';

-- =============================================================================
-- B. Tabla: fci_lots
-- =============================================================================
CREATE TABLE IF NOT EXISTS fci_lots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  fci_id UUID REFERENCES fci_master(id) ON DELETE RESTRICT NOT NULL,
  lugar_id UUID REFERENCES lugares(id) ON DELETE SET NULL,
  fecha_suscripcion DATE NOT NULL,
  vcp_entrada NUMERIC(18, 8) NOT NULL,
  cuotapartes NUMERIC(18, 8) NOT NULL,
  capital_invertido NUMERIC(18, 2) NOT NULL,  -- cuotapartes * vcp_entrada al momento de la suscripción
  activo BOOLEAN DEFAULT TRUE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fci_lots_portfolio ON fci_lots(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_fci_lots_user ON fci_lots(user_id);
CREATE INDEX IF NOT EXISTS idx_fci_lots_fci_activo ON fci_lots(fci_id, activo);
CREATE INDEX IF NOT EXISTS idx_fci_lots_fecha ON fci_lots(fecha_suscripcion);

ALTER TABLE fci_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own fci lots" ON fci_lots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fci lots" ON fci_lots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fci lots" ON fci_lots
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own fci lots" ON fci_lots
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger para updated_at (reutiliza la función que existe desde migración 009)
CREATE TRIGGER update_fci_lots_updated_at
  BEFORE UPDATE ON fci_lots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE fci_lots IS 'Lotes de suscripción de FCIs. Cada row = una suscripción real. Reemplaza fci_transactions para cálculo de posiciones.';
COMMENT ON COLUMN fci_lots.capital_invertido IS 'Costo original del lot = cuotapartes * vcp_entrada. Se reduce proporcionalmente si FIFO consume parte del lot.';
COMMENT ON COLUMN fci_lots.activo IS 'FALSE cuando el lot fue completamente consumido por rescates FIFO.';

-- =============================================================================
-- C. Migración de datos: fci_transactions → fci_lots
--    Idempotente: solo corre si fci_lots está vacía.
-- =============================================================================
DO $$
DECLARE
  redemption   RECORD;
  target_lot   RECORD;
  remaining    NUMERIC(18, 8);
  consumable   NUMERIC(18, 8);
BEGIN
  -- Guard: si ya hay datos en fci_lots, no migrar de nuevo
  IF EXISTS (SELECT 1 FROM fci_lots LIMIT 1) THEN
    RAISE NOTICE 'fci_lots ya tiene datos. Migración omitida (idempotente).';
    RETURN;
  END IF;

  -- Si no hay transacciones que migrar, terminar
  IF NOT EXISTS (SELECT 1 FROM fci_transactions LIMIT 1) THEN
    RAISE NOTICE 'No hay transacciones en fci_transactions. Migración completada (sin datos).';
    RETURN;
  END IF;

  -- -----------------------------------------------------------------------
  -- C1. Insertar todos los SUBSCRIPTION como lotes activos
  -- -----------------------------------------------------------------------
  INSERT INTO fci_lots (
    user_id, portfolio_id, fci_id, lugar_id,
    fecha_suscripcion, vcp_entrada, cuotapartes, capital_invertido,
    activo, notes, created_at
  )
  SELECT
    user_id,
    portfolio_id,
    fci_id,
    NULL,                -- lugar_id: no existía antes
    fecha,               -- fecha_suscripcion
    vcp_operado,         -- vcp_entrada
    cuotapartes,         -- cuotapartes originales
    monto,               -- capital_invertido = monto original de la suscripción
    TRUE,                -- activo
    notes,
    created_at
  FROM fci_transactions
  WHERE tipo = 'SUBSCRIPTION';

  RAISE NOTICE 'C1: Suscripciones insertadas como lotes.';

  -- -----------------------------------------------------------------------
  -- C2. Replay de REDEMPTION en orden cronológico usando FIFO.
  --     Nota: el loop interno usa SELECT explícito por iteración (no FOR IN)
  --     para que cada lectura refleja los UPDATEs previos dentro del mismo
  --     rescate. Un FOR IN hace snapshot al inicio y no ve los cambios.
  -- -----------------------------------------------------------------------
  FOR redemption IN
    SELECT id, portfolio_id, fci_id, cuotapartes, fecha
    FROM fci_transactions
    WHERE tipo = 'REDEMPTION'
    ORDER BY fecha ASC, created_at ASC
  LOOP
    remaining := redemption.cuotapartes;

    -- Consumir de los lotes más antiguos primero (FIFO)
    -- LOOP con SELECT fresh cada iteración
    LOOP
      EXIT WHEN remaining <= 0;

      -- Buscar el lot más antiguo activo con estado actual
      SELECT id, cuotapartes AS lot_cuotapartes, vcp_entrada
        INTO target_lot
        FROM fci_lots
        WHERE portfolio_id = redemption.portfolio_id
          AND fci_id = redemption.fci_id
          AND activo = TRUE
        ORDER BY fecha_suscripcion ASC, created_at ASC
        LIMIT 1;

      -- Si no hay más lotes activos, salir
      EXIT WHEN NOT FOUND;

      consumable := LEAST(target_lot.lot_cuotapartes, remaining);

      -- Calcular nuevo estado del lot
      IF (target_lot.lot_cuotapartes - consumable) < 0.0001 THEN
        -- Lot completamente agotado
        UPDATE fci_lots
        SET cuotapartes = 0,
            capital_invertido = 0,
            activo = FALSE,
            updated_at = NOW()
        WHERE id = target_lot.id;
      ELSE
        -- Lot parcialmente consumido
        UPDATE fci_lots
        SET cuotapartes = target_lot.lot_cuotapartes - consumable,
            capital_invertido = (target_lot.lot_cuotapartes - consumable) * target_lot.vcp_entrada,
            updated_at = NOW()
        WHERE id = target_lot.id;
      END IF;

      remaining := remaining - consumable;
    END LOOP;

    -- Si remaining > 0.0001, hay un rescate que no se pudo aplicar completamente
    -- (datos inconsistentes en fci_transactions). Logueamos pero no bloqueamos.
    IF remaining > 0.0001 THEN
      RAISE NOTICE 'ADVERTENCIA: Rescate % no pudo consumir completamente. Restante: %',
        redemption.id, remaining;
    END IF;
  END LOOP;

  RAISE NOTICE 'C2: Replay de rescates FIFO completado.';
  RAISE NOTICE 'Migración fci_transactions → fci_lots exitosa.';
END $$;
