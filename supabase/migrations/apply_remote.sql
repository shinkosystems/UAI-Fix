-- ==============================================================================
-- 1. FUNÇÕES AUXILIARES DE CONTEXTO (SECURITY DEFINER)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT organization_id 
    FROM public.users 
    WHERE uuid::text = auth.uid()::text 
       OR uuid::text = (auth.jwt() ->> 'sub')
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT COALESCE(
        (SELECT (
            (is_super_admin = true OR tipo IN ('admin', 'super_admin', 'Gestor', 'gestor'))
            AND LOWER(TRIM(COALESCE(email, ''))) = 'peboorba@gmail.com'
         )
         FROM public.users 
         WHERE uuid::text = auth.uid()::text 
            OR uuid::text = (auth.jwt() ->> 'sub')
         LIMIT 1),
        (LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', ''))) = 'peboorba@gmail.com'),
        false
    );
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_tipo()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT tipo 
    FROM public.users 
    WHERE uuid::text = auth.uid()::text 
       OR uuid::text = (auth.jwt() ->> 'sub')
    LIMIT 1;
$$;

-- ==============================================================================
-- 2. ATUALIZAR PEDRO BORBA COMO SUPER ADMIN OFICIAL
-- ==============================================================================

UPDATE public.users
SET 
    is_super_admin = true,
    cargo = 'Super Administrador Global',
    departamento = 'Diretoria Executiva'
WHERE LOWER(TRIM(email)) = 'peboorba@gmail.com';

-- ==============================================================================
-- 3. POLÍTICAS RLS NAS TABELAS
-- ==============================================================================

-- A. Organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organizations_super_admin_all" ON public.organizations;
CREATE POLICY "organizations_super_admin_all"
    ON public.organizations FOR ALL
    USING (public.is_current_user_super_admin() OR auth.role() = 'authenticated')
    WITH CHECK (public.is_current_user_super_admin() OR auth.role() = 'authenticated');

-- B. Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_all_authenticated" ON public.users;
CREATE POLICY "users_read_all_authenticated"
    ON public.users FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "users_update_super_admin" ON public.users;
CREATE POLICY "users_update_super_admin"
    ON public.users FOR UPDATE
    USING (public.is_current_user_super_admin() OR uuid::text = auth.uid()::text)
    WITH CHECK (public.is_current_user_super_admin() OR uuid::text = auth.uid()::text);

-- C. Chaves (Chamados / OS)
ALTER TABLE public.chaves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chaves_super_admin_all" ON public.chaves;
CREATE POLICY "chaves_super_admin_all"
    ON public.chaves FOR ALL
    USING (public.is_current_user_super_admin() OR true)
    WITH CHECK (public.is_current_user_super_admin() OR true);
