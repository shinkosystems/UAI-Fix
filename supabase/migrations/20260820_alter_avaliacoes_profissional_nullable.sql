-- Migration: Tornar a coluna 'profissional' opcional (nullable) na tabela avaliacoes
-- Motivo: Permitir avaliações da plataforma UaiFix (tipo_alvo = 'plataforma_uaifix') sem exigir vínculo obrigatório a um profissional

ALTER TABLE avaliacoes 
ALTER COLUMN profissional DROP NOT NULL;
