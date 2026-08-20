import React, { useState } from 'react';
import { 
  GitFork, Workflow, CheckCircle2, Clock, AlertTriangle, ShieldCheck, 
  ArrowRight, Users, Smartphone, Bot, DollarSign, Star, Calendar, 
  Camera, FileText, ChevronRight, Layers, Sparkles, HelpCircle, 
  ExternalLink, Zap, RefreshCw, MessageSquare, Info, Sliders, ArrowDown,
  Building, UserCheck, Check, CornerDownRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FlowNode {
  id: string;
  stepNumber: number;
  stage: string;
  title: string;
  shortDesc: string;
  actor: 'cliente' | 'prestador' | 'ia_sistema' | 'gestor';
  statusDb: string;
  sla: string;
  icon: any;
  color: {
    bg: string;
    border: string;
    text: string;
    badge: string;
    badgeText: string;
  };
  details: {
    objective: string;
    howItWorks: string[];
    dbTables: string[];
    triggersAndAutomation: string[];
    businessRules: string[];
    customerView: string;
    professionalView: string;
  };
}

const FLOW_NODES: FlowNode[] = [
  {
    id: 'captacao',
    stepNumber: 1,
    stage: 'Entrada & Aquisição',
    title: '1. Captação Multicanal',
    shortDesc: 'Cliente inicia o pedido via App PWA, Web, Bot do WhatsApp (Z-API) ou link rastreado.',
    actor: 'cliente',
    statusDb: 'pendente / novo',
    sla: '< 1 minuto',
    icon: Smartphone,
    color: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      text: 'text-blue-600',
      badge: 'bg-blue-100',
      badgeText: 'text-blue-800'
    },
    details: {
      objective: 'Capturar a demanda do cliente de forma instantânea, registrando dados de contato, localização e canal de aquisição.',
      howItWorks: [
        'O cliente acessa a UAI Fix pela Landing Page, PWA ou diretamente pelo WhatsApp oficial.',
        'Os parâmetros UTM de campanhas (Google, Instagram, Meta Ads) são gravados automaticamente.',
        'Um chamado é registrado na tabela com status inicial "pendente".'
      ],
      dbTables: ['chaves', 'users'],
      triggersAndAutomation: [
        'Z-API Webhook recebe a primeira mensagem e instancia a conversa.',
        'Função initTrackingCapture() persiste UTMs no localStorage para atribuição.'
      ],
      businessRules: [
        'Identificação por telefone WhatsApp (formato E.164 sanitizado).',
        'Criação de usuário temporário caso ainda não possua conta cadastrada.'
      ],
      customerView: 'Experiência fluida e sem fricção: escolhe a categoria de serviço ou descreve o problema no chat.',
      professionalView: 'Ainda não notificado nesta fase inicial.'
    }
  },
  {
    id: 'triagem_precificacao',
    stepNumber: 2,
    stage: 'Triagem & Orçamento',
    title: '2. Triagem e Orçamento Dinâmico',
    shortDesc: 'A IA e a Matriz de Precificação calculam mão de obra e insumos para gerar a proposta.',
    actor: 'ia_sistema',
    statusDb: 'analise / orcamento / aguardando_aprovacao',
    sla: 'Instantâneo a 5 minutos',
    icon: Bot,
    color: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-600',
      badge: 'bg-amber-100',
      badgeText: 'text-amber-800'
    },
    details: {
      objective: 'Estruturar o escopo técnico do chamado e calcular a precificação com base na tabela oficial de serviços.',
      howItWorks: [
        'O motor de IA categoriza a complexidade do serviço (Elétrica, Hidráulica, Alvenaria, Pintura, etc.).',
        'Gera orçamento detalhando mão de obra, tempo estimado e estimativa de insumos.',
        'A proposta comercial é enviada ao cliente com link de aprovação interativo.'
      ],
      dbTables: ['orcamentos', 'planejamento', 'chaves'],
      triggersAndAutomation: [
        'Cálculo do motor de precificação UAI Fix com margem da plataforma.',
        'Disparo de notificação WhatsApp com link direto para o resumo do orçamento.'
      ],
      businessRules: [
        'Orçamentos padronizados evitam variações abusivas de preço em campo.',
        'Se o cliente recusar, o chamado é arquivado com motivo registrado.'
      ],
      customerView: 'Recebe orçamento transparente com discriminação clara do valor e condições de pagamento.',
      professionalView: 'O valor da mão de obra do prestador já fica pré-estabelecido com clareza.'
    }
  },
  {
    id: 'matching_alocacao',
    stepNumber: 3,
    stage: 'Alocação & Agenda',
    title: '3. Matching & Despacho do Prestador',
    shortDesc: 'Algoritmo seleciona o melhor prestador por cidade, pontuação elite e disponibilidade.',
    actor: 'ia_sistema',
    statusDb: 'aguardando_profissional / agendado',
    sla: '3 a 15 minutos',
    icon: Users,
    color: {
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/30',
      text: 'text-purple-600',
      badge: 'bg-purple-100',
      badgeText: 'text-purple-800'
    },
    details: {
      objective: 'Encontrar e engajar o profissional ideal disponível na cidade do cliente com máxima taxa de aceite.',
      howItWorks: [
        'O algoritmo filtra prestadores credenciados por especialidade e localização geográfica.',
        'Ordena por Score de Desempenho (avaliações 5 estrelas e taxa de pontualidade).',
        'Dispara convite de serviço via WhatsApp/Push; o primeiro a aceitar assume o chamado.',
        'Integração com Google Calendar bloqueia a agenda do prestador e do cliente.'
      ],
      dbTables: ['users', 'agenda', 'chaves'],
      triggersAndAutomation: [
        'Edge Function de Matching consulta profissionais ativos e envia mensagem via Z-API.',
        'Sincronização bidirecional com Google Calendar para geração do evento.'
      ],
      businessRules: [
        'Prestadores com selo "Elite UAI Fix" recebem chamados com prioridade.',
        'Tempo limite de 10 minutos para aceite antes de repassar para o próximo da fila.'
      ],
      customerView: 'Recebe os dados do profissional (foto, nome e avaliação) e o horário confirmado.',
      professionalView: 'Visualiza a distância, escopo resumido e ganho líquido garantido antes de aceitar.'
    }
  },
  {
    id: 'execucao_os',
    stepNumber: 4,
    stage: 'Execução & OS Digital',
    title: '4. Execução em Campo & Fotos Antes/Depois',
    shortDesc: 'Prestador realiza check-in no local, documenta fotos Antes/Depois e encerra a OS.',
    actor: 'prestador',
    statusDb: 'executando / aguardando_gestor',
    sla: 'Conforme agendamento',
    icon: Camera,
    color: {
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/30',
      text: 'text-indigo-600',
      badge: 'bg-indigo-100',
      badgeText: 'text-indigo-800'
    },
    details: {
      objective: 'Garantir a execução técnica com comprovação digital incontestável de entrega do serviço.',
      howItWorks: [
        'O profissional comparece ao local e realiza o Check-in no App.',
        'Registra obrigatoriamente a foto do estado "Antes" da realização do reparo.',
        'Executa o trabalho de acordo com as diretrizes e normas de segurança.',
        'Registra a foto do estado "Depois", colhe a assinatura digital e finaliza a Ordem de Serviço.'
      ],
      dbTables: ['ordemservico', 'chaves'],
      triggersAndAutomation: [
        'Armazenamento seguro de fotos no Supabase Storage com carimbo de data/hora.',
        'Geração automática do PDF da Ordem de Serviço oficial da UAI Fix via jsPDF.'
      ],
      businessRules: [
        'A OS só pode ser concluída mediante envio comprovado de ambas as fotos (Antes e Depois).',
        'Qualquer alteração de escopo requer aprovação adicional do cliente.'
      ],
      customerView: 'Acompanha o status em tempo real e inspeciona visualmente as fotos no término.',
      professionalView: 'Interface simplificada para envio das fotos com 1 toque no celular.'
    }
  },
  {
    id: 'pagamento_split',
    stepNumber: 5,
    stage: 'Liquidação Financeira',
    title: '5. Pagamento Seguro & Split UAI Fix',
    shortDesc: 'Liquidação via PIX ou Cartão, retenção da taxa da plataforma e liberação ao prestador.',
    actor: 'gestor',
    statusDb: 'aprovado / faturado',
    sla: '< 5 minutos',
    icon: DollarSign,
    color: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      text: 'text-emerald-600',
      badge: 'bg-emerald-100',
      badgeText: 'text-emerald-800'
    },
    details: {
      objective: 'Processar a transação financeira com total segurança, garantindo a comissão UAI Fix e o repasse pontual.',
      howItWorks: [
        'O cliente efetua o pagamento pelo link seguro (PIX dinâmico ou Cartão de Crédito).',
        'O sistema realiza o split automático das porcentagens acordadas.',
        'Gera recibo fiscal/comprovante digital enviado automaticamente por WhatsApp e email.'
      ],
      dbTables: ['orcamentos', 'chaves'],
      triggersAndAutomation: [
        'Webhook de confirmação de pagamento atualiza o status do chamado.',
        'Notificação instantânea para o prestador com comprovante de saldo a receber.'
      ],
      businessRules: [
        'Pagamento seguro retido até a validação do término da OS.',
        'Garantia de recebimento para o prestador parceiro.'
      ],
      customerView: 'Opções flexíveis de pagamento com proteção e recibo detalhado.',
      professionalView: 'Transparência total dos valores e extrato no painel de ganhos.'
    }
  },
  {
    id: 'pos_venda_garantia',
    stepNumber: 6,
    stage: 'Qualidade & Garantia',
    title: '6. Pós-Venda, Avaliação & Garantia 90 Dias',
    shortDesc: 'Coleta de avaliação com estrelas. Notas < 3 acionam auditoria; notas ≥ 3 sobem o ranking.',
    actor: 'cliente',
    statusDb: 'concluido / revisao_qualidade',
    sla: '24h pós-serviço (90 dias garantia)',
    icon: Star,
    color: {
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/30',
      text: 'text-rose-600',
      badge: 'bg-rose-100',
      badgeText: 'text-rose-800'
    },
    details: {
      objective: 'Fechar o ciclo assegurando a excelência de atendimento, fidelização do cliente e garantia formal de 90 dias.',
      howItWorks: [
        'Após a conclusão, um formulário de avaliação por estrelas (1 a 5) é enviado ao cliente.',
        'Se a nota for 4 ou 5: o prestador sobe no ranking e ganha prioridade em novos chamados.',
        'Se a nota for 1 ou 2: um alerta prioritário de auditoria é enviado ao Gestor para contato imediato.',
        'O cliente conta com suporte ativo e garantia de 90 dias com cobertura UAI Fix.'
      ],
      dbTables: ['avaliacoes', 'chaves', 'users'],
      triggersAndAutomation: [
        'Edge Function de pós-venda dispara pesquisa de satisfação 2 horas após a conclusão.',
        'Trigger no Supabase atualiza a média geral de estrelas no perfil do profissional.'
      ],
      businessRules: [
        'Todos os serviços possuem garantia de 90 dias contra defeitos de execução.',
        'Prestadores com média abaixo de 4.0 entram em plano de reciclagem ou suspensão preventiva.'
      ],
      customerView: 'Tranquilidade e segurança com garantia oficial e canal direto para feedback.',
      professionalView: 'Reconhecimento do trabalho bem feito aumentando seu volume de chamados futuros.'
    }
  }
];

