-- Migration: 019_fix_portfolio_type_typo.sql
-- Description: Fix 'borsatil' typo to 'bursatil' from migration 018
-- IMPORTANT: Run each statement separately to avoid constraint violations

-- Step 1: Drop the old constraint with the typo FIRST
ALTER TABLE public.portfolios DROP CONSTRAINT IF EXISTS portfolios_portfolio_type_check;

-- Step 2: Update existing portfolios with the typo
UPDATE public.portfolios
SET portfolio_type = 'bursatil'
WHERE portfolio_type = 'borsatil';

-- Step 3: Change the default value
ALTER TABLE public.portfolios 
ALTER COLUMN portfolio_type SET DEFAULT 'bursatil';

-- Step 4: Add the constraint with correct spelling
ALTER TABLE public.portfolios
ADD CONSTRAINT portfolios_portfolio_type_check
CHECK (portfolio_type IN ('bursatil', 'cripto'));
