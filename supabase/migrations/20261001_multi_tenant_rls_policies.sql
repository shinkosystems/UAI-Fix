-- Migration: 20261001_multi_tenant_rls_policies.sql
-- Descrição: Políticas de Row Level Security (RLS) Multi-Tenant para UAI Fix
-- Autor: Squad de Engenharia Shinkō Systems
-- Data: 01/10/2026

-- ==============================================================================
-- 1. FUNÇÕES AUXILIARES DE CONTEXTO & AUTENTICAÇÃO (SECURITY DEFINER)
-- ==============================================================================

-- Retorna o organization_id do usuário atualmente autenticado
CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT organization_id 
    FROM public.users 
    WHERE uuid = auth.uid()::text 
       OR uuid = (auth.jwt() ->> 'sub')
    LIMIT 1;
$$;

-- Verifica se o usuário autenticado é Super Administrador global da UAI Fix
CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT COALESCE(
        (SELECT (is_super_admin = true OR tipo IN ('admin', 'super_admin'))
         FROM public.users 
         WHERE uuid = auth.uid()::text 
            OR uuid = (auth.jwt() ->> 'sub')
         LIMIT 1),
        false
    );
$$;

-- Verifica o tipo/papel do usuário autenticado ('gestor', 'colaborador', 'cliente', etc.)
CREATE OR REPLACE FUNCTION public.get_current_user_tipo()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT tipo 
    FROM public.users 
    WHERE uuid = auth.uid()::text 
       OR uuid = (auth.jwt() ->> 'sub')
    LIMIT 1;
$$;

-- ==============================================================================
-- 2. ATIVAÇÃO DE RLS NAS TABELAS CENTRAIS
-- ==============================================================================

ALTER TABLE IF EXISTS public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.avaliacoes ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 3. POLÍTICAS RLS: ORGANIZATIONS
-- ==============================================================================

-- Super Admin: Acesso irrestrito a todas as organizações
DROP POLICY IF EXISTS "super_admin_all_organizations" ON public.organizations;
CREATE POLICY "super_admin_all_organizations"
ON public.organizations
FOR ALL
TO authenticated
USING (public.is_current_user_super_admin())
WITH CHECK (public.is_current_user_super_admin());

-- Membros da organização: Leitura da própria empresa
DROP POLICY IF EXISTS "members_read_own_organization" ON public.organizations;
CREATE POLICY "members_read_own_organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (id = public.get_current_user_org_id());

-- Gestores: Edição dos dados da sua própria empresa
DROP POLICY IF EXISTS "gestores_update_own_organization" ON public.organizations;
CREATE POLICY "gestores_update_own_organization"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
    id = public.get_current_user_org_id() 
    AND public.get_current_user_tipo() = 'gestor'
)
WITH CHECK (
    id = public.get_current_user_org_id() 
    AND public.get_current_user_tipo() = 'gestor'
);

-- ==============================================================================
-- 4. POLÍTICAS RLS: USERS
-- ==============================================================================

-- Super Admin: Gestão total de todos os usuários
DROP POLICY IF EXISTS "super_admin_all_users" ON public.users;
CREATE POLICY "super_admin_all_users"
ON public.users
FOR ALL
TO authenticated
USING (public.is_current_user_super_admin())
WITH CHECK (public.is_current_user_super_admin());

-- Qualquer usuário: Visualizar e editar seu próprio perfil
DROP POLICY IF EXISTS "users_manage_own_profile" ON public.users;
CREATE POLICY "users_manage_own_profile"
ON public.users
FOR ALL
TO authenticated
USING (uuid = auth.uid()::text OR uuid = (auth.jwt() ->> 'sub'))
WITH CHECK (uuid = auth.uid()::text OR uuid = (auth.jwt() ->> 'sub'));

-- Gestor e Colaborador: Visualizar colegas da mesma organização
DROP POLICY IF EXISTS "org_members_read_teammates" ON public.users;
CREATE POLICY "org_members_read_teammates"
ON public.users
FOR SELECT
TO authenticated
USING (
    organization_id IS NOT NULL 
    AND organization_id = public.get_current_user_org_id()
);

-- Gestor: Inserir e atualizar colaboradores na sua organização
DROP POLICY IF EXISTS "gestores_manage_org_collaborators" ON public.users;
CREATE POLICY "gestores_manage_org_collaborators"
ON public.users
FOR ALL
TO authenticated
USING (
    public.get_current_user_tipo() = 'gestor'
    AND organization_id = public.get_current_user_org_id()
)
WITH CHECK (
    public.get_current_user_tipo() = 'gestor'
    AND organization_id = public.get_current_user_org_id()
);

