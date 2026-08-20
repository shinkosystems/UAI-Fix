/**
 * Motor de Sinônimos e Expansão Semântica para Busca de Serviços
 * Permite que buscas em linguagem natural (ex: "faxina", "cano estourado", "chuveiro queimado")
 * encontrem os serviços adequados mesmo sem correspondência textual exata.
 */

export interface SynonymConcept {
  id: string;
  targetTerms: string[]; // Termos que aparecem no nome de serviços ou categorias
  synonyms: string[];    // O que os usuários costumam digitar
}

export const SYNONYM_CONCEPTS: SynonymConcept[] = [
  // 1. Limpeza e Serviços Domésticos
  {
    id: 'limpeza_domestica',
    targetTerms: ['limpeza', 'domestica', 'domestico', 'faxina', 'residencial', 'diarista', 'lavanderia'],
    synonyms: [
      'faxina', 'faxineira', 'faxineiro', 'diarista', 'passadeira', 'passar roupa',
      'lavadeira', 'lavar roupa', 'limpar', 'limpar casa', 'limpeza pesada',
      'pos obra', 'pós obra', 'organizacao', 'arrumacao', 'arrumadeira', 'faxinas'
    ]
  },
  {
    id: 'higienizacao_estofados',
    targetTerms: ['higienizacao', 'estofado', 'sofa', 'tapete', 'colchao', 'carpete'],
    synonyms: [
      'lavar sofa', 'lavar sofá', 'limpar sofa', 'limpar sofá', 'lavagem a seco',
      'limpeza de estofados', 'higienizar sofa', 'lavar tapete', 'lavar colchao',
      'mancha sofa', 'impermeabilizacao sofa'
    ]
  },

  // 2. Hidráulica e Encanamento
  {
    id: 'hidraulica',
    targetTerms: ['hidraulica', 'hidraulico', 'encanador', 'encanamento', 'tubulacao', 'agua', 'esgoto'],
    synonyms: [
      'vazamento', 'cano', 'cano furado', 'cano estourado', 'torneira', 'torneira pingando',
      'trocar torneira', 'sifao', 'sifão', 'pia vazando', 'ralo', 'ralo entupido',
      'privada', 'vaso sanitario', 'vaso sanitário', 'descarga', 'caixa acoplada',
      'caixa dagua', 'caixa d água', 'caixa d\'agua', 'limpar caixa', 'infiltracao',
      'infiltração', 'goteira', 'desentupir', 'desentupimento', 'registro',
      'registro vazando', 'pressao agua', 'bomba dagua', 'encanadores'
    ]
  },

  // 3. Elétrica
  {
    id: 'eletrica',
    targetTerms: ['eletrica', 'eletrico', 'eletricista', 'energia', 'instalacao eletrica'],
    synonyms: [
      'chuveiro', 'chuveiro queimado', 'resistencia', 'resistência', 'trocar chuveiro',
      'tomada', 'trocar tomada', 'interruptor', 'disjuntor', 'disjuntor caindo',
      'curto', 'curto circuito', 'curto-circuito', 'fio queimado', 'fiacao', 'fiação',
      'lampada', 'lâmpada', 'lustre', 'luminaria', 'luminária', 'led', 'fita led',
      'ventilador de teto', 'instalar ventilador', 'quadro de forca', 'quadro de luz',
      '110v', '220v', 'sem luz', 'trocar disjuntor', 'eletricistas'
    ]
  },

  // 4. Climatização e Refrigeração
  {
    id: 'ar_condicionado',
    targetTerms: ['ar condicionado', 'climatizacao', 'refrigeracao', 'climatizador', 'ar-condicionado'],
    synonyms: [
      'ar', 'ar condicionado', 'ar-condicionado', 'split', 'inverter', 'ar nao gela',
      'ar não gela', 'gas ar condicionado', 'gás do ar', 'limpar ar', 'limpeza de ar',
      'instalacao de ar', 'instalação ar', 'manutencao ar', 'ar pingando', 'ar fedendo'
    ]
  },
  {
    id: 'eletrodomesticos',
    targetTerms: ['eletrodomestico', 'fogao', 'geladeira', 'maquina de lavar', 'microondas'],
    synonyms: [
      'conserto geladeira', 'geladeira nao gela', 'conserto fogao', 'fogão',
      'maquina lavar', 'lava e seca', 'tanquinho', 'micro-ondas', 'microondas',
      'conserto lavadora', 'troca de borracha geladeira'
    ]
  },

  // 5. Montagem de Móveis e Marcenaria
  {
    id: 'montagem_marcenaria',
    targetTerms: ['montador', 'montagem', 'marcenaria', 'marceneiro', 'moveis', 'móvel', 'planejado'],
    synonyms: [
      'montar movel', 'montar móvel', 'desmontar movel', 'guarda roupa', 'guarda-roupa',
      'armario', 'armário', 'comoda', 'cômoda', 'cama', 'beliche', 'mesa',
      'cadeira', 'painel tv', 'painel de tv', 'rack', 'estante', 'nicho',
      'prateleira', 'furadeira', 'furar parede', 'porta de correr', 'dobradica',
      'dobradiça', 'trocar puxador', 'gaveta emperrada', 'montadores'
    ]
  },

  // 6. Pintura e Acabamentos
  {
    id: 'pintura',
    targetTerms: ['pintura', 'pintor', 'acabamento', 'parede', 'massa corrida'],
    synonyms: [
      'pintar', 'pintar parede', 'pintar casa', 'pintar teto', 'pintar portao',
      'massa corrida', 'textura', 'grafiato', 'lixar parede', 'tinta',
      'verniz', 'porta de madeira', 'emassar', 'repintura', 'mofo parede',
      'descascando', 'impermeabilizar parede', 'pintores'
    ]
  },

  // 7. Chaveiro e Fechaduras
  {
    id: 'chaveiro',
    targetTerms: ['chaveiro', 'fechadura', 'tranca', 'porta', 'chave'],
    synonyms: [
      'copia de chave', 'cópia de chave', 'abrir porta', 'chave emperrada',
      'trocar fechadura', 'fechadura digital', 'fechadura eletronica', 'trocar miolo',
      'trancado pra fora', 'perdi a chave', 'cadeado', 'olho magico', 'olho mágico'
    ]
  },

  // 8. Pedreiro, Reformas e Alvenaria
  {
    id: 'alvenaria_reforma',
    targetTerms: ['pedreiro', 'alvenaria', 'reforma', 'construcao', 'piso', 'azulejo', 'porcelanato'],
    synonyms: [
      'trocar piso', 'assentar porcelanato', 'rejunte', 'trocar rejunte',
      'azulejista', 'quebrar parede', 'reboco', 'contrapiso', 'tijolo',
      'chapisco', 'telhado', 'telha quebrada', 'calha', 'limpar calha',
      'vazamento telhado', 'gesso', 'drywall', 'sanca', 'pedreiros'
    ]
  },

  // 9. Jardinagem e Piscina
  {
    id: 'jardinagem_externa',
    targetTerms: ['jardim', 'jardinagem', 'jardineiro', 'piscina', 'paisagismo', 'grama'],
    synonyms: [
      'cortar grama', 'aparar grama', 'podar arvore', 'podar árvore', 'poda',
      'limpar jardim', 'limpeza de piscina', 'tratar piscina', 'cloro piscina',
      'cerca viva', 'rocadeira', 'roçadeira'
    ]
  },

  // 10. Vidraçaria
  {
    id: 'vidracaria',
    targetTerms: ['vidro', 'vidracaria', 'vidraceiro', 'espelho', 'box'],
    synonyms: [
      'box banheiro', 'box de vidro', 'vidro quebrado', 'trocar vidro',
      'espelho parede', 'blindex', 'janela de vidro', 'sacada de vidro'
    ]
  }
];

