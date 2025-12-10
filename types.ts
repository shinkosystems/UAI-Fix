
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
  
  // Address Fields
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string; // Added CEP
  cidade: number; // Keep as number for backward compatibility and saving
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
  profissional: string; // uuid
  nota: number;
  comentario: string;
  cliente: string; // uuid
  chave: number;
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
  created_at: string;
  // Execution Photos
  fotoantes?: string[];
  fotodepois?: string[];
  // Nested data from JOINs
  geral?: { nome: string; imagem?: string };
  // cliente object might be injected manually or via join
  clienteData?: User; 
  profissional?: string | User | null; // Depending on how we map it
}

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
  // Nested relation from JOIN
  chaves?: Chave;
}

export interface Orcamento {
  id: number;
  tipopagmto: string;
  parcelas: number;
  notafiscal: boolean;
  imposto: number;
  custofixo: number;
  custovariavel: number;
  preco: number;
  lucro: number;
  hh: number;
  observacaocliente: string;
  ativo: boolean;
  chave: number;
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
