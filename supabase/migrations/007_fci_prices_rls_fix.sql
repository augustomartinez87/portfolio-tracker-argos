-- Migration: 007_fci_prices_rls_fix.sql
-- Descripción: Habilita permisos de escritura para usuarios autenticados en las tablas maestras de FCI.
-- Esto es necesario para que los usuarios puedan subir históricos de precios y gestionar nuevos fondos.

-- 1. Permisos para fci_prices (UPSERT de históricos)
CREATE POLICY "Users can insert fci prices" ON fci_prices
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update fci prices" ON fci_prices
  FOR UPDATE USING (auth.role() = 'authenticated');

-- 2. Permisos para fci_master (para poder agregar nuevos fondos en el futuro)
CREATE POLICY "Users can insert fci master" ON fci_master
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update fci master" ON fci_master
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Nota: Las políticas de SELECT ya existen en 006_fci_module.sql.
-- Si recibes error de que ya existen, puedes ignorar o usar DROP POLICY IF EXISTS antes.
