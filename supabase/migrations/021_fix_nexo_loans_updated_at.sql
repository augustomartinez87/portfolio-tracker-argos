-- Fix: nexo_loans has update trigger but missing updated_at column
ALTER TABLE public.nexo_loans
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
