/**
 * UAI-Fix - Motor de Precificação Analítico
 * Custeio Direto, Indireto, Logística, Tributação e Formação de Preço de Venda
 */

export interface ItemMaterialOrcamento {
  id?: string;
  nome: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

export interface ItemServicoOrcamento {
  id?: string;
  nome: string;
  horas: number;
  valor_hora: number;
  valor_total: number;
}

export interface PricingEngineConfig {
  custo_hora_base: number;
  custo_km_padrao: number;
  taxa_ferramental_padrao_pct: number;
  taxa_seguro_padrao_pct: number;
  taxa_overhead_padrao_pct: number;
  taxa_plataforma_padrao_pct: number;
  taxa_gateway_padrao_pct: number;
  aliquota_imposto_padrao_pct: number;
  margem_lucro_padrao_pct: number;
}

export const DEFAULT_PRICING_CONFIG: PricingEngineConfig = {
  custo_hora_base: 60.0,
  custo_km_padrao: 2.5,
  taxa_ferramental_padrao_pct: 5.0,
  taxa_seguro_padrao_pct: 3.0,
  taxa_overhead_padrao_pct: 8.0,
  taxa_plataforma_padrao_pct: 10.0,
  taxa_gateway_padrao_pct: 3.99,
  aliquota_imposto_padrao_pct: 6.0,
  margem_lucro_padrao_pct: 25.0
};

export interface DetalhamentoCustosOrcamento {
  // Custos Diretos
  total_materiais: number;
  total_mao_de_obra_rh: number;
  total_horas_servico: number;
  total_deslocamento: number;
  distancia_km: number;
  custo_km_unitario: number;
  subtotal_custos_diretos: number;

  // Custos Indiretos / Fixos
  custo_ferramentas: number;
  taxa_ferramental_pct: number;
  custo_seguro_garantia: number;
  taxa_seguro_pct: number;
  custo_overhead_fixo: number;
  taxa_overhead_pct: number;
  subtotal_custos_indiretos: number;

  // Custo Operacional Total
  custo_operacional_total: number;

  // Formação de Preço e Taxas
  lucro_margem_valor: number;
  margem_lucro_pct: number;
  taxa_plataforma_valor: number;
  taxa_plataforma_pct: number;
  taxa_gateway_valor: number;
  taxa_gateway_pct: number;
  subtotal_antes_imposto: number;

  // Tributação
  aliquota_imposto_pct: number;
  valor_imposto: number;