/**
 * Normaliza uma string removendo acentos, espaços extras e convertendo para minúsculas.
 */
export function normalizeSemanticText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifica se um serviço ou categoria é compatível com o termo digitado pelo usuário,
 * considerando correspondência direta e expansão por sinônimos/intenção natural.
 */
export function isServiceMatch(
  serviceName: string,
  parentCategoryName: string = '',
  rawSearchTerm: string
): boolean {
  if (!rawSearchTerm || !rawSearchTerm.trim()) return true;

  const normalizedQuery = normalizeSemanticText(rawSearchTerm);
  if (!normalizedQuery) return true;

  const normalizedService = normalizeSemanticText(serviceName);
  const normalizedCategory = normalizeSemanticText(parentCategoryName);

  // 1. Correspondência direta por substring no nome do serviço ou categoria
  if (
    normalizedService.includes(normalizedQuery) ||
    normalizedCategory.includes(normalizedQuery)
  ) {
    return true;
  }

  // 2. Correspondência por palavras separadas (ex: "chuveiro lorenzetti")
  const queryTokens = normalizedQuery.split(' ').filter(t => t.length > 1);
  const allMatchDirectTokens = queryTokens.length > 0 && queryTokens.every(
    token => normalizedService.includes(token) || normalizedCategory.includes(token)
  );
  if (allMatchDirectTokens) return true;

  // 3. Verificação por conceitos e sinônimos semânticos
  for (const concept of SYNONYM_CONCEPTS) {
    // Verifica se a busca do usuário contém algum sinônimo deste conceito
    const queryMatchesConcept = concept.synonyms.some(syn => {
      const normSyn = normalizeSemanticText(syn);
      return (
        normalizedQuery.includes(normSyn) ||
        normSyn.includes(normalizedQuery) ||
        queryTokens.some(token => normSyn.includes(token))
      );
    });

    if (queryMatchesConcept) {
      // Verifica se o serviço ou categoria pertence aos termos-alvo deste conceito
      const serviceBelongsToConcept = concept.targetTerms.some(target => {
        const normTarget = normalizeSemanticText(target);
        return (
          normalizedService.includes(normTarget) ||
          normalizedCategory.includes(normTarget)
        );
      });

      if (serviceBelongsToConcept) {
        return true;
      }
    }
  }

  return false;
}
