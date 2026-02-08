-- Migration: 017_remove_carrytrade_module.sql
-- Description: Remove legacy carryTrade/analisis modules from defaults and existing profiles.

-- 1. Update handle_new_user defaults (latest definition lives in migration 011)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, role, display_name, modules, email, registered_at, last_sign_in_at)
  VALUES (
    NEW.id,
    CASE
      WHEN NEW.email = 'martinez.augusto2112@gmail.com' THEN 'admin'
      ELSE 'user'
    END,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE
      WHEN NEW.email = 'martinez.augusto2112@gmail.com'
      THEN '["portfolio", "fci", "financiacion", "funding", "admin"]'::jsonb
      ELSE '["portfolio"]'::jsonb
    END,
    NEW.email,
    NEW.created_at,
    NEW.last_sign_in_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Remove legacy modules from existing profiles
UPDATE public.user_profiles
SET modules = COALESCE(
  (
    SELECT jsonb_agg(value)
    FROM jsonb_array_elements(modules) AS value
    WHERE value NOT IN ('carryTrade', 'analisis')
  ),
  '[]'::jsonb
)
WHERE modules ?| array['carryTrade', 'analisis'];

