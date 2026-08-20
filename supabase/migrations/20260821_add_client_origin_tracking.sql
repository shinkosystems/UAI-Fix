-- Migration: Adicionar rastreamento de origem e parâmetros de aquisição/UTMs
-- Data: 2026-08-21
-- Descrição: Suporte para tracking de canais de aquisição (Google, Instagram, WhatsApp, Indicação, Balcão, etc.)

-- 1. Campos na tabela 'users'
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS origem VARCHAR(50) DEFAULT 'organico',
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS utm_term TEXT,
ADD COLUMN IF NOT EXISTS referrer_url TEXT;

-- 2. Campos na tabela 'chaves' (Chamados / Ordens de Serviço)
ALTER TABLE chaves 
ADD COLUMN IF NOT EXISTS origem VARCHAR(50) DEFAULT 'organico',
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

-- 3. Índices para performance em relatórios e filtros
CREATE INDEX IF NOT EXISTS idx_users_origem ON users(origem);
CREATE INDEX IF NOT EXISTS idx_chaves_origem ON chaves(origem);
CREATE INDEX IF NOT EXISTS idx_chaves_created_at_origem ON chaves(created_at, origem);
