-- ==============================================================================
-- Migration: Add Super Admins for Uai Fix (Joubert, Telmo, Caio)
-- Data: 2026-10-01
-- ==============================================================================

DO $$
DECLARE
    v_matriz_org_id UUID := 'fe8ac8df-d728-412b-b6c1-7469111d18d0';
BEGIN
    -- 1. Pedro Borba (Garante vínculo com a matriz e Super Admin)
    UPDATE public.users 
    SET 
        tipo = 'Gestor',
        cargo = 'Super Administrador Global',
        departamento = 'Diretoria Executiva',
        is_super_admin = true,
        organization_id = v_matriz_org_id,
        ativo = true
    WHERE LOWER(TRIM(email)) = 'peboorba@gmail.com';

    -- 2. Joubert Lima (Beto)
    IF EXISTS (SELECT 1 FROM public.users WHERE LOWER(TRIM(email)) = 'joubertlima@gmail.com') THEN
        UPDATE public.users 
        SET 
            uuid = 'b3c10c4f-729b-4f90-ba4e-b6cb586dddc9'::uuid,
            nome = 'Joubert Lima (Beto)',
            tipo = 'Gestor',
            cargo = 'Super Administrador Global',
            departamento = 'Diretoria Executiva / Operações',
            is_super_admin = true,
            organization_id = v_matriz_org_id,
            whatsapp = COALESCE(whatsapp, '(31) 98886-7115'),
            ativo = true
        WHERE LOWER(TRIM(email)) = 'joubertlima@gmail.com';
    ELSE
        INSERT INTO public.users (
            uuid, nome, email, sexo, cidade, estado, tipo, cargo, departamento, is_super_admin, organization_id, whatsapp, ativo
        ) VALUES (
            'b3c10c4f-729b-4f90-ba4e-b6cb586dddc9'::uuid,
            'Joubert Lima (Beto)',
            'joubertlima@gmail.com',
            'Masculino',
            4459,
            22,
            'Gestor',
            'Super Administrador Global',
            'Diretoria Executiva / Operações',
            true,
            v_matriz_org_id,
            '(31) 98886-7115',
            true
        );
    END IF;

    -- 3. Telmo Mateus (TMO Engenharia)
    IF EXISTS (SELECT 1 FROM public.users WHERE LOWER(TRIM(email)) = 'telmo.mateus@gmail.com') THEN
        UPDATE public.users 
        SET 
            uuid = 'da66ab04-8112-496b-89fc-4d2b2553c37d'::uuid,
            nome = 'Telmo Mateus (TMO Engenharia)',
            tipo = 'Gestor',
            cargo = 'Super Administrador Global / Engenharia',
            departamento = 'Diretoria Executiva / Engenharia',
            is_super_admin = true,
            organization_id = v_matriz_org_id,
            whatsapp = COALESCE(whatsapp, '(31) 98880-4846'),
            ativo = true
        WHERE LOWER(TRIM(email)) = 'telmo.mateus@gmail.com';
    ELSE
        INSERT INTO public.users (
            uuid, nome, email, sexo, cidade, estado, tipo, cargo, departamento, is_super_admin, organization_id, whatsapp, ativo
        ) VALUES (
            'da66ab04-8112-496b-89fc-4d2b2553c37d'::uuid,
            'Telmo Mateus (TMO Engenharia)',
            'telmo.mateus@gmail.com',
            'Masculino',
            4459,
            22,
            'Gestor',
            'Super Administrador Global / Engenharia',
            'Diretoria Executiva / Engenharia',
            true,
            v_matriz_org_id,
            '(31) 98880-4846',
            true
        );
    END IF;

    -- 4. Caio Monteiro
    IF EXISTS (SELECT 1 FROM public.users WHERE LOWER(TRIM(email)) = 'cainhomo57@gmail.com') THEN
        UPDATE public.users 
        SET 
            uuid = 'ecacbc6e-0d77-4c1f-8685-8ed5c008a7d1'::uuid,
            nome = 'Caio Monteiro',
            tipo = 'Gestor',
            cargo = 'Super Administrador Global',
            departamento = 'Diretoria Executiva / Gestão Central',
            is_super_admin = true,
            organization_id = v_matriz_org_id,
            whatsapp = COALESCE(whatsapp, '(31) 97184-4438'),
            ativo = true
        WHERE LOWER(TRIM(email)) = 'cainhomo57@gmail.com';
    ELSE
        INSERT INTO public.users (
            uuid, nome, email, sexo, cidade, estado, tipo, cargo, departamento, is_super_admin, organization_id, whatsapp, ativo
        ) VALUES (
            'ecacbc6e-0d77-4c1f-8685-8ed5c008a7d1'::uuid,
            'Caio Monteiro',
            'cainhomo57@gmail.com',
            'Masculino',
            4459,
            22,
            'Gestor',
            'Super Administrador Global',
            'Diretoria Executiva / Gestão Central',
            true,
            v_matriz_org_id,
            '(31) 97184-4438',
            true
        );
    END IF;

END $$;

-- 5. Atualizar função de segurança is_current_user_super_admin()
CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT COALESCE(
        (SELECT (
            (is_super_admin = true OR tipo IN ('admin', 'super_admin', 'Gestor', 'gestor'))
            AND LOWER(TRIM(COALESCE(email, ''))) IN (
                'peboorba@gmail.com',
                'joubertlima@gmail.com',
                'telmo.mateus@gmail.com',
                'cainhomo57@gmail.com'
            )
         )
         FROM public.users 
         WHERE uuid::text = auth.uid()::text 
            OR uuid::text = (auth.jwt() ->> 'sub')
         LIMIT 1),
        (LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', ''))) IN (
            'peboorba@gmail.com',
            'joubertlima@gmail.com',
            'telmo.mateus@gmail.com',
            'cainhomo57@gmail.com'
        )),
        false
    );
$$;
