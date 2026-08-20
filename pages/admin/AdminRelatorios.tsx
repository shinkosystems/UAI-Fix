import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  BarChart3, Calendar, Clock, CheckCircle2, AlertTriangle, 
  Star, Download, Filter, Search, User, ChevronRight, X, 
  TrendingUp, Award, Activity, ArrowUpRight, DollarSign,
  Briefcase, CheckCircle, RefreshCw, FileText, Printer
} from 'lucide-react';
import { ChamadoExtended, ORIGIN_CHANNELS, getOriginBadgeConfig } from '../../types';
import { PrintOsModal } from '../../components/modals/PrintOsModal';
import { OsPrintData } from '../../utils/osPrinter';

interface ProfessionalPerformance {
  uuid: string;
  nome: string;
  fotoperfil?: string;
  totalAtribuidos: number;
  concluidos: number;
  emAndamento: number;
  cancelados: number;
  tempoMedioHoras: number;
  mediaAvaliacao: number;
  totalAvaliacoes: number;
}

const AdminRelatorios: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<ChamadoExtended[]>([]);
  const [selectedTicketForTimeline, setSelectedTicketForTimeline] = useState<ChamadoExtended | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const buildOsPrintData = (ticket: ChamadoExtended): OsPrintData => {
    const plan = ticket.planejamento?.[0];
    const budget = ticket.orcamentos?.[0];

    return {
      codigoOs: ticket.chaveunica || String(ticket.id),
      dataEmissao: ticket.created_at,
      status: ticket.status || 'Finalizado',
      cliente: {
        nome: ticket.clienteData?.nome || 'Cliente UAI Fix',
        cpf: ticket.clienteData?.cpf,
        telefone: ticket.clienteData?.whatsapp,
        enderecoCompleto: [ticket.clienteData?.rua, ticket.clienteData?.numero].filter(Boolean).join(', ') || 'Endereço não informado',
        bairro: ticket.clienteData?.bairro,
        cidade: ticket.clienteData?.cidadeNome || '',
        cep: ticket.clienteData?.cep,
        complemento: ticket.clienteData?.complemento
      },
      profissional: {
        nome: ticket.profissionalData?.nome || 'Profissional UAI Fix',
        telefone: ticket.profissionalData?.whatsapp || '',
        especialidade: ticket.geral?.nome || 'Manutenção'
      },
      servico: {
        categoria: ticket.geral?.nome || 'Serviço Geral',
        descricaoPedido: plan?.descricao || '',
        recursosAlocados: plan?.recursos || [],
        dataExecucao: plan?.execucao || ''
      },
      financeiro: {
        precoTotal: budget?.preco || 0,
        formaPagamento: budget?.tipopagmto || 'PIX',
        parcelas: budget?.parcelas || 1,
        notaFiscal: budget?.notafiscal || false,
        observacoes: budget?.observacaocliente || ''
      },
      execucao: {
        fotoAntes: ticket.fotoantes || [],
        fotoDepois: ticket.fotodepois || [],
        relatoProblema: ticket.relato_problema
      },
      assinatura: {
        assinaturaUrl: ticket.fina_assinatura || ticket.assinatura || undefined,
        cpfAssinante: ticket.clienteData?.cpf,
        timestamp: ticket.updated_at
      }
    };
  };

  // Filters
  const [periodFilter, setPeriodFilter] = useState<'7d' | '30d' | 'mes' | 'todos'>('30d');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [professionalFilter, setProfessionalFilter] = useState<string>('todos');
  const [categoryFilter, setCategoryFilter] = useState<string>('todos');
  const [originFilter, setOriginFilter] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Lists for dropdowns
  const [professionalsList, setProfessionalsList] = useState<{ uuid: string; nome: string }[]>([]);
  const [categoriesList, setCategoriesList] = useState<{ id: number; nome: string }[]>([]);

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      setLoading(true);

      const { data: chaves, error } = await supabase
        .from('chaves')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!chaves || chaves.length === 0) {
        setTickets([]);
        return;
      }

      const chaveIds = chaves.map(c => c.id);
      const userUuids = new Set<string>();
      const serviceIds = new Set<number>();

      chaves.forEach(c => {
        if (c.cliente) userUuids.add(c.cliente);
        if (c.profissional) userUuids.add(typeof c.profissional === 'string' ? c.profissional : (c.profissional as any)?.uuid);
        if (c.atividade) serviceIds.add(c.atividade);
      });

      const [usersRes, servicesRes, orcRes, planRes, avalRes, agendaRes] = await Promise.all([
        userUuids.size > 0 ? supabase.from('users').select('*').in('uuid', Array.from(userUuids)) : { data: [] },
        serviceIds.size > 0 ? supabase.from('geral').select('*').in('id', Array.from(serviceIds)) : { data: [] },
        chaveIds.length > 0 ? supabase.from('orcamentos').select('*').in('chave', chaveIds) : { data: [] },
        chaveIds.length > 0 ? supabase.from('planejamento').select('*').in('chave', chaveIds) : { data: [] },
        chaveIds.length > 0 ? supabase.from('avaliacoes').select('*').in('chave', chaveIds) : { data: [] },
        chaveIds.length > 0 ? supabase.from('agenda').select('*').in('chave', chaveIds) : { data: [] }
      ]);

      const usersMap: Record<string, any> = {};
      usersRes.data?.forEach((u: any) => { usersMap[u.uuid] = u; });

      const servicesMap: Record<number, any> = {};
      servicesRes.data?.forEach((s: any) => { servicesMap[s.id] = s; });

      const orcMap: Record<number, any[]> = {};
      orcRes.data?.forEach((o: any) => {
        const key = Number(o.chave);
        if (!orcMap[key]) orcMap[key] = [];
        orcMap[key].push(o);
      });

      const planMap: Record<number, any[]> = {};
      planRes.data?.forEach((p: any) => {
        const key = Number(p.chave);
        if (!planMap[key]) planMap[key] = [];
        planMap[key].push(p);
      });

      const avalMap: Record<number, any> = {};
      avalRes.data?.forEach((a: any) => {
        avalMap[Number(a.chave)] = a;
      });

      const agendaMap: Record<number, any[]> = {};
      agendaRes.data?.forEach((ag: any) => {
        const key = Number(ag.chave);
        if (!agendaMap[key]) agendaMap[key] = [];
        agendaMap[key].push(ag);
      });

      const enriched: ChamadoExtended[] = chaves.map(c => {
        const profUuid = typeof c.profissional === 'string' ? c.profissional : (c.profissional as any)?.uuid;
        return {
          ...c,
          clienteData: usersMap[c.cliente],
          profissionalData: profUuid ? usersMap[profUuid] : undefined,
          geral: servicesMap[c.atividade],
          orcamentos: orcMap[c.id] || [],
          planejamento: planMap[c.id] || [],
          avaliacao: avalMap[c.id],
          agenda: agendaMap[c.id] || []
        };
      });

      setTickets(enriched);

      // Extract unique professionals and categories for filter options
      const profs: { uuid: string; nome: string }[] = [];
      const seenProfs = new Set<string>();
      enriched.forEach(t => {
        if (t.profissionalData?.uuid && !seenProfs.has(t.profissionalData.uuid)) {
          seenProfs.add(t.profissionalData.uuid);
          profs.push({ uuid: t.profissionalData.uuid, nome: t.profissionalData.nome });
        }
      });
      setProfessionalsList(profs);

      const cats: { id: number; nome: string }[] = [];
      const seenCats = new Set<number>();
      enriched.forEach(t => {
        if (t.geral?.id && !seenCats.has(t.geral.id)) {
          seenCats.add(t.geral.id);
          cats.push({ id: t.geral.id, nome: t.geral.nome });
        }
      });
      setCategoriesList(cats);

    } catch (err) {
      console.error('Erro ao carregar dados do relatório:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper date filtering
  const filteredTickets = useMemo(() => {
    const now = new Date();
    
    return tickets.filter(t => {
      // 1. Period filter
      if (t.created_at) {
        const ticketDate = new Date(t.created_at);
        if (periodFilter === '7d') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (ticketDate < sevenDaysAgo) return false;
        } else if (periodFilter === '30d') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (ticketDate < thirtyDaysAgo) return false;
        } else if (periodFilter === 'mes') {
          if (ticketDate.getMonth() !== now.getMonth() || ticketDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
        }
      }

      // 2. Status filter
      const normStatus = (t.status || '').toLowerCase();
      if (statusFilter === 'concluido') {
        if (!['concluido', 'aguardando_gestor'].includes(normStatus)) return false;
      } else if (statusFilter === 'execucao') {
        if (!['aprovado', 'executando', 'execucao', 'agendado'].includes(normStatus)) return false;
      } else if (statusFilter === 'pendente') {
        if (!['pendente', 'solicitado', 'novo', 'analise', 'aguardando_profissional', 'orcamento', 'planejamento'].includes(normStatus)) return false;
      } else if (statusFilter === 'cancelado') {
        if (!['recusado', 'reprovado', 'cancelado'].includes(normStatus)) return false;
      }

      // 3. Professional filter
      if (professionalFilter !== 'todos') {
        const profUuid = t.profissionalData?.uuid || (typeof t.profissional === 'string' ? t.profissional : '');
        if (profUuid !== professionalFilter) return false;
      }

      // 4. Category filter
      if (categoryFilter !== 'todos') {
        if (t.atividade !== Number(categoryFilter)) return false;
      }

      // 5. Origin filter
      if (originFilter !== 'todos') {
        const itemOrigin = (t.origem || t.clienteData?.origem || 'organico').toLowerCase();
        if (itemOrigin !== originFilter) return false;
      }

      // 6. Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const code = (t.chaveunica || '').toLowerCase();
        const clientName = (t.clienteData?.nome || '').toLowerCase();
        const profName = (t.profissionalData?.nome || '').toLowerCase();
        const catName = (t.geral?.nome || '').toLowerCase();
        const matches = code.includes(term) || clientName.includes(term) || profName.includes(term) || catName.includes(term);
        if (!matches) return false;
      }

      return true;
    });
  }, [tickets, periodFilter, statusFilter, professionalFilter, categoryFilter, originFilter, searchTerm]);

  // Aggregate Performance Metrics
  const metrics = useMemo(() => {
    const total = filteredTickets.length;
    let concluidos = 0;
    let emAndamento = 0;
    let cancelados = 0;
    let totalDuracaoHoras = 0;
    let countDuracao = 0;
    let somaNotas = 0;
    let countNotas = 0;
    let faturamentoTotal = 0;

    filteredTickets.forEach(t => {
      const normStatus = (t.status || '').toLowerCase();
      if (['concluido', 'aguardando_gestor'].includes(normStatus)) {
        concluidos++;

        // Calculate resolution time if agenda / dates available
        const agendaItem = t.agenda && t.agenda[0];
        if (agendaItem?.dataconclusao && t.created_at) {
          const start = new Date(t.created_at).getTime();
          const end = new Date(agendaItem.dataconclusao).getTime();
          const hours = (end - start) / (1000 * 60 * 60);
          if (hours > 0) {
            totalDuracaoHoras += hours;
            countDuracao++;
          }
        }
      } else if (['recusado', 'reprovado', 'cancelado'].includes(normStatus)) {
        cancelados++;
      } else {
        emAndamento++;
      }

      // Ratings
      if (t.avaliacao?.nota) {
        somaNotas += Number(t.avaliacao.nota);
        countNotas++;
      }

      // Revenue calculation from active / approved budget
      if (t.orcamentos && t.orcamentos.length > 0) {
        const activeOrc = t.orcamentos.find(o => o.ativo) || t.orcamentos[0];
        if (activeOrc?.preco) {
          faturamentoTotal += Number(activeOrc.preco);
        }
      }
    });

    const taxaConclusao = total > 0 ? ((concluidos / total) * 100).toFixed(1) : '0';
    const tempoMedio = countDuracao > 0 ? (totalDuracaoHoras / countDuracao).toFixed(1) : 'N/D';
    const mediaSatisfacao = countNotas > 0 ? (somaNotas / countNotas).toFixed(1) : '5.0';

    return {
      total,
      concluidos,
      emAndamento,
      cancelados,
      taxaConclusao,
      tempoMedio,
      mediaSatisfacao,
      countNotas,
      faturamentoTotal
    };
  }, [filteredTickets]);

  // Performance By Acquisition Channel / Origin
  const originMetrics = useMemo(() => {
    const map: Record<string, {
      key: string;
      label: string;
      icon: string;
      total: number;
      concluidos: number;
      faturamento: number;
      badgeBg: string;
    }> = {};

    Object.values(ORIGIN_CHANNELS).forEach(ch => {
      map[ch.key] = {
        key: ch.key,
        label: ch.label,
        icon: ch.icon,
        total: 0,
        concluidos: 0,
        faturamento: 0,
        badgeBg: ch.badgeBg
      };
    });

    filteredTickets.forEach(t => {
      const orig = (t.origem || t.clienteData?.origem || 'organico').toLowerCase();
      const chKey = ORIGIN_CHANNELS[orig] ? orig : 'outros';
      if (!map[chKey]) {
        map[chKey] = {
          key: chKey,
          label: orig,
          icon: '🏷️',
          total: 0,
          concluidos: 0,
          faturamento: 0,
          badgeBg: 'bg-gray-100 text-gray-700 border-gray-200'
        };
      }

      map[chKey].total++;
      const normStatus = (t.status || '').toLowerCase();
      if (['concluido', 'aguardando_gestor'].includes(normStatus)) {
        map[chKey].concluidos++;
      }

      const activeOrc = t.orcamentos?.find(o => o.ativo) || t.orcamentos?.[0];
      if (activeOrc?.preco) {
        map[chKey].faturamento += Number(activeOrc.preco);
      }
    });

    return Object.values(map)
      .filter(m => m.total > 0 || ['google', 'instagram', 'whatsapp', 'indicacao'].includes(m.key))
      .sort((a, b) => b.total - a.total);
  }, [filteredTickets]);

  // Performance By Professional
  const professionalPerformances = useMemo(() => {
    const map: Record<string, ProfessionalPerformance> = {};

    filteredTickets.forEach(t => {
      const prof = t.profissionalData;
      if (!prof || !prof.uuid) return;

      if (!map[prof.uuid]) {
        map[prof.uuid] = {
          uuid: prof.uuid,
          nome: prof.nome || 'Profissional',
          fotoperfil: prof.fotoperfil,
          totalAtribuidos: 0,
          concluidos: 0,
          emAndamento: 0,
          cancelados: 0,
          tempoMedioHoras: 0,
          mediaAvaliacao: 0,
          totalAvaliacoes: 0
        };
      }

      const p = map[prof.uuid];
      p.totalAtribuidos++;

      const normStatus = (t.status || '').toLowerCase();
      if (['concluido', 'aguardando_gestor'].includes(normStatus)) {
        p.concluidos++;
      } else if (['recusado', 'reprovado', 'cancelado'].includes(normStatus)) {
        p.cancelados++;
      } else {
        p.emAndamento++;
      }

      if (t.avaliacao?.nota) {
        p.mediaAvaliacao += Number(t.avaliacao.nota);
        p.totalAvaliacoes++;
      }
    });

    return Object.values(map)
      .map(p => ({
        ...p,
        mediaAvaliacao: p.totalAvaliacoes > 0 ? Number((p.mediaAvaliacao / p.totalAvaliacoes).toFixed(1)) : 5.0
      }))
      .sort((a, b) => b.concluidos - a.concluidos);
  }, [filteredTickets]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'OS / Chave Unica',
      'Origem',
      'Cliente',
      'Categoria',
      'Profissional',
      'Data Abertura',
      'Status',
      'Valor Orcamento (R$)',
      'Nota Avaliacao'
    ];

    const rows = filteredTickets.map(t => {
      const activeOrc = t.orcamentos?.find(o => o.ativo) || t.orcamentos?.[0];
      const origCfg = getOriginBadgeConfig(t.origem || t.clienteData?.origem);
      return [
        `"${t.chaveunica || t.id}"`,
        `"${origCfg.label}"`,
        `"${t.clienteData?.nome || 'Nao informado'}"`,
        `"${t.geral?.nome || 'Geral'}"`,
        `"${t.profissionalData?.nome || 'Pendente'}"`,
        `"${t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR') : ''}"`,
        `"${t.status || ''}"`,
        `"${activeOrc?.preco || 0}"`,
        `"${t.avaliacao?.nota || 'N/A'}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_servicos_uaifix_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (['concluido', 'aguardando_gestor'].includes(s)) {
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle size={12} /> Concluído</span>;
    }
    if (['aprovado', 'executando', 'execucao', 'agendado'].includes(s)) {
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"><Clock size={12} /> Em Execução</span>;
    }
    if (['recusado', 'reprovado', 'cancelado'].includes(s)) {
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200"><AlertTriangle size={12} /> Cancelado</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"><Activity size={12} /> Pendente/Análise</span>;
  };

  return (
    <div className="space-y-8">

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider border border-blue-400/30">
              <BarChart3 size={14} /> Inteligência Operacional & Dados
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Desempenho & Histórico de Serviços</h1>
            <p className="text-sm text-slate-300">
              Acompanhamento analítico de SLAs, produtividade de prestadores, índice de satisfação (CSAT) e auditoria de serviços.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={exportToCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm border border-white/20 shadow-sm transition-all"
            >
              <Download size={16} />
              Exportar CSV
            </button>
            <button
              onClick={fetchReportData}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition-all"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
            <Filter size={16} className="text-blue-600" />
            Filtros do Relatório
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Exibindo <strong>{filteredTickets.length}</strong> de <strong>{tickets.length}</strong> serviços
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* Period Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Período</label>
            <select
              value={periodFilter}
              onChange={(e: any) => setPeriodFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="mes">Mês Atual</option>
              <option value="todos">Histórico Completo</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="todos">Todos os Status</option>
              <option value="concluido">Apenas Concluídos</option>
              <option value="execucao">Em Execução</option>
              <option value="pendente">Pendentes/Orçamento</option>
              <option value="cancelado">Cancelados/Recusados</option>
            </select>
          </div>

          {/* Origem / Canal Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Origem / Canal</label>
            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="todos">Todos os Canais</option>
              {Object.values(ORIGIN_CHANNELS).map(ch => (
                <option key={ch.key} value={ch.key}>{ch.icon} {ch.label}</option>
              ))}
            </select>
          </div>

          {/* Professional Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Profissional / Prestador</label>
            <select
              value={professionalFilter}
              onChange={(e) => setProfessionalFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="todos">Todos os Prestadores</option>
              {professionalsList.map(p => (
                <option key={p.uuid} value={p.uuid}>{p.nome}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Categoria de Serviço</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="todos">Todas as Categorias</option>
              {categoriesList.map(c => (
                <option key={c.id} value={c.id.toString()}>{c.nome}</option>
              ))}
            </select>
          </div>

          {/* Search Term */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Busca Rápida</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cliente, OS, Prestador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        
        {/* Card Total Chamados */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Volume de Ordens</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Briefcase size={20} />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900">{metrics.total}</div>
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 font-medium">
              <span className="text-emerald-600 font-semibold">{metrics.concluidos} concluídos</span>
              <span>•</span>
              <span className="text-blue-600 font-semibold">{metrics.emAndamento} ativos</span>
            </div>
          </div>
        </div>

        {/* Card Faturamento Total */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Faturamento Filtrado</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-emerald-600">
              R$ {metrics.faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-2 text-xs text-slate-500 font-medium">
              Ticket Médio: R$ {metrics.total > 0 ? (metrics.faturamentoTotal / metrics.total).toFixed(2) : '0.00'}
            </div>
          </div>
        </div>

        {/* Card Taxa de Conclusao */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Taxa de Conclusão</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900">{metrics.taxaConclusao}%</div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
              <div 
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(Number(metrics.taxaConclusao), 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card Tempo Medio */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Tempo Médio (TMR)</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Clock size={20} />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900">
              {metrics.tempoMedio !== 'N/D' ? `${metrics.tempoMedio}h` : 'N/D'}
            </div>
            <div className="mt-2 text-xs text-slate-500 font-medium">
              Lead time da criação à conclusão
            </div>
          </div>
        </div>

        {/* Card CSAT */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Satisfação (CSAT)</span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Star size={20} />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900 flex items-center gap-1.5">
              {metrics.mediaSatisfacao}
              <span className="text-amber-400 text-xl">★</span>
            </div>
            <div className="mt-2 text-xs text-slate-500 font-medium">
              Baseado em {metrics.countNotas} avaliações
            </div>
          </div>
        </div>

      </div>

      {/* NOVA SEÇÃO: Aquisição & Canais de Origem */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-600" />
            <h2 className="text-base font-bold text-slate-800">Aquisição & Canais de Entrada (Origem)</h2>
          </div>
          <span className="text-xs text-slate-500">Distribuição de chamados e conversão por origem</span>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {originMetrics.map(item => {
              const percentage = metrics.total > 0 ? ((item.total / metrics.total) * 100).toFixed(1) : '0';
              const taxaConv = item.total > 0 ? ((item.concluidos / item.total) * 100).toFixed(0) : '0';
              const ticketMedio = item.total > 0 ? (item.faturamento / item.total).toFixed(2) : '0.00';

              return (
                <div key={item.key} className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <span>{item.icon}</span> {item.label}
                    </span>
                    <span className="text-xs font-black text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {percentage}%
                    </span>
                  </div>

                  <div>
                    <div className="text-2xl font-black text-slate-900">{item.total} <span className="text-xs font-bold text-slate-400">pedidos</span></div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div 
                        className="bg-blue-600 h-1.5 rounded-full" 
                        style={{ width: `${Math.min(Number(percentage), 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-500">Faturamento:</span>
                    <span className="text-emerald-700 font-bold">R$ {item.faturamento.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                    <span>Taxa Conclusão: <strong className="text-slate-800">{taxaConv}%</strong></span>
                    <span>Ticket: <strong className="text-slate-800">R$ {ticketMedio}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desempenho por Prestador Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-blue-600" />
            <h2 className="text-base font-bold text-slate-800">Ranking & Produtividade por Prestador</h2>
          </div>
          <span className="text-xs text-slate-500">Total de {professionalPerformances.length} profissionais com atribuições</span>
        </div>

        {professionalPerformances.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Nenhum dado de prestador encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Prestador</th>
                  <th className="py-3.5 px-4 text-center">Atribuídos</th>
                  <th className="py-3.5 px-4 text-center">Concluídos</th>
                  <th className="py-3.5 px-4 text-center">Em Andamento</th>
                  <th className="py-3.5 px-4 text-center">Taxa Sucesso</th>
                  <th className="py-3.5 px-4 text-center">Avaliação Média</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {professionalPerformances.map((prof, idx) => {
                  const taxaSucesso = prof.totalAtribuidos > 0 
                    ? ((prof.concluidos / prof.totalAtribuidos) * 100).toFixed(0) 
                    : '0';

                  return (
                    <tr key={prof.uuid} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">
                            {idx + 1}
                          </div>
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
                            {prof.fotoperfil ? (
                              <img src={prof.fotoperfil} alt={prof.nome} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={14} /></div>
                            )}
                          </div>
                          <span className="font-bold text-slate-900">{prof.nome}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-700">{prof.totalAtribuidos}</td>
                      <td className="py-3.5 px-4 text-center font-bold text-emerald-600">{prof.concluidos}</td>
                      <td className="py-3.5 px-4 text-center text-blue-600">{prof.emAndamento}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800">
                          {taxaSucesso}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1 font-bold text-slate-800">
                          <Star size={12} className="text-amber-400 fill-amber-400" />
                          {prof.mediaAvaliacao}
                          <span className="text-[10px] text-slate-400 font-normal">({prof.totalAvaliacoes})</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tabela de Auditoria de Serviços */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-blue-600" />
            <h2 className="text-base font-bold text-slate-800">Auditoria & Rastreabilidade de Ordens de Serviço</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Clique em uma OS para ver a linha do tempo</span>
        </div>

        {filteredTickets.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Nenhum chamado encontrado com os critérios selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">OS / Código</th>
                  <th className="py-3.5 px-4">Origem</th>
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Categoria</th>
                  <th className="py-3.5 px-4">Prestador</th>
                  <th className="py-3.5 px-4">Abertura</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Avaliação</th>
                  <th className="py-3.5 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredTickets.map((t) => {
                  const origCfg = getOriginBadgeConfig(t.origem || t.clienteData?.origem);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 font-mono">#{t.chaveunica || t.id}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${origCfg.badgeBg}`}>
                          <span>{origCfg.icon}</span>
                          <span>{origCfg.label}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{t.clienteData?.nome || 'Não informado'}</div>
                        <div className="text-[10px] text-slate-400">{t.clienteData?.email || ''}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
                          {t.geral?.nome || 'Serviço Geral'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-800">
                          {t.profissionalData?.nome || <span className="text-slate-400 italic">Não atribuído</span>}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(t.status || '')}
                      </td>
                      <td className="py-3.5 px-4">
                        {t.avaliacao?.nota ? (
                          <div className="flex items-center gap-1 font-bold text-slate-800">
                            <Star size={12} className="text-amber-400 fill-amber-400" />
                            {t.avaliacao.nota}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setSelectedTicketForTimeline(t)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold text-xs transition-colors"
                        >
                          Linha do Tempo
                          <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Linha do Tempo / Rastreamento */}
      {selectedTicketForTimeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Auditoria & Rastreamento</span>
                <h3 className="text-lg font-bold text-slate-900">
                  Ordem de Serviço #{selectedTicketForTimeline.chaveunica || selectedTicketForTimeline.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTicketForTimeline(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Service Summary */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Cliente:</span>
                <span className="font-bold text-slate-800">{selectedTicketForTimeline.clienteData?.nome || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Profissional Responsável:</span>
                <span className="font-bold text-slate-800">{selectedTicketForTimeline.profissionalData?.nome || 'Pendente'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Categoria:</span>
                <span className="font-bold text-slate-800">{selectedTicketForTimeline.geral?.nome || 'Geral'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status Atual:</span>
                <div>{getStatusBadge(selectedTicketForTimeline.status || '')}</div>
              </div>
            </div>

            {/* Timeline Steps */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Etapas do Ciclo de Vida</h4>

              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                
                {/* 1. Criacao */}
                <div className="relative">
                  <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </div>
                  <p className="text-xs font-bold text-slate-900">1. Abertura do Chamado</p>
                  <p className="text-[11px] text-slate-500">
                    {selectedTicketForTimeline.created_at 
                      ? new Date(selectedTicketForTimeline.created_at).toLocaleString('pt-BR')
                      : 'Data não registrada'}
                  </p>
                </div>

                {/* 2. Planejamento / Orcamento */}
                <div className="relative">
                  <div className={`absolute -left-6 top-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    (selectedTicketForTimeline.planejamento?.length || selectedTicketForTimeline.orcamentos?.length) ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {(selectedTicketForTimeline.planejamento?.length || selectedTicketForTimeline.orcamentos?.length) ? '✓' : '2'}
                  </div>
                  <p className="text-xs font-bold text-slate-900">2. Planejamento & Orçamento</p>
                  {selectedTicketForTimeline.orcamentos && selectedTicketForTimeline.orcamentos.length > 0 ? (
                    <p className="text-[11px] text-slate-500">
                      Orçamento registrado: R$ {selectedTicketForTimeline.orcamentos[0].preco || 0} ({selectedTicketForTimeline.orcamentos[0].tipopagmto || 'A combinar'})
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">Aguardando elaboração do orçamento</p>
                  )}
                </div>

                {/* 3. Execucao / Agenda */}
                <div className="relative">
                  <div className={`absolute -left-6 top-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    selectedTicketForTimeline.agenda?.length ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {selectedTicketForTimeline.agenda?.length ? '✓' : '3'}
                  </div>
                  <p className="text-xs font-bold text-slate-900">3. Execução do Serviço</p>
                  {selectedTicketForTimeline.agenda && selectedTicketForTimeline.agenda.length > 0 ? (
                    <p className="text-[11px] text-slate-500">
                      Agendado para: {new Date(selectedTicketForTimeline.agenda[0].execucao).toLocaleString('pt-BR')}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">Serviço não agendado</p>
                  )}
                </div>

                {/* 4. Conclusao */}
                <div className="relative">
                  <div className={`absolute -left-6 top-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    ['concluido', 'aguardando_gestor'].includes((selectedTicketForTimeline.status || '').toLowerCase()) ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {['concluido', 'aguardando_gestor'].includes((selectedTicketForTimeline.status || '').toLowerCase()) ? '✓' : '4'}
                  </div>
                  <p className="text-xs font-bold text-slate-900">4. Conclusão da Ordem de Serviço</p>
                  {['concluido', 'aguardando_gestor'].includes((selectedTicketForTimeline.status || '').toLowerCase()) ? (
                    <p className="text-[11px] text-emerald-600 font-semibold">Serviço finalizado com sucesso</p>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">Em andamento</p>
                  )}
                </div>

                {/* 5. Avaliacao */}
                <div className="relative">
                  <div className={`absolute -left-6 top-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    selectedTicketForTimeline.avaliacao ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {selectedTicketForTimeline.avaliacao ? '★' : '5'}
                  </div>
                  <p className="text-xs font-bold text-slate-900">5. Feedback & Avaliação do Cliente</p>
                  {selectedTicketForTimeline.avaliacao ? (
                    <div className="mt-1 bg-purple-50 p-2.5 rounded-lg border border-purple-100 text-xs">
                      <div className="flex items-center gap-1 font-bold text-purple-900">
                        Nota: {selectedTicketForTimeline.avaliacao.nota} / 5.0 ⭐
                      </div>
                      {selectedTicketForTimeline.avaliacao.comentario && (
                        <p className="text-purple-700 italic mt-0.5">"{selectedTicketForTimeline.avaliacao.comentario}"</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">Aguardando avaliação do cliente</p>
                  )}
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setIsPrintModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-2 border border-blue-200 transition-colors shadow-xs"
              >
                <Printer size={14} /> Imprimir OS
              </button>

              <button
                onClick={() => setSelectedTicketForTimeline(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {selectedTicketForTimeline && (
        <PrintOsModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          osData={buildOsPrintData(selectedTicketForTimeline)}
        />
      )}

    </div>
  );
};

export default AdminRelatorios;
