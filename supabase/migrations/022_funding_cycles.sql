-- Migration: 022_funding_cycles.sql
-- Description: Create funding_cycles table to group loan→conversion→fci_lot into trackable cycles.

-- 1) funding_cycles table
CREATE TABLE IF NOT EXISTS public.funding_cycles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
  loan_id UUID REFERENCES public.nexo_loans(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  opened_at DATE NOT NULL DEFAULT CURRENT_DATE,
  closed_at DATE,
  -- Snapshot fields (populated on close)
  snapshot_pnl_nominal_ars NUMERIC(18, 2),
  snapshot_pnl_real_ars NUMERIC(18, 2),
  snapshot_roi_pct NUMERIC(10, 4),
  snapshot_tc_promedio NUMERIC(18, 4),
  snapshot_dias INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_funding_cycles_user ON public.funding_cycles(user_id);
CREATE INDEX IF NOT EXISTS idx_funding_cycles_portfolio ON public.funding_cycles(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_funding_cycles_loan ON public.funding_cycles(loan_id);
CREATE INDEX IF NOT EXISTS idx_funding_cycles_status ON public.funding_cycles(status);

-- 3) RLS
ALTER TABLE public.funding_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own funding_cycles" ON public.funding_cycles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own funding_cycles" ON public.funding_cycles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own funding_cycles" ON public.funding_cycles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own funding_cycles" ON public.funding_cycles
  FOR DELETE USING (auth.uid() = user_id);

-- 4) updated_at trigger
CREATE TRIGGER update_funding_cycles_updated_at
  BEFORE UPDATE ON public.funding_cycles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5) Add cycle_id FK to conversion_events
ALTER TABLE public.conversion_events
ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES public.funding_cycles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversion_events_cycle ON public.conversion_events(cycle_id);

-- 6) Add cycle_id FK to fci_lots
ALTER TABLE public.fci_lots
ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES public.funding_cycles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fci_lots_cycle ON public.fci_lots(cycle_id);
