-- Migration: 014_extend_cauciones_audit.sql
-- Description: Adds audit columns to cauciones and creates cauciones_rejected for failed processing.

-- 1. Add new columns to 'cauciones' table if they don't exist
DO $$
BEGIN
    -- Audit and contextual fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cauciones' AND column_name = 'tipo_operacion') THEN
        ALTER TABLE cauciones ADD COLUMN tipo_operacion TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cauciones' AND column_name = 'fecha_liquidacion') THEN
        ALTER TABLE cauciones ADD COLUMN fecha_liquidacion DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cauciones' AND column_name = 'boleto_numero') THEN
        ALTER TABLE cauciones ADD COLUMN boleto_numero TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cauciones' AND column_name = 'garantias_hash') THEN
        ALTER TABLE cauciones ADD COLUMN garantias_hash TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cauciones' AND column_name = 'raw_text') THEN
        ALTER TABLE cauciones ADD COLUMN raw_text TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cauciones' AND column_name = 'parse_version') THEN
        ALTER TABLE cauciones ADD COLUMN parse_version TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cauciones' AND column_name = 'status') THEN
        ALTER TABLE cauciones ADD COLUMN status TEXT DEFAULT 'active';
    END IF;

    -- JSON Metadata fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cauciones' AND column_name = 'validation_metadata') THEN
        ALTER TABLE cauciones ADD COLUMN validation_metadata JSONB DEFAULT '[]'::JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cauciones' AND column_name = 'processing_logs') THEN
        ALTER TABLE cauciones ADD COLUMN processing_logs JSONB DEFAULT '[]'::JSONB;
    END IF;
END $$;

-- 2. Create index on operation_key if it doesn't exist
-- Note: A unique index 'idx_cauciones_idempotency' might already exist.
-- We add a standard index for fast lookups if not already covered or for parity with user request.
CREATE INDEX IF NOT EXISTS idx_cauciones_operation_key ON cauciones(operation_key);

-- 3. Create 'cauciones_rejected' table
CREATE TABLE IF NOT EXISTS public.cauciones_rejected (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE CASCADE,
    
    -- Original filename and raw data
    archivo TEXT,
    raw_text TEXT,
    
    -- Error information
    error_message TEXT NOT NULL,
    processing_logs JSONB DEFAULT '[]'::JSONB,
    
    -- Truncated/Partial parsed data (if any)
    parsed_data JSONB DEFAULT '{}'::JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable RLS on rejected table
ALTER TABLE public.cauciones_rejected ENABLE ROW LEVEL SECURITY;

-- 5. Policies for cauciones_rejected
CREATE POLICY "Users can view their own cauciones_rejected" ON public.cauciones_rejected
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cauciones_rejected" ON public.cauciones_rejected
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cauciones_rejected" ON public.cauciones_rejected
    FOR DELETE USING (auth.uid() = user_id);

-- 6. Grant permissions
GRANT ALL ON TABLE public.cauciones_rejected TO authenticated;
GRANT ALL ON TABLE public.cauciones_rejected TO service_role;

-- Comments
COMMENT ON TABLE public.cauciones_rejected IS 'Registro de PDFs de cauciones que fallaron durante el procesamiento o validación.';
COMMENT ON COLUMN cauciones.raw_text IS 'Texto extraído del PDF para auditoría y re-procesamiento.';
