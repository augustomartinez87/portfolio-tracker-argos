-- Migration: 012_verify_schema_integrity.sql
-- Descripción: Garantiza que la tabla portfolios referencie directamente a auth.users(id)
-- Esto elimina la dependencia crítica del timing de creación de user_profiles.

DO $$ 
DECLARE 
    constraint_record RECORD;
BEGIN
    -- 1. Buscar y eliminar CUALQUIER constraint de llave foránea existente en la columna user_id
    -- Esto limpia cualquier residuo de migraciones previas o definiciones inconsistentes.
    FOR constraint_record IN (
        SELECT tc.constraint_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_name = 'portfolios' 
          AND kcu.column_name = 'user_id' 
          AND tc.constraint_type = 'FOREIGN KEY'
    ) LOOP
        EXECUTE 'ALTER TABLE public.portfolios DROP CONSTRAINT ' || quote_ident(constraint_record.constraint_name);
        RAISE NOTICE 'Constraint eliminada: %', constraint_record.constraint_name;
    END LOOP;

    -- 2. Crear la constraint definitiva apuntando a auth.users(id)
    -- Se usa ON DELETE CASCADE para limpieza automática si se borra el usuario.
    ALTER TABLE public.portfolios
    ADD CONSTRAINT portfolios_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

    RAISE NOTICE 'Constraint portfolios_user_id_fkey creada exitosamente apuntando a auth.users(id)';
END $$;

-- Documentación del esquema
COMMENT ON CONSTRAINT portfolios_user_id_fkey ON public.portfolios IS 'Referencia directa a auth.users para permitir creación de portfolios sin esperar a la sincronización de perfiles.';
