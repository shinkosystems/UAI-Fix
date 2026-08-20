-- Migration: Adicionar suporte a tipo_alvo na tabela avaliacoes (Serviço vs Plataforma UaiFix)
-- Data: 2026-08-14

ALTER TABLE avaliacoes 
ADD COLUMN IF NOT EXISTS tipo_alvo VARCHAR(30) DEFAULT 'profissional';

-- Constraint para garantir valores válidos
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_tipo_alvo'
    ) THEN
        ALTER TABLE avaliacoes 
        ADD CONSTRAINT check_tipo_alvo 
        CHECK (tipo_alvo IN ('profissional', 'plataforma_uaifix'));
    END IF;
END $$;
