-- Migration: 013_fix_trades_fkey_integrity.sql
-- Descripción: Garantiza que las tablas trades y fci_transactions referencien directamente a auth.users(id)
-- Esto soluciona el error 23503 (FK violation) al intentar guardar transacciones.

DO $$ 
DECLARE 
    constraint_record RECORD;
BEGIN
    -- 1. Limpieza para la tabla "trades"
    FOR constraint_record IN (
        SELECT tc.constraint_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_name = 'trades' 
          AND kcu.column_name = 'user_id' 
          AND tc.constraint_type = 'FOREIGN KEY'
    ) LOOP
        EXECUTE 'ALTER TABLE public.trades DROP CONSTRAINT ' || quote_ident(constraint_record.constraint_name);
        RAISE NOTICE 'Constraint eliminada de trades: %', constraint_record.constraint_name;
    END LOOP;

    -- 2. Limpieza para la tabla "fci_transactions"
    FOR constraint_record IN (
        SELECT tc.constraint_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_name = 'fci_transactions' 
          AND kcu.column_name = 'user_id' 
          AND tc.constraint_type = 'FOREIGN KEY'
    ) LOOP
        EXECUTE 'ALTER TABLE public.fci_transactions DROP CONSTRAINT ' || quote_ident(constraint_record.constraint_name);
        RAISE NOTICE 'Constraint eliminada de fci_transactions: %', constraint_record.constraint_name;
    END LOOP;

    -- 3. Crear constraints definitivas apuntando a auth.users(id)
    ALTER TABLE public.trades
    ADD CONSTRAINT trades_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

    ALTER TABLE public.fci_transactions
    ADD CONSTRAINT fci_transactions_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

    RAISE NOTICE 'Constraints creadas exitosamente apuntando a auth.users(id)';
END $$;

-- Documentación del esquema
COMMENT ON CONSTRAINT trades_user_id_fkey ON public.trades IS 'Referencia directa a auth.users para evitar errores de sincronización de perfiles.';
COMMENT ON CONSTRAINT fci_transactions_user_id_fkey ON public.fci_transactions IS 'Referencia directa a auth.users para evitar errores de sincronización de perfiles.';
