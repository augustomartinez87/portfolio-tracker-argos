-- Migration: 005_financing_idempotency.sql
-- Description: Add operation_key to cauciones and enforce uniqueness for idempotency.

-- 1. Add 'operation_key' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cauciones' AND column_name = 'operation_key') THEN
        ALTER TABLE cauciones ADD COLUMN operation_key TEXT;
    END IF;
END $$;

-- 2. Create unique index to enforce idempotency
-- We use a unique index on (user_id, portfolio_id, operation_key)
-- This allows the same "business operation" to be stored for different users/portfolios independently if needed (though unlikely),
-- but primarily prevents duplicates within the SAME user/portfolio context.
-- We use conditional creation to avoid errors on repeated runs.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_cauciones_idempotency'
    ) THEN
        CREATE UNIQUE INDEX idx_cauciones_idempotency 
        ON cauciones (user_id, portfolio_id, operation_key);
    END IF;
END $$;

-- 3. (Optional) Backfill strategy would go here, but user opted for re-upload.
-- We leave existing records with NULL keys. They won't conflict with new hashed keys.
-- Future uploads will seamlessly populate this.
