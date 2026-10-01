-- Migration: 20261001_create_organizations_multi_tenant.sql
-- Descrição: Modelagem Multi-Tenant para o Uai Fix (Organizações, Equipes e Gestão de Tarefas)
-- Autor: Squad de Engenharia Shinkō Systems
-- Data: 01/10/2026

-- 1. Criação da Tabela de Organizações / Empresas Clientes
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    cnpj VARCHAR(20),
    razao_social VARCHAR(255),
    email_contato VARCHAR(255),
    telefone_contato VARCHAR(50),
    logo_url TEXT,
    cor_primaria VARCHAR(20) DEFAULT '#f89301',
    limite_colaboradores INTEGER DEFAULT 25,
    limite_chamados_mes INTEGER DEFAULT 500,
    plano VARCHAR(50) DEFAULT 'pro', -- 'starter', 'pro', 'enterprise'
    ativo BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.organizations IS 'Organizações/Empresas cadastradas para gestão multi-tenant de equipes e tarefas no Uai Fix';
COMMENT ON COLUMN public.organizations.slug IS 'Identificador único amigável para URLs e isolamento de tenant';
COMMENT ON COLUMN public.organizations.cor_primaria IS 'Customização visual da marca da organização';

-- 2. Índices de Performance em Organizations
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations (slug);
CREATE INDEX IF NOT EXISTS idx_organizations_ativo ON public.organizations (ativo);

-- 3. Adição de Colunas Multi-Tenant na Tabela USERS
-- Regra: Apenas gestores, colaboradores e admins possuem organization_id. Clientes finais mantêm NULL.
ALTER TABLE IF EXISTS public.users
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cargo VARCHAR(100),
ADD COLUMN IF NOT EXISTS departamento VARCHAR(100);

COMMENT ON COLUMN public.users.organization_id IS 'Vínculo da organização/empresa do colaborador ou gestor. Clientes permanecem NULL.';
COMMENT ON COLUMN public.users.is_super_admin IS 'Flag de Super Administrador Uai Fix para acesso irrestrito ao portal /admin';

CREATE INDEX IF NOT EXISTS idx_users_organization_id ON public.users (organization_id);
CREATE INDEX IF NOT EXISTS idx_users_is_super_admin ON public.users (is_super_admin);

-- 4. Adição de Colunas Multi-Tenant na Tabela CHAVES (Demandas / Ordens de Serviço)
ALTER TABLE IF EXISTS public.chaves
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS prioridade VARCHAR(20) DEFAULT 'media', -- 'baixa', 'media', 'alta', 'urgente'
ADD COLUMN IF NOT EXISTS categoria VARCHAR(100),
ADD COLUMN IF NOT EXISTS sla_limite TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.chaves.organization_id IS 'Organização responsável pelo atendimento e gestão desta demanda/OS';
COMMENT ON COLUMN public.chaves.prioridade IS 'Nível de prioridade da tarefa na fila da equipe';

CREATE INDEX IF NOT EXISTS idx_chaves_organization_id ON public.chaves (organization_id);
CREATE INDEX IF NOT EXISTS idx_chaves_prioridade ON public.chaves (prioridade);

-- 5. Seed Inicial de Organização Padrão (Compatibilidade Total sem Perda de Dados)
DO $$
DECLARE
    v_org_id UUID;
BEGIN
    -- Verifica ou insere a organização matriz
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE slug = 'uaifix-matriz') THEN
        INSERT INTO public.organizations (
            nome,
            slug,
            razao_social,
            plano,
            ativo
        ) VALUES (
            'UAI Fix — Matriz & Gestão Central',
            'uaifix-matriz',
            'UAI Fix Prestação de Serviços e Manutenção LTDA',
            'enterprise',
            true
        ) RETURNING id INTO v_org_id;
    ELSE
        SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'uaifix-matriz' LIMIT 1;
    END IF;

    -- Backfill: Conecta gestores e colaboradores legados à organização matriz
    UPDATE public.users
    SET organization_id = v_org_id
    WHERE organization_id IS NULL
      AND tipo IN ('gestor', 'colaborador', 'admin', 'orcamentista', 'planejista');

    -- Backfill: Associa ordens de serviço legadas à organização matriz
    UPDATE public.chaves
    SET organization_id = v_org_id
    WHERE organization_id IS NULL;

    -- Define administradores globais existentes como Super Admin
    UPDATE public.users
    SET is_super_admin = true
    WHERE tipo IN ('admin', 'super_admin');
END $$;
