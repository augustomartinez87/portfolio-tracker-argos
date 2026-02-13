-- Migration: 020_crypto_funding_system.sql
-- Description: Extend nexo_loans with collateral tracking, add conversion_events table.

-- 1) Extend nexo_loans with collateral and risk threshold fields
ALTER TABLE public.nexo_loans
ADD COLUMN IF NOT EXISTS collateral_asset TEXT DEFAULT 'bitcoin';

ALTER TABLE public.nexo_loans
ADD COLUMN IF NOT EXISTS collateral_quantity NUMERIC(28, 10);

ALTER TABLE public.nexo_loans
ADD COLUMN IF NOT EXISTS ltv_warning NUMERIC(10, 6) DEFAULT 0.65;

ALTER TABLE public.nexo_loans
ADD COLUMN IF NOT EXISTS ltv_liquidation NUMERIC(10, 6) DEFAULT 0.83;

-- 2) conversion_events - Track USDT → ARS conversions
CREATE TABLE IF NOT EXISTS public.conversion_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
  loan_id UUID REFERENCES public.nexo_loans(id) ON DELETE SET NULL,
  from_asset TEXT NOT NULL DEFAULT 'USDT',
  to_asset TEXT NOT NULL DEFAULT 'ARS',
  from_amount NUMERIC(28, 8) NOT NULL,
  to_amount NUMERIC(28, 8) NOT NULL,
  exchange_rate NUMERIC(18, 4) NOT NULL,
  channel TEXT,
  event_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3) Indexes for conversion_events
CREATE INDEX IF NOT EXISTS idx_conversion_events_user ON public.conversion_events(user_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_portfolio ON public.conversion_events(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_loan ON public.conversion_events(loan_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_date ON public.conversion_events(event_date);

-- 4) RLS for conversion_events
ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own conversion_events" ON public.conversion_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversion_events" ON public.conversion_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversion_events" ON public.conversion_events
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversion_events" ON public.conversion_events
  FOR DELETE USING (auth.uid() = user_id);
