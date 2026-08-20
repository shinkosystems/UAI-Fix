-- Migration: Add pricing engine fields to orcamentos table
ALTER TABLE IF EXISTS orcamentos
ADD COLUMN IF NOT EXISTS custo_variavel NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS itens_materiais JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS custo_deslocamento NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS taxa_plataforma NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS taxa_pagamento NUMERIC DEFAULT 0;

COMMENT ON COLUMN orcamentos.custo_variavel IS 'Soma total dos custos variáveis/materiais';
COMMENT ON COLUMN orcamentos.itens_materiais IS 'Lista detalhada de peças e materiais [{nome, quantidade, valor_unitario, valor_total}]';
COMMENT ON COLUMN orcamentos.custo_deslocamento IS 'Custo de deslocamento ou visita técnica';
COMMENT ON COLUMN orcamentos.taxa_plataforma IS 'Taxa de intermediação da plataforma UAI-Fix';
COMMENT ON COLUMN orcamentos.taxa_pagamento IS 'Taxa de processamento de pagamento / gateway';
