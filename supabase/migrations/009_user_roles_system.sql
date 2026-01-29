-- Migration: 009_user_roles_system.sql
-- Descripción: Sistema de roles y perfiles de usuario para control de acceso
-- Roles: 'user' (acceso limitado) y 'admin' (acceso completo)

-- ============================================================================
-- 1. Tabla de Perfiles de Usuario
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  display_name TEXT,
  modules JSONB DEFAULT '["portfolio", "carryTrade"]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. Tabla de Actividad del Sistema (Log de auditoría)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  module TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. Índices para mejorar performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created ON user_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_action ON user_activity(action);

-- ============================================================================
-- 4. Habilitar Row Level Security (RLS)
-- ============================================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. Políticas RLS para user_profiles
-- ============================================================================

-- Usuarios pueden ver su propio perfil
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Admins pueden ver todos los perfiles
CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
  );

-- Admins pueden actualizar cualquier perfil
CREATE POLICY "Admins can update all profiles" ON user_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
  );

-- Permitir inserción de perfil propio (para el trigger)
CREATE POLICY "Allow profile creation" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 6. Políticas RLS para user_activity
-- ============================================================================

-- Usuarios pueden ver su propia actividad
CREATE POLICY "Users can view own activity" ON user_activity
  FOR SELECT USING (auth.uid() = user_id);

-- Admins pueden ver toda la actividad
CREATE POLICY "Admins can view all activity" ON user_activity
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
  );

-- Usuarios pueden insertar su propia actividad
CREATE POLICY "Users can insert own activity" ON user_activity
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 7. Función para crear perfil automáticamente al registrarse
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, role, display_name, modules)
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
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. Trigger para crear perfil automáticamente
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 9. Función para actualizar updated_at automáticamente
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at en user_profiles
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 10. Crear perfiles para usuarios existentes
-- ============================================================================

-- Primero el admin
INSERT INTO user_profiles (user_id, role, display_name, modules)
SELECT
  id,
  'admin',
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  '["portfolio", "fci", "carryTrade", "financiacion", "funding", "analisis", "admin"]'::jsonb
FROM auth.users
WHERE email = 'martinez.augusto2112@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET
  role = 'admin',
  modules = '["portfolio", "fci", "carryTrade", "financiacion", "funding", "analisis", "admin"]'::jsonb;

-- Luego todos los demás usuarios como 'user'
INSERT INTO user_profiles (user_id, role, display_name, modules)
SELECT
  id,
  'user',
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  '["portfolio", "carryTrade"]'::jsonb
FROM auth.users
WHERE email != 'martinez.augusto2112@gmail.com'
  AND id NOT IN (SELECT user_id FROM user_profiles)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- 11. Comentarios para documentación
-- ============================================================================
COMMENT ON TABLE user_profiles IS 'Perfiles de usuario con roles y permisos de acceso a módulos';
COMMENT ON TABLE user_activity IS 'Log de auditoría de acciones del sistema';
COMMENT ON COLUMN user_profiles.role IS 'Rol del usuario: user (limitado) o admin (completo)';
COMMENT ON COLUMN user_profiles.modules IS 'Array JSON de módulos permitidos para el usuario';
COMMENT ON COLUMN user_profiles.is_active IS 'Si el usuario puede acceder al sistema';