-- Clientes: Leitura de dados básicos de profissionais para agendamento
DROP POLICY IF EXISTS "clientes_read_assigned_professionals" ON public.users;
CREATE POLICY "clientes_read_assigned_professionals"
ON public.users
FOR SELECT
TO authenticated
USING (
    public.get_current_user_tipo() = 'cliente' 
    AND tipo IN ('colaborador', 'profissional')
);

-- ==============================================================================
-- 5. POLÍTICAS RLS: CHAVES (DEMANDAS / ORDENS DE SERVIÇO)
-- ==============================================================================

-- Super Admin: Gestão total de todas as ordens de serviço
DROP POLICY IF EXISTS "super_admin_all_chaves" ON public.chaves;
CREATE POLICY "super_admin_all_chaves"
ON public.chaves
FOR ALL
TO authenticated
USING (public.is_current_user_super_admin())
WITH CHECK (public.is_current_user_super_admin());

-- Membros da organização: Leitura e gestão de chamados da sua empresa
DROP POLICY IF EXISTS "org_members_manage_chaves" ON public.chaves;
CREATE POLICY "org_members_manage_chaves"
ON public.chaves
FOR ALL
TO authenticated
USING (
    organization_id IS NOT NULL 
    AND organization_id = public.get_current_user_org_id()
)
WITH CHECK (
    organization_id IS NOT NULL 
    AND organization_id = public.get_current_user_org_id()
);

-- Clientes: Leitura e criação das suas próprias demandas
DROP POLICY IF EXISTS "clientes_manage_own_chaves" ON public.chaves;
CREATE POLICY "clientes_manage_own_chaves"
ON public.chaves
FOR ALL
TO authenticated
USING (cliente = auth.uid()::text OR cliente = (auth.jwt() ->> 'sub'))
WITH CHECK (cliente = auth.uid()::text OR cliente = (auth.jwt() ->> 'sub'));

-- ==============================================================================
-- 6. POLÍTICAS RLS: AGENDA & AVALIAÇÕES
-- ==============================================================================

-- Agenda: Super Admin
DROP POLICY IF EXISTS "super_admin_all_agenda" ON public.agenda;
CREATE POLICY "super_admin_all_agenda"
ON public.agenda
FOR ALL
TO authenticated
USING (public.is_current_user_super_admin())
WITH CHECK (public.is_current_user_super_admin());

-- Agenda: Membros da organização e clientes
DROP POLICY IF EXISTS "users_manage_own_agenda" ON public.agenda;
CREATE POLICY "users_manage_own_agenda"
ON public.agenda
FOR ALL
TO authenticated
USING (
    cliente = auth.uid()::text 
    OR profissional = auth.uid()::text
    OR EXISTS (
        SELECT 1 FROM public.chaves c 
        WHERE c.id = agenda.chave 
          AND c.organization_id = public.get_current_user_org_id()
    )
)
WITH CHECK (
    cliente = auth.uid()::text 
    OR profissional = auth.uid()::text
    OR EXISTS (
        SELECT 1 FROM public.chaves c 
        WHERE c.id = agenda.chave 
          AND c.organization_id = public.get_current_user_org_id()
    )
);

-- Avaliações: Leitura para equipe e autor, escrita para cliente
DROP POLICY IF EXISTS "super_admin_all_avaliacoes" ON public.avaliacoes;
CREATE POLICY "super_admin_all_avaliacoes"
ON public.avaliacoes
FOR ALL
TO authenticated
USING (public.is_current_user_super_admin())
WITH CHECK (public.is_current_user_super_admin());

DROP POLICY IF EXISTS "clientes_create_avaliacoes" ON public.avaliacoes;
CREATE POLICY "clientes_create_avaliacoes"
ON public.avaliacoes
FOR INSERT
TO authenticated
WITH CHECK (cliente = auth.uid()::text OR cliente = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "users_read_relevant_avaliacoes" ON public.avaliacoes;
CREATE POLICY "users_read_relevant_avaliacoes"
ON public.avaliacoes
FOR SELECT
TO authenticated
USING (
    cliente = auth.uid()::text 
    OR profissional = auth.uid()::text
    OR EXISTS (
        SELECT 1 FROM public.chaves c 
        WHERE c.id = avaliacoes.chave 
          AND c.organization_id = public.get_current_user_org_id()
    )
);
