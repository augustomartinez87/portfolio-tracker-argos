-- Migration: 006_fci_module.sql
-- Descripción: Módulo profesional de FCI (Fondos Comunes de Inversión)
-- Incluye tablas Master, Prices y Transactions con soporte multi-usuario y multi-portfolio.

-- 1. Tabla Master de FCIs
CREATE TABLE IF NOT EXISTS fci_master (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  ticker TEXT, -- Opcional, ej: "ADCAP3A"
  currency TEXT DEFAULT 'ARS',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de Precios Históricos (VCP)
CREATE TABLE IF NOT EXISTS fci_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fci_id UUID REFERENCES fci_master(id) ON DELETE CASCADE NOT NULL,
  fecha DATE NOT NULL,
  vcp NUMERIC(18, 8) NOT NULL, -- Mayor precisión para VCP unitario
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(fci_id, fecha) -- Evitar duplicados de precio para el mismo fondo/fecha
);

-- 3. Tabla de Transacciones de FCI
CREATE TABLE IF NOT EXISTS fci_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  fci_id UUID REFERENCES fci_master(id) ON DELETE RESTRICT NOT NULL,
  fecha DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('SUBSCRIPTION', 'REDEMPTION')),
  monto NUMERIC(18, 2) NOT NULL,
  vcp_operado NUMERIC(18, 8) NOT NULL,
  cuotapartes NUMERIC(18, 8) NOT NULL, -- Calculado como monto / vcp_operado
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_fci_prices_fci_date ON fci_prices(fci_id, fecha);
CREATE INDEX IF NOT EXISTS idx_fci_transactions_portfolio ON fci_transactions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_fci_transactions_user ON fci_transactions(user_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE fci_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE fci_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE fci_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS

-- fci_master: Visible para todos (público o compartido) 
-- Nota: Si queremos que los usuarios creen sus propios fondos, necesitariamos user_id. 
-- Por ahora asumimos un master global o visible para todos los autenticados.
CREATE POLICY "Enable read access for authenticated users" ON fci_master
  FOR SELECT USING (auth.role() = 'authenticated');

-- fci_prices: Visible para todos (datos de mercado)
CREATE POLICY "Enable read access for authenticated users" ON fci_prices
  FOR SELECT USING (auth.role() = 'authenticated');

-- fci_transactions: Privado por usuario
CREATE POLICY "Users can view their own fci transactions" ON fci_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own fci transactions" ON fci_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fci transactions" ON fci_transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own fci transactions" ON fci_transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger para updated_at en transacciones
CREATE TRIGGER update_fci_transactions_updated_at
  BEFORE UPDATE ON fci_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentarios
COMMENT ON TABLE fci_master IS 'Maestro de Fondos Comunes de Inversión';
COMMENT ON TABLE fci_prices IS 'Histórico de valor de cuotaparte (VCP)';
COMMENT ON TABLE fci_transactions IS 'Suscripciones y Rescates de FCIs';
