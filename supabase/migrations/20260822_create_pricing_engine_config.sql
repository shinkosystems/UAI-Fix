-- Migration: Add advanced pricing engine fields and global config
-- Created at: 2026-08-22

-- 1. Create pricing_engine_config table for global standard parameters
CREATE TABLE IF NOT EXISTS pricing_engine_config (
    id SERIAL PRIMARY KEY,
    custo_hora_base NUMERIC DEFAULT 60.00,
    custo_km_padrao NUMERIC DEFAULT 2.50,
    taxa_ferramental_padrao_pct NUMERIC DEFAULT 5.0,
    taxa_seguro_padrao_pct NUMERIC DEFAULT 3.0,
    taxa_overhead_padrao_pct NUMERIC DEFAULT 8.0,
    taxa_plataforma_padrao_pct NUMERIC DEFAULT 10.0,
    taxa_gateway_padrao_pct NUMERIC DEFAULT 3.99,
    aliquota_imposto_padrao_pct NUMERIC DEFAULT 6.0,
    margem_lucro_padrao_pct NUMERIC DEFAULT 25.0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insert default row if not exists
INSERT INTO pricing_engine_config (id, custo_hora_base, custo_km_padrao, taxa_ferramental_padrao_pct, taxa_seguro_padrao_pct, taxa_overhead_padrao_pct, taxa_plataforma_padrao_pct, taxa_gateway_padrao_pct, aliquota_imposto_padrao_pct, margem_lucro_padrao_pct)
VALUES (1, 60.00, 2.50, 5.0, 3.0, 8.0, 10.0, 3.99, 6.0, 25.0)
ON CONFLICT (id) DO NOTHING;

-- 2. Add detailed pricing engine fields to orcamentos table
ALTER TABLE IF EXISTS orcamentos
ADD COLUMN IF NOT EXISTS itens_servicos JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS distancia_km NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS custo_km_unitario NUMERIC DEFAULT 2.50,
ADD COLUMN IF NOT EXISTS custo_ferramentas NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS custo_seguro NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS custo_overhead NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS detalhamento_custos JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN orcamentos.itens_servicos IS 'Lista detalhada de serviços/etapas com tempo e HH [{id, nome, horas, valor_hora, valor_total}]';
COMMENT ON COLUMN orcamentos.distancia_km IS 'Distância estimada em quilômetros para deslocamento técnico';
COMMENT ON COLUMN orcamentos.custo_km_unitario IS 'Valor cobrado por quilômetro rodado (R$/km)';
COMMENT ON COLUMN orcamentos.custo_ferramentas IS 'Rateio de depreciação e manutenção de ferramental técnico';
COMMENT ON COLUMN orcamentos.custo_seguro IS 'Custo de contingência, seguro de obra e garantia técnica';
COMMENT ON COLUMN orcamentos.custo_overhead IS 'Rateio de custo fixo administrativo e operacional';
COMMENT ON COLUMN orcamentos.detalhamento_custos IS 'DRE consolidado da precificação da OS';
