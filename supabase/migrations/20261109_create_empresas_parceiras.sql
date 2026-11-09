-- Migration: Create empresas_parceiras table and associate with users and chaves
-- Created at: 2026-11-09

-- 1. Create empresas_parceiras table
CREATE TABLE IF NOT EXISTS empresas_parceiras (
    id BIGSERIAL PRIMARY KEY,
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    cnpj TEXT,
    setor TEXT,
    email TEXT,
    whatsapp TEXT,
    data_criacao TEXT,
    ativa BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Add empresa_id and empresa_nome to users table
ALTER TABLE IF EXISTS users
ADD COLUMN IF NOT EXISTS empresa_id BIGINT REFERENCES empresas_parceiras(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS empresa_nome TEXT;

-- 3. Add empresa_id to chaves (Ordens de Serviço)
ALTER TABLE IF EXISTS chaves
ADD COLUMN IF NOT EXISTS empresa_id BIGINT REFERENCES empresas_parceiras(id) ON DELETE SET NULL;

-- 4. Indexes for high performance
CREATE INDEX IF NOT EXISTS idx_users_empresa_id ON users(empresa_id);
CREATE INDEX IF NOT EXISTS idx_chaves_empresa_id ON chaves(empresa_id);

COMMENT ON TABLE empresas_parceiras IS 'Cadastro de empresas de reforma e facilities parceiras da UAI Fix';
COMMENT ON COLUMN users.empresa_id IS 'ID da empresa parceira vinculada a este usuário (gestor, cliente ou profissional)';
COMMENT ON COLUMN chaves.empresa_id IS 'ID da empresa parceira responsável pela Ordem de Serviço';
