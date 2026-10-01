-- Migration: 20261001_restrict_super_admin_email_peboorba.sql
-- Descrição: Restringe o papel de Super Administrador global exclusivamente ao email peboorba@gmail.com
-- Autor: Xander / Squad de Engenharia Shinkō Systems
-- Data: 01/10/2026

-- 1. Atualizar função de verificação de Super Admin para validação restrita por email canônico
CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT COALESCE(
        (SELECT (
            (is_super_admin = true OR tipo IN ('admin', 'super_admin'))
            AND LOWER(TRIM(COALESCE(email, ''))) = 'peboorba@gmail.com'
         )
         FROM public.users 
         WHERE uuid = auth.uid()::text 
            OR uuid = (auth.jwt() ->> 'sub')
         LIMIT 1),
        -- Fallback direto pelo JWT claim de email se disponível
        (LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', ''))) = 'peboorba@gmail.com'),
        false
    );
$$;

-- 2. Conceder permissão explícita de Super Admin para o usuário peboorba@gmail.com na base
UPDATE public.users
SET 
    is_super_admin = true,
    tipo = 'admin',
    cargo = 'Super Administrador Global',
    departamento = 'Diretoria Executiva',
    updated_at = NOW()
WHERE LOWER(TRIM(email)) = 'peboorba@gmail.com';

-- 3. Revogar is_super_admin de qualquer outro usuário não autorizado
UPDATE public.users
SET 
    is_super_admin = false,
    updated_at = NOW()
WHERE LOWER(TRIM(COALESCE(email, ''))) <> 'peboorba@gmail.com'
  AND is_super_admin = true;

COMMENT ON FUNCTION public.is_current_user_super_admin() IS 
'Valida se o usuário autenticado é o Super Administrador Canônico da UAI Fix (restrito a peboorba@gmail.com).';
