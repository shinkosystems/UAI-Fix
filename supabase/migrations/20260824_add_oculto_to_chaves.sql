-- Migration: 20260824_add_oculto_to_chaves.sql
-- Adiciona suporte a ocultação/arquivamento de chamados concluídos/preenchidos

ALTER TABLE IF EXISTS public.chaves 
ADD COLUMN IF NOT EXISTS oculto boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_chaves_oculto ON public.chaves (oculto);
