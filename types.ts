
export interface Geral {
  id: number;
  primaria: boolean;
  nome: string;
  imagem: string;
  dependencia: number | null;
  ativa: boolean;
}

export interface Agenda {
  id: number;
  execucao: string; // timestamp
  observacoes: string | null;
  profissional: string | null; // uuid
  cliente: string | null; // uuid
  chave?: number; // Link to the ticket
  dataconclusao?: string | null;
  datainicioexecucao?: string | null; // Added field for start execution time
  // Nested relation
  chaves?: Chave;
}

export interface Estado {
  id: number;
  uf: string;
}

export interface City {
  id: number;
  cidade: string;
  uf: number;
  // For nested data
  estado?: Estado;
}

export interface User {
  id: number;
  nome: string;
  email: string;
  fotoperfil: string;
  uuid: string;
  tipo: string;
  sexo: string; // Added field to match DB constraint

  origem?: string; // e.g., 'google', 'instagram', 'whatsapp', 'indicacao', 'balcao', 'organico', 'outros'
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  referrer_url?: string;

  // Address Fields
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string; // Added CEP
  cidade: number; // Keep as number for backward compatibility and saving
  cidadeNome?: string;
  estado: number;

  // Personal Fields
  cpf?: string;

  atividade?: number[]; // Changed to number array (int8[])

  // For nested data
  cidades?: City; // For nested queries
  // Aliased Nested object from JOIN to avoid conflicts
  cidade_data?: {
    cidade: string;
    uf: number;
  };

  whatsapp?: string;
  rating?: number; // Optional derived field for UI
  reviewCount?: number; // Optional derived field for UI
  // FIX: Added optional 'ativo' property to User interface.
  ativo?: boolean;
  biografia?: string; // Campo para o texto "Sobre" do profissional
}

export interface Avaliacao {
  id: number;
  created_at: string;
  profissional?: string; // uuid
  nota: number;
  comentario: string;
  cliente: string; // uuid
  chave?: number;
  tipo_alvo?: 'profissional' | 'plataforma_uaifix'; // Separating UaiFix platform rating from professional service rating
  // Optional field for UI mapping
  clienteNome?: string;
  clienteFoto?: string;
}

export interface Chave {
  id: number;
  cliente: string; // uuid
  planejista: string | null; // uuid
  orcamentista: string | null; // uuid
  chaveunica: string;
  status: string;
  atividade: number;
  // FIX: Added missing 'cidade' property to Chave interface to resolve filtering error in Chamados.tsx
  cidade: number;
  created_at: string;
  updated_at?: string;
  assinatura?: string | null;
  fina_assinatura?: string | null;
  // New field for rejection reason
  motivo_recusa?: string | null;
  // Campos para o fluxo de revisão do gestor
  relato_problema?: string | null;
  solucao_problema?: string | null;
  foto_problema?: string | null; // Added field for problem photo
  gestor_responsavel?: string | null; // Gestor responsável pela OS
  chave_vinculada_id?: number | null; // ID da OS vinculada
  chave_vinculada_codigo?: string | null; // Código único da OS vinculada
  // Execution Photos
  fotoantes?: string[];
  fotodepois?: string[];
  // Origem e Tracking
  origem?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  // Nested data from JOINs
  geral?: { nome: string; imagem?: string };
  cidade_data?: { cidade: string; uf: number };
  // cliente object might be injected manually or via join
  clienteData?: User;
  profissionalData?: User;
  gestorData?: User;
  profissional?: string | User | null; // Depending on how we map it
  whatsapp_chat_id?: string | null;
  whatsapp_lead_cpf?: string | null;
}