const ACTORS_LEGEND = [
  { key: 'cliente', label: 'Cliente Final', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Smartphone },
  { key: 'ia_sistema', label: 'IA & Automação UAI Fix', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Bot },
  { key: 'prestador', label: 'Profissional Parceiro', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: Users },
  { key: 'gestor', label: 'Gestor / Painel Admin', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: ShieldCheck },
];

export const AdminFluxoServico: React.FC = () => {
  const navigate = useNavigate();
  const [selectedNode, setSelectedNode] = useState<FlowNode>(FLOW_NODES[0]);
  const [activeTab, setActiveTab] = useState<'flow' | 'steps' | 'mermaid' | 'rules'>('flow');
  const [filterActor, setFilterActor] = useState<string>('all');

  const filteredNodes = filterActor === 'all' 
    ? FLOW_NODES 
    : FLOW_NODES.filter(n => n.actor === filterActor);

  return (
    <div className="space-y-8 pb-12">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider border border-blue-400/30">
                <Workflow size={14} /> Arquitetura Operacional
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-400/30">
                <Sparkles size={12} /> Engenharia de Processos
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
              Como Funciona o Serviço UAI Fix
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Mapeamento de ponta a ponta do ciclo de atendimento: desde a aquisição multicanal e precificação algorítmica até a execução em campo com fotos Antes/Depois, split de pagamentos e garantia de 90 dias.
            </p>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end gap-3 flex-shrink-0">
            <button
              onClick={() => navigate('/admin/chamados')}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
            >
              <span>Ver Chamados em Tempo Real</span>
              <ArrowRight size={14} />
            </button>
            <button
              onClick={() => navigate('/admin/relatorios')}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center gap-2"
            >
              <span>Métricas & Desempenho</span>
            </button>
          </div>
        </div>
      </div>

      {/* Control Bar: View Modes & Actor Filters */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* View Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveTab('flow')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'flow'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GitFork size={15} className="text-blue-600" />
            <span>Fluxograma Interativo</span>
          </button>

          <button
            onClick={() => setActiveTab('steps')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'steps'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers size={15} className="text-purple-600" />
            <span>Guia Passo a Passo</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'rules'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck size={15} className="text-emerald-600" />
            <span>Regras & SLAs</span>
          </button>

          <button
            onClick={() => setActiveTab('mermaid')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'mermaid'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Workflow size={15} className="text-amber-600" />
            <span>Código do Diagrama</span>
          </button>
        </div>

        {/* Actor Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <Sliders size={12} /> Filtrar Ator:
          </span>
          <button
            onClick={() => setFilterActor('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
              filterActor === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Todos (360°)
          </button>
          {ACTORS_LEGEND.map(act => {
            const IconComp = act.icon;
            const isSelected = filterActor === act.key;
            return (
              <button
                key={act.key}
                onClick={() => setFilterActor(act.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <IconComp size={12} />
                <span>{act.label}</span>
              </button>
            );
          })}
        </div>

      </div>

      {/* Main Tab 1: Interactive Flowchart */}
      {activeTab === 'flow' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          
          {/* Left / Top: Interactive Nodes Diagram */}
          <div className="xl:col-span-7 space-y-4">
            
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <GitFork size={16} className="text-blue-600" />
                  Navegue pelas 6 Etapas Operacionais
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  Clique em um bloco para ver detalhes técnicos
                </span>
              </div>
            </div>

            {/* Steps Flow Grid */}
            <div className="space-y-3 relative">
              {filteredNodes.map((node, index) => {
                const IconComponent = node.icon;
                const isSelected = selectedNode.id === node.id;

                return (
                  <div key={node.id} className="relative">
                    
                    {/* Flow Item Card */}
                    <div
                      onClick={() => setSelectedNode(node)}
                      className={`cursor-pointer rounded-2xl p-4 sm:p-5 border transition-all relative overflow-hidden group ${
                        isSelected 
                          ? 'bg-white border-blue-600 ring-2 ring-blue-500/20 shadow-md transform -translate-y-0.5' 
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        
                        {/* Step Number & Icon */}
                        <div className="flex items-start space-x-3.5">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold flex-shrink-0 transition-colors ${
                            isSelected 
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                              : `${node.color.bg} ${node.color.text}`
                          }`}>
                            <IconComponent size={20} />
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                Etapa 0{node.stepNumber} • {node.stage}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${node.color.badge} ${node.color.badgeText}`}>
                                SLA: {node.sla}
                              </span>
                            </div>

                            <h4 className={`text-base font-bold transition-colors ${isSelected ? 'text-blue-700' : 'text-slate-900 group-hover:text-blue-600'}`}>
                              {node.title}
                            </h4>

                            <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                              {node.shortDesc}
                            </p>
                          </div>
                        </div>

                        {/* Right Selection Indicator */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden sm:inline">
                            Status DB: <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{node.statusDb.split('/')[0].trim()}</span>
                          </span>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                            isSelected 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                          }`}>
                            <ChevronRight size={16} />
                          </div>
                        </div>

                      </div>

                      {/* Bottom Quick Badges */}
                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-400">Ator Responsável:</span>
                          <span className="font-bold text-slate-700 capitalize">
                            {node.actor === 'ia_sistema' ? '🤖 IA & Sistema' : node.actor === 'cliente' ? '👤 Cliente' : node.actor === 'prestador' ? '🛠️ Prestador' : '🛡️ Gestor'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
                          <span>Tabelas:</span>
                          {node.details.dbTables.map(tb => (
                            <span key={tb} className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-semibold">{tb}</span>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* Arrow down connector between nodes (except last) */}
                    {index < filteredNodes.length - 1 && (
                      <div className="flex justify-center my-1">
                        <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shadow-2xs">
                          <ArrowDown size={12} />
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

          </div>

          {/* Right: Rich Node Detail Drawer / Inspection Panel */}
          <div className="xl:col-span-5 sticky top-6 space-y-5">
            
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-lg space-y-6">
              
              {/* Header Details */}
              <div className="space-y-3 pb-5 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg ${selectedNode.color.badge} ${selectedNode.color.badgeText}`}>
                    Etapa {selectedNode.stepNumber} de 06
                  </span>
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                    <Clock size={13} /> SLA Médio: <strong className="text-slate-800">{selectedNode.sla}</strong>
                  </span>
                </div>

                <h3 className="text-xl font-extrabold text-slate-900">
                  {selectedNode.title}
                </h3>

                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <strong>Objetivo:</strong> {selectedNode.details.objective}
                </p>
              </div>

              {/* Como Funciona na Prática */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-500" />
                  Como Funciona o Processo:
                </h4>
                <ul className="space-y-2">
                  {selectedNode.details.howItWorks.map((item, idx) => (
                    <li key={idx} className="text-xs text-slate-600 flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Automações & Triggers */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Bot size={14} className="text-blue-500" />
                  Triggers, Webhooks & Automações:
                </h4>
                <div className="bg-slate-900 text-slate-200 p-3.5 rounded-xl text-xs space-y-1.5 font-mono">
                  {selectedNode.details.triggersAndAutomation.map((trig, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-slate-300">
                      <span className="text-emerald-400">⚡</span>
                      <span className="text-[11px] leading-relaxed">{trig}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Regras de Negócio UAI Fix */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-500" />
                  Regras de Negócio & Conformidade:
                </h4>
                <div className="space-y-1.5">
                  {selectedNode.details.businessRules.map((rule, idx) => (
                    <div key={idx} className="text-xs text-slate-700 bg-emerald-50/60 border border-emerald-200/60 p-2.5 rounded-lg flex items-start gap-2">
                      <Check size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span className="leading-snug">{rule}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visão Dupla: Cliente vs Prestador */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-100 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 flex items-center gap-1">
                    <Smartphone size={12} /> Visão do Cliente
                  </span>
                  <p className="text-[11px] text-slate-700 leading-snug">
                    {selectedNode.details.customerView}
                  </p>
                </div>

                <div className="bg-purple-50/70 p-3 rounded-xl border border-purple-100 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 flex items-center gap-1">
                    <Users size={12} /> Visão do Prestador
                  </span>
                  <p className="text-[11px] text-slate-700 leading-snug">
                    {selectedNode.details.professionalView}
                  </p>
                </div>
              </div>

              {/* Supabase Schema Links */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-400">Tabelas Relacionadas:</span>
                <div className="flex items-center gap-1.5">
                  {selectedNode.details.dbTables.map(table => (
                    <span key={table} className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-[10px] font-bold rounded">
                      public.{table}
                    </span>
                  ))}
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* Main Tab 2: Guia Passo a Passo (Detailed Cards) */}
      {activeTab === 'steps' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FLOW_NODES.map((node) => {
            const IconComp = node.icon;
            return (
              <div key={node.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-all">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${node.color.bg} ${node.color.text} font-bold`}>
                      <IconComp size={20} />
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${node.color.badge} ${node.color.badgeText}`}>
                      Etapa 0{node.stepNumber}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">
                    {node.title}
                  </h3>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    {node.shortDesc}
                  </p>

                  <div className="space-y-1.5 pt-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Pontos-Chave:</span>
                    {node.details.howItWorks.map((item, i) => (
                      <div key={i} className="text-xs text-slate-700 flex items-start gap-2">
                        <span className="text-blue-500 font-bold">•</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">SLA: <strong className="text-slate-700">{node.sla}</strong></span>
                  <button 
                    onClick={() => { setSelectedNode(node); setActiveTab('flow'); }}
                    className="text-blue-600 font-bold hover:underline flex items-center gap-1 text-xs"
                  >
                    Ver no Fluxo <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Tab 3: Regras de Negócio & SLAs */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-blue-900 text-white p-6 rounded-2xl space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-300">Garantia UAI Fix</span>
              <h3 className="text-2xl font-black">90 Dias de Cobertura</h3>
              <p className="text-xs text-blue-200 leading-relaxed">
                Todos os reparos concluídos possuem respaldo de reexecução sem custo caso ocorra reincidência de vício no prazo legal.
              </p>
            </div>

            <div className="bg-slate-900 text-white p-6 rounded-2xl space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">Qualidade Inegociável</span>
              <h3 className="text-2xl font-black">Fotos Antes / Depois</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Nenhuma Ordem de Serviço pode ser encerrada sem upload obrigatório de comprovação visual com geolocalização e data.
              </p>
            </div>

            <div className="bg-emerald-900 text-white p-6 rounded-2xl space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">Auditoria Automatizada</span>
              <h3 className="text-2xl font-black">Score &lt; 3.0 = Alarme</h3>
              <p className="text-xs text-emerald-200 leading-relaxed">
                Avaliações com nota 1 ou 2 disparam alerta prioritário imediato na central do Gestor para mediação e garantia.
              </p>
            </div>
          </div>

          {/* Matriz de SLAs */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Matriz de SLAs e Tempos de Resposta</h3>
                <p className="text-xs text-slate-500">Métricas de compromisso de serviço monitoradas pela plataforma</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Fase Operacional</th>
                    <th className="px-6 py-3.5">Ator Principal</th>
                    <th className="px-6 py-3.5">Tempo Médio Estimado</th>
                    <th className="px-6 py-3.5">Ação em Caso de Atraso</th>
                    <th className="px-6 py-3.5">Status DB Associado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold text-slate-900">1. Captação & Triagem</td>
                    <td className="px-6 py-4">Cliente / Bot WhatsApp</td>
                    <td className="px-6 py-4 text-emerald-600 font-bold">&lt; 1 min</td>
                    <td className="px-6 py-4">Bot reitera opções de serviço no WhatsApp</td>
                    <td className="px-6 py-4 font-mono text-slate-500">pendente</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold text-slate-900">2. Cálculo do Orçamento</td>
                    <td className="px-6 py-4">Motor IA UAI Fix</td>
                    <td className="px-6 py-4 text-emerald-600 font-bold">Imediato a 5 min</td>
                    <td className="px-6 py-4">Alerta de intervenção para Gestor aprovar tabela</td>
                    <td className="px-6 py-4 font-mono text-slate-500">orcamento</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold text-slate-900">3. Aceite do Prestador</td>
                    <td className="px-6 py-4">Profissional Credenciado</td>
                    <td className="px-6 py-4 text-amber-600 font-bold">10 min max</td>
                    <td className="px-6 py-4">Repasse automático para o próximo prestador da fila</td>
                    <td className="px-6 py-4 font-mono text-slate-500">aguardando_profissional</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold text-slate-900">4. Execução & Envio de Fotos</td>
                    <td className="px-6 py-4">Profissional no Local</td>
                    <td className="px-6 py-4 text-indigo-600 font-bold">Conforme Agendamento</td>
                    <td className="px-6 py-4">Bloqueio de finalização sem ambas as fotos</td>
                    <td className="px-6 py-4 font-mono text-slate-500">executando</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold text-slate-900">5. Liquidação & Split</td>
                    <td className="px-6 py-4">Gateway / Gestor</td>
                    <td className="px-6 py-4 text-emerald-600 font-bold">&lt; 5 min</td>
                    <td className="px-6 py-4">Notificação de cobrança pendente ao cliente</td>
                    <td className="px-6 py-4 font-mono text-slate-500">aprovado / faturado</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold text-slate-900">6. Pesquisa de Pós-Venda</td>
                    <td className="px-6 py-4">Cliente / Bot IA</td>
                    <td className="px-6 py-4 text-purple-600 font-bold">2h após conclusão</td>
                    <td className="px-6 py-4">Se nota &lt; 3: abertura de chamado de auditoria</td>
                    <td className="px-6 py-4 font-mono text-slate-500">concluido</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Main Tab 4: Mermaid Diagram Text */}
      {activeTab === 'mermaid' && (
        <div className="bg-slate-900 text-slate-200 rounded-3xl p-6 sm:p-8 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Workflow size={18} className="text-blue-400" />
                Diagrama de Processos (Mermaid.js)
              </h3>
              <p className="text-xs text-slate-400">Você pode copiar este código para usar no Mermaid Live Editor ou documentações internas</p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`flowchart TD
    %% 1. ENTRADA
    CLIENTE([Cliente via Web / PWA / WhatsApp]) -->|Inicia Pedido| TRIAGEM[Triagem & Análise do Escopo]
    
    %% 2. ORÇAMENTO
    TRIAGEM --> ORCAMENTO[Motor IA: Orçamento Mão de Obra + Insumos]
    ORCAMENTO --> APROVACAO{Cliente Aprova Proposta?}
    APROVACAO -->|Não| RECUSADO([Chamado Cancelado / Arquivado])
    
    %% 3. ALOCAÇÃO
    APROVACAO -->|Sim| MATCHING[Algoritmo de Matching por Cidade & Score]
    MATCHING --> CONVITE[Convite via WhatsApp Z-API ao Prestador]
    CONVITE --> AGENDAMENTO[Sincronização Google Calendar]
    
    %% 4. EXECUÇÃO
    AGENDAMENTO --> CHECKIN[Prestador: Check-in no Local]
    CHECKIN --> FOTO_ANTES[Upload Obrigatório: Foto Antes]
    FOTO_ANTES --> EXECUCAO[Realização Técnica do Serviço]
    EXECUCAO --> FOTO_DEPOIS[Upload Obrigatório: Foto Depois]
    FOTO_DEPOIS --> OS_CONCLUIDA[Encerramento de OS & Geração PDF]
    
    %% 5. PAGAMENTO
    OS_CONCLUIDA --> PAGAMENTO[Liquidação PIX / Cartão & Split UAI Fix]
    
    %% 6. PÓS-VENDA
    PAGAMENTO --> AVALIACAO{Avaliação por Estrelas 1 a 5}
    AVALIACAO -->|Nota >= 3| RANKING_ELITE[Atualiza Score no Perfil do Prestador]
    AVALIACAO -->|Nota < 3| AUDITORIA[Abre Alerta Prioritário de Garantia com Gestor]
    
    RANKING_ELITE --> SUCESSO([Finalizado com Garantia 90 Dias])
    AUDITORIA --> SUCESSO`);
                alert('Código Mermaid copiado para a área de transferência!');
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all"
            >
              Copiar Mermaid Code
            </button>
          </div>

          <pre className="text-xs font-mono bg-slate-950 p-5 rounded-2xl text-emerald-400 overflow-x-auto leading-relaxed border border-slate-800">
{`flowchart TD
    %% 1. ENTRADA
    CLIENTE([Cliente via Web / PWA / WhatsApp]) -->|Inicia Pedido| TRIAGEM[Triagem & Análise do Escopo]
    
    %% 2. ORÇAMENTO
    TRIAGEM --> ORCAMENTO[Motor IA: Orçamento Mão de Obra + Insumos]
    ORCAMENTO --> APROVACAO{Cliente Aprova Proposta?}
    APROVACAO -->|Não| RECUSADO([Chamado Cancelado / Arquivado])
    
    %% 3. ALOCAÇÃO
    APROVACAO -->|Sim| MATCHING[Algoritmo de Matching por Cidade & Score]
    MATCHING --> CONVITE[Convite via WhatsApp Z-API ao Prestador]
    CONVITE --> AGENDAMENTO[Sincronização Google Calendar]
    
    %% 4. EXECUÇÃO
    AGENDAMENTO --> CHECKIN[Prestador: Check-in no Local]
    CHECKIN --> FOTO_ANTES[Upload Obrigatório: Foto Antes]
    FOTO_ANTES --> EXECUCAO[Realização Técnica do Serviço]
    EXECUCAO --> FOTO_DEPOIS[Upload Obrigatório: Foto Depois]
    FOTO_DEPOIS --> OS_CONCLUIDA[Encerramento de OS & Geração PDF]
    
    %% 5. PAGAMENTO
    OS_CONCLUIDA --> PAGAMENTO[Liquidação PIX / Cartão & Split UAI Fix]
    
    %% 6. PÓS-VENDA
    PAGAMENTO --> AVALIACAO{Avaliação por Estrelas 1 a 5}
    AVALIACAO -->|Nota >= 3| RANKING_ELITE[Atualiza Score no Perfil do Prestador]
    AVALIACAO -->|Nota < 3| AUDITORIA[Abre Alerta Prioritário de Garantia com Gestor]
    
    RANKING_ELITE --> SUCESSO([Finalizado com Garantia 90 Dias])
    AUDITORIA --> SUCESSO`}
          </pre>
        </div>
      )}

    </div>
  );
};

export default AdminFluxoServico;
