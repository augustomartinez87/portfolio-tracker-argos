-- Migration: 018_add_portfolio_type_and_crypto_tables.sql
-- Description: Add portfolio_type and introduce crypto + nexo tables (Phase 1).

-- 1) Add portfolio_type to portfolios
ALTER TABLE public.portfolios
ADD COLUMN IF NOT EXISTS portfolio_type TEXT NOT NULL DEFAULT 'bursatil';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'portfolios_portfolio_type_check'
  ) THEN
    ALTER TABLE public.portfolios
    ADD CONSTRAINT portfolios_portfolio_type_check
    CHECK (portfolio_type IN ('bursatil','cripto'));
  END IF;
END $$;

-- 2) crypto_accounts
CREATE TABLE IF NOT EXISTS public.crypto_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3) crypto_holdings
CREATE TABLE IF NOT EXISTS public.crypto_holdings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.crypto_accounts(id) ON DELETE CASCADE NOT NULL,
  asset TEXT NOT NULL,
  quantity NUMERIC(28, 10) NOT NULL,
  avg_cost NUMERIC(28, 10),
  currency TEXT DEFAULT 'USD',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4) nexo_loans (single per portfolio for Phase 1)
CREATE TABLE IF NOT EXISTS public.nexo_loans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
  loan_currency TEXT NOT NULL,
  principal NUMERIC(28, 8) NOT NULL,
  outstanding NUMERIC(28, 8) NOT NULL,
  interest_rate_apr NUMERIC(10, 6) NOT NULL,
  ltv NUMERIC(10, 6),
  status TEXT DEFAULT 'active',
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- 5) nexo_loan_events
CREATE TABLE IF NOT EXISTS public.nexo_loan_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID REFERENCES public.nexo_loans(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  amount NUMERIC(28, 8) NOT NULL,
  asset TEXT,
  event_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 6) Indexes
CREATE INDEX IF NOT EXISTS idx_crypto_accounts_user ON public.crypto_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_accounts_portfolio ON public.crypto_accounts(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_crypto_holdings_portfolio ON public.crypto_holdings(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_crypto_holdings_account ON public.crypto_holdings(account_id);
CREATE INDEX IF NOT EXISTS idx_nexo_loans_portfolio ON public.nexo_loans(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_nexo_loan_events_loan ON public.nexo_loan_events(loan_id);

-- 7) RLS enable
ALTER TABLE public.crypto_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexo_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexo_loan_events ENABLE ROW LEVEL SECURITY;

-- 8) RLS policies
CREATE POLICY "Users can select own crypto_accounts" ON public.crypto_accounts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own crypto_accounts" ON public.crypto_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own crypto_accounts" ON public.crypto_accounts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own crypto_accounts" ON public.crypto_accounts
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can select own crypto_holdings" ON public.crypto_holdings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.crypto_accounts a
      WHERE a.id = crypto_holdings.account_id AND a.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert own crypto_holdings" ON public.crypto_holdings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.crypto_accounts a
      WHERE a.id = crypto_holdings.account_id AND a.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update own crypto_holdings" ON public.crypto_holdings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.crypto_accounts a
      WHERE a.id = crypto_holdings.account_id AND a.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete own crypto_holdings" ON public.crypto_holdings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.crypto_accounts a
      WHERE a.id = crypto_holdings.account_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can select own nexo_loans" ON public.nexo_loans
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own nexo_loans" ON public.nexo_loans
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own nexo_loans" ON public.nexo_loans
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own nexo_loans" ON public.nexo_loans
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can select own nexo_loan_events" ON public.nexo_loan_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.nexo_loans l
      WHERE l.id = nexo_loan_events.loan_id AND l.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert own nexo_loan_events" ON public.nexo_loan_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.nexo_loans l
      WHERE l.id = nexo_loan_events.loan_id AND l.user_id = auth.uid()
    )
  );

-- 9) updated_at triggers
CREATE TRIGGER update_crypto_accounts_updated_at
  BEFORE UPDATE ON public.crypto_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crypto_holdings_updated_at
  BEFORE UPDATE ON public.crypto_holdings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_nexo_loans_updated_at
  BEFORE UPDATE ON public.nexo_loans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
