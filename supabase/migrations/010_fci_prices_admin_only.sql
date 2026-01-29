-- Migration: 010_fci_prices_admin_only.sql
-- Descripción: Restringe la subida de precios y edición de maestros de FCI solo a administradores.

-- 1. Eliminar políticas anteriores permisivas (de 007_fci_prices_rls_fix.sql)
DROP POLICY IF EXISTS "Users can insert fci prices" ON fci_prices;
DROP POLICY IF EXISTS "Users can update fci prices" ON fci_prices;
DROP POLICY IF EXISTS "Users can insert fci master" ON fci_master;
DROP POLICY IF EXISTS "Users can update fci master" ON fci_master;

-- 2. Crear nuevas políticas basadas en rol admin
-- Estas políticas usan la función public.is_admin() definida en 009 para mayor seguridad

CREATE POLICY "Admins can insert fci prices" ON fci_prices
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update fci prices" ON fci_prices
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can insert fci master" ON fci_master
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update fci master" ON fci_master
  FOR UPDATE USING (public.is_admin());

-- NOTA: Las políticas de SELECT (lectura) permanecen abiertas para todos los autenticados 
-- para que el Dashboard pueda mostrar valuaciones.
