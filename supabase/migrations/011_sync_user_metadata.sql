-- Migration: 011_sync_user_metadata.sql
-- Descripción: Agrega campos de sincronización y triggers para mantener email, fecha de registro y último login actualizados.

-- 1. Agregar columnas a user_profiles
ALTER TABLE IF EXISTS public.user_profiles 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS registered_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMP WITH TIME ZONE;

-- 2. Actualizar función handle_new_user para incluir estos campos al crear
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
      THEN '["portfolio", "fci", "carryTrade", "financiacion", "funding", "analisis", "admin"]'::jsonb
      ELSE '["portfolio", "carryTrade"]'::jsonb
    END,
    NEW.email,
    NEW.created_at,
    NEW.last_sign_in_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Función para sincronizar metadatos en cada login o actualización de auth.users
CREATE OR REPLACE FUNCTION public.sync_user_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_profiles
  SET 
    email = NEW.email,
    last_sign_in_at = NEW.last_sign_in_at,
    updated_at = NOW()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger para sincronización automática
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email, last_sign_in_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_metadata();

-- 5. Backfill inicial para usuarios existentes
DO $$
BEGIN
  UPDATE public.user_profiles up
  SET 
    email = u.email,
    registered_at = u.created_at,
    last_sign_in_at = u.last_sign_in_at
  FROM auth.users u
  WHERE up.user_id = u.id;
END $$;
