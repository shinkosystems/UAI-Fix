-- Migration: 20260823_add_bot_session_to_whatsapp_chats.sql
-- Adiciona suporte a máquina de estados e sessão do bot no WhatsApp

-- 1. Colunas de sessão no whatsapp_chats
ALTER TABLE IF EXISTS public.whatsapp_chats 
ADD COLUMN IF NOT EXISTS bot_step text DEFAULT 'menu_principal',
ADD COLUMN IF NOT EXISTS bot_data jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS bot_active boolean DEFAULT true;

-- 2. Colunas de configuração do bot e notificação ao gestor no whatsapp_config
ALTER TABLE IF EXISTS public.whatsapp_config
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS bot_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS manager_phone text DEFAULT '',
ADD COLUMN IF NOT EXISTS notification_enabled boolean DEFAULT true;

-- 3. Índices para performance em buscas por CPF e telefone
CREATE INDEX IF NOT EXISTS idx_users_cpf_clean ON public.users (cpf);
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_phone ON public.whatsapp_chats (phone);