export interface WhatsappLead {
  id: string;
  cpf: string;
  nome: string | null;
  telefone: string | null;
  chat_id: string | null;
  user_uuid: string | null;
  vinculado: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChamadoExtended extends Chave {
  geral?: Geral;
  clienteData?: User;
  profissionalData?: User;
  orcamentos?: Orcamento[];
  planejamento?: Planejamento[];
  avaliacao?: Avaliacao;
  agenda?: Agenda[];
}

export type OriginChannelKey = 'google' | 'instagram' | 'whatsapp' | 'indicacao' | 'balcao' | 'organico' | 'outros';

export interface OriginChannelConfig {
  key: string;
  label: string;
  icon: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export const ORIGIN_CHANNELS: Record<string, OriginChannelConfig> = {
  google: {
    key: 'google',
    label: 'Google',
    icon: '🔍',
    badgeBg: 'bg-red-50 text-red-700 border-red-200',
    badgeText: 'text-red-700',
    badgeBorder: 'border-red-200'
  },
  instagram: {
    key: 'instagram',
    label: 'Instagram / Meta',
    icon: '📸',
    badgeBg: 'bg-pink-50 text-pink-700 border-pink-200',
    badgeText: 'text-pink-700',
    badgeBorder: 'border-pink-200'
  },
  whatsapp: {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: '💬',
    badgeBg: 'bg-green-50 text-green-700 border-green-200',
    badgeText: 'text-green-700',
    badgeBorder: 'border-green-200'
  },
  indicacao: {
    key: 'indicacao',
    label: 'Indicação',
    icon: '🤝',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200'
  },
  balcao: {
    key: 'balcao',
    label: 'Balcão / Fachada',
    icon: '🚶',
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-200'
  },
  organico: {
    key: 'organico',
    label: 'Site / Orgânico',
    icon: '🌐',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200'
  },
  outros: {
    key: 'outros',
    label: 'Outros',
    icon: '🏷️',
    badgeBg: 'bg-gray-100 text-gray-700 border-gray-200',
    badgeText: 'text-gray-700',
    badgeBorder: 'border-gray-200'
  }
};

export const getOriginBadgeConfig = (origin?: string | null): OriginChannelConfig => {
  if (!origin) return ORIGIN_CHANNELS.organico;
  const normalized = origin.toLowerCase().trim();
  if (ORIGIN_CHANNELS[normalized]) return ORIGIN_CHANNELS[normalized];
  if (normalized.includes('google')) return ORIGIN_CHANNELS.google;
  if (normalized.includes('insta') || normalized.includes('face') || normalized.includes('meta')) return ORIGIN_CHANNELS.instagram;
  if (normalized.includes('whats') || normalized.includes('zap')) return ORIGIN_CHANNELS.whatsapp;
  if (normalized.includes('indica')) return ORIGIN_CHANNELS.indicacao;
  if (normalized.includes('balcao') || normalized.includes('fachada') || normalized.includes('presencial')) return ORIGIN_CHANNELS.balcao;
  return ORIGIN_CHANNELS.outros;
};

export interface Planejamento {
  id: number;
  created_at: string;
  pagamento: string;
  descricao: string;
  qtd: number;
  visita: string | null;
  execucao: string;
  recursos: string[];
  atendpormulher: boolean;
  ativo: boolean;
  chave: number;
  tempoprevisto: number;
  imagem_pedido?: string | null; // Added field for request image
  audio_pedido?: string | null; // Added field for audio file
  justificativa_data_diferente?: string | null;
  // Nested relation from JOIN
  chaves?: Chave;
}

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
  id?: number;
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

export interface DetalhamentoCustosOrcamento {
  total_materiais: number;
  total_mao_de_obra_rh: number;
  total_horas_servico: number;
  total_deslocamento: number;
  distancia_km: number;
  custo_km_unitario: number;
  subtotal_custos_diretos: number;
  custo_ferramentas: number;
  taxa_ferramental_pct: number;
  custo_seguro_garantia: number;
  taxa_seguro_pct: number;
  custo_overhead_fixo: number;
  taxa_overhead_pct: number;
  subtotal_custos_indiretos: number;
  custo_operacional_total: number;
  lucro_margem_valor: number;
  margem_lucro_pct: number;
  taxa_plataforma_valor: number;
  taxa_plataforma_pct: number;
  taxa_gateway_valor: number;
  taxa_gateway_pct: number;
  subtotal_antes_imposto: number;
  aliquota_imposto_pct: number;
  valor_imposto: number;
  preco_final_venda: number;
}

export interface Orcamento {
  id: number;
  tipopagmto: string;
  parcelas: number;
  tipopagmto_sugerido?: string;
  parcelas_sugerido?: number;
  desconto_sugerido?: number;
  justificativa_sugerido?: string;
  notafiscal: boolean;
  imposto: number;
  custofixo: number;
  custo_variavel?: number;
  itens_materiais?: ItemMaterialOrcamento[];
  itens_servicos?: ItemServicoOrcamento[];
  distancia_km?: number;
  custo_km_unitario?: number;
  custo_ferramentas?: number;
  custo_seguro?: number;
  custo_overhead?: number;
  custo_deslocamento?: number;
  taxa_plataforma?: number;
  taxa_pagamento?: number;
  detalhamento_custos?: DetalhamentoCustosOrcamento;
  preco: number;
  lucro: number;
  hh: number;
  observacaocliente: string;
  ativo: boolean;
  chave: number;
  assinatura_cliente?: string | null;
  // Nested relation from JOIN
  chaves?: Chave;
}

export interface OrdemServico {
  id: number;
  created_at: string;
  datainicio: string | null;
  datafim?: string | null;
  status: string;
  chave: number;
  pdf?: string; // Link to the PDF in storage
  // Nested relation from JOIN
  chaves?: Chave;
}