  // Preço Final
  preco_final_venda: number;
}

export interface PricingEngineInput {
  itens_materiais?: ItemMaterialOrcamento[];
  itens_servicos?: ItemServicoOrcamento[];
  distancia_km?: number;
  custo_km_unitario?: number;
  override_custo_deslocamento?: number;
  override_custo_mao_de_obra?: number;
  override_custo_ferramentas?: number;
  override_custo_seguro?: number;
  override_custo_overhead?: number;
  override_custo_fixo_manual?: number;
  taxa_ferramental_pct?: number;
  taxa_seguro_pct?: number;
  taxa_overhead_pct?: number;
  margem_lucro_pct?: number;
  override_lucro_valor?: number;
  taxa_plataforma_pct?: number;
  override_taxa_plataforma?: number;
  taxa_gateway_pct?: number;
  override_taxa_pagamento?: number;
  aliquota_imposto_pct?: number;
}

/**
 * Calcula o DRE e formação de preço da Ordem de Serviço
 */
export function calculatePricingEngine(
  input: PricingEngineInput,
  config: PricingEngineConfig = DEFAULT_PRICING_CONFIG
): DetalhamentoCustosOrcamento {
  // 1. Materiais & Insumos
  const itensMateriais = input.itens_materiais || [];
  const totalMateriais = +(
    itensMateriais.reduce((acc, item) => acc + (Number(item.valor_total) || 0), 0)
  ).toFixed(2);

  // 2. Mão de Obra / Serviços
  const itensServicos = input.itens_servicos || [];
  let totalHoras = 0;
  let totalMaoDeObraCalculada = 0;

  if (itensServicos.length > 0) {
    itensServicos.forEach(item => {
      totalHoras += Number(item.horas) || 0;
      totalMaoDeObraCalculada += Number(item.valor_total) || 0;
    });
  }

  const totalMaoDeObra = +(
    input.override_custo_mao_de_obra !== undefined && input.override_custo_mao_de_obra > 0
      ? input.override_custo_mao_de_obra
      : totalMaoDeObraCalculada
  ).toFixed(2);

  // 3. Logística & Deslocamento
  const distanciaKm = Math.max(0, Number(input.distancia_km) || 0);
  const custoKmUnitario = Math.max(
    0,
    Number(input.custo_km_unitario ?? config.custo_km_padrao) || 0
  );
  const deslocamentoCalculado = distanciaKm * custoKmUnitario;
  const totalDeslocamento = +(
    input.override_custo_deslocamento !== undefined && input.override_custo_deslocamento > 0
      ? input.override_custo_deslocamento
      : deslocamentoCalculado
  ).toFixed(2);

  const subtotalCustosDiretos = +(totalMateriais + totalMaoDeObra + totalDeslocamento).toFixed(2);

  // 4. Custos Indiretos e Fixos
  const taxaFerramentalPct =
    input.taxa_ferramental_pct ?? config.taxa_ferramental_padrao_pct;
  const custoFerramentas = +(
    input.override_custo_ferramentas !== undefined && input.override_custo_ferramentas > 0
      ? input.override_custo_ferramentas
      : totalMaoDeObra * (taxaFerramentalPct / 100)
  ).toFixed(2);

  const taxaSeguroPct = input.taxa_seguro_pct ?? config.taxa_seguro_padrao_pct;
  const custoSeguroGarantia = +(
    input.override_custo_seguro !== undefined && input.override_custo_seguro > 0
      ? input.override_custo_seguro
      : (totalMaoDeObra + totalMateriais) * (taxaSeguroPct / 100)
  ).toFixed(2);

  const taxaOverheadPct = input.taxa_overhead_pct ?? config.taxa_overhead_padrao_pct;
  const custoOverheadFixo = +(
    input.override_custo_overhead !== undefined && input.override_custo_overhead > 0
      ? input.override_custo_overhead
      : (input.override_custo_fixo_manual && input.override_custo_fixo_manual > 0)
      ? input.override_custo_fixo_manual
      : subtotalCustosDiretos * (taxaOverheadPct / 100)
  ).toFixed(2);

  const subtotalCustosIndiretos = +(
    custoFerramentas + custoSeguroGarantia + custoOverheadFixo
  ).toFixed(2);

  const custoOperacionalTotal = +(
    subtotalCustosDiretos + subtotalCustosIndiretos
  ).toFixed(2);

  // 5. Margem de Lucro
  const margemLucroPct = input.margem_lucro_pct ?? config.margem_lucro_padrao_pct;
  const lucroMargemValor = +(
    input.override_lucro_valor !== undefined && input.override_lucro_valor > 0
      ? input.override_lucro_valor
      : custoOperacionalTotal * (margemLucroPct / 100)
  ).toFixed(2);

  // 6. Taxas de Plataforma e Gateway
  const taxaPlataformaPct =
    input.taxa_plataforma_pct ?? config.taxa_plataforma_padrao_pct;
  const taxaGatewayPct =
    input.taxa_gateway_pct ?? config.taxa_gateway_padrao_pct;

  const baseParaTaxas = custoOperacionalTotal + lucroMargemValor;

  const taxaPlataformaValor = +(
    input.override_taxa_plataforma !== undefined && input.override_taxa_plataforma > 0
      ? input.override_taxa_plataforma
      : baseParaTaxas * (taxaPlataformaPct / 100)
  ).toFixed(2);

  const taxaGatewayValor = +(
    input.override_taxa_pagamento !== undefined && input.override_taxa_pagamento > 0
      ? input.override_taxa_pagamento
      : baseParaTaxas * (taxaGatewayPct / 100)
  ).toFixed(2);

  const subtotalAntesImposto = +(
    baseParaTaxas + taxaPlataformaValor + taxaGatewayValor
  ).toFixed(2);

  // 7. Impostos
  const aliquotaImpostoPct =
    input.aliquota_imposto_pct ?? config.aliquota_imposto_padrao_pct;
  const valorImposto = +(
    subtotalAntesImposto * (aliquotaImpostoPct / 100)
  ).toFixed(2);

  // 8. Preço Final
  const precoFinalVenda = +(subtotalAntesImposto + valorImposto).toFixed(2);

  return {
    total_materiais: totalMateriais,
    total_mao_de_obra_rh: totalMaoDeObra,
    total_horas_servico: +totalHoras.toFixed(2),
    total_deslocamento: totalDeslocamento,
    distancia_km: distanciaKm,
    custo_km_unitario: custoKmUnitario,
    subtotal_custos_diretos: subtotalCustosDiretos,
    custo_ferramentas: custoFerramentas,
    taxa_ferramental_pct: taxaFerramentalPct,
    custo_seguro_garantia: custoSeguroGarantia,
    taxa_seguro_pct: taxaSeguroPct,
    custo_overhead_fixo: custoOverheadFixo,
    taxa_overhead_pct: taxaOverheadPct,
    subtotal_custos_indiretos: subtotalCustosIndiretos,
    custo_operacional_total: custoOperacionalTotal,
    lucro_margem_valor: lucroMargemValor,
    margem_lucro_pct: margemLucroPct,
    taxa_plataforma_valor: taxaPlataformaValor,
    taxa_plataforma_pct: taxaPlataformaPct,
    taxa_gateway_valor: taxaGatewayValor,
    taxa_gateway_pct: taxaGatewayPct,
    subtotal_antes_imposto: subtotalAntesImposto,
    aliquota_imposto_pct: aliquotaImpostoPct,
    valor_imposto: valorImposto,
    preco_final_venda: precoFinalVenda
  };
}
