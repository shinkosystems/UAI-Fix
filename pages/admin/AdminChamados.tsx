import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  Search, Filter, Eye, Clock, CheckCircle2, AlertTriangle, 
  RefreshCw, User, Calendar, MapPin, Tag, ChevronRight, X,
  Trash2, EyeOff, Loader2, Building2, Flame, ShieldAlert, Clock4
} from 'lucide-react';
import { ChamadoExtended, getOriginBadgeConfig, Organization } from '../../types';
import ProfessionalOrderModal from '../../components/modals/ProfessionalOrderModal';

const AdminChamados: React.FC = () => {
  const [tickets, setTickets] = useState<ChamadoExtended[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>(() => {
    return localStorage.getItem('active_tenant_filter') || 'todas';
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [selectedTicket, setSelectedTicket] = useState<ChamadoExtended | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('gestor');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [ticketToDelete, setTicketToDelete] = useState<ChamadoExtended | null>(null);
  const [deletingTicket, setDeletingTicket] = useState(false);

  const fetchUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: userData } = await supabase.from('users').select('tipo').eq('uuid', user.id).single();
        if (userData) {
          const normalizedRole = (userData.tipo || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          setCurrentUserRole(normalizedRole || 'gestor');
        }
      }
    } catch (err) {
      console.error('Erro ao buscar perfil de usuário:', err);
    }
  };

  const fetchChamados = async () => {
    try {
      setLoading(true);
      const { data: chaves, error } = await supabase
        .from('chaves')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      if (!chaves || chaves.length === 0) {
        setTickets([]);
        return;
      }

      const chaveIds = chaves.map(c => c.id);
      const userUuids = new Set<string>();
      const serviceIds = new Set<number>();
      const cityIds = new Set<number>();

      chaves.forEach(c => {
        if (c.cliente) userUuids.add(c.cliente);
        if (c.profissional) userUuids.add(c.profissional);
        if (c.gestor_responsavel) userUuids.add(c.gestor_responsavel);
        if (c.atividade) serviceIds.add(c.atividade);
        if (c.cidade) cityIds.add(Number(c.cidade));
      });

      const [usersRes, servicesRes, orcRes, planRes, avalRes, agendaRes, orgsRes] = await Promise.all([
        userUuids.size > 0 ? supabase.from('users').select('*').in('uuid', Array.from(userUuids)) : { data: [] },
        serviceIds.size > 0 ? supabase.from('geral').select('*').in('id', Array.from(serviceIds)) : { data: [] },
        chaveIds.length > 0 ? supabase.from('orcamentos').select('*').in('chave', chaveIds).order('created_at', { ascending: false }) : { data: [] },
        chaveIds.length > 0 ? supabase.from('planejamento').select('*').in('chave', chaveIds).order('created_at', { ascending: false }) : { data: [] },
        chaveIds.length > 0 ? supabase.from('avaliacoes').select('*').in('chave', chaveIds) : { data: [] },
        chaveIds.length > 0 ? supabase.from('agenda').select('*').in('chave', chaveIds) : { data: [] },
        supabase.from('organizations').select('*').order('nome', { ascending: true })
      ]);

      setOrganizations(orgsRes.data || []);
      const orgsMap: Record<string, Organization> = {};
      orgsRes.data?.forEach((o: any) => orgsMap[o.id] = o);

      const usersMap: Record<string, any> = {};
      usersRes.data?.forEach((u: any) => {
        usersMap[u.uuid] = u;
        if (u.cidade) cityIds.add(Number(u.cidade));
      });

      // Busca apenas as cidades referenciadas para evitar limite de 1000 linhas do Supabase
      const { data: citiesData } = cityIds.size > 0
        ? await supabase.from('cidades').select('id, cidade, uf, estados (id, uf)').in('id', Array.from(cityIds))
        : { data: [] };

      const citiesMap: Record<number, { id: number; cidade: string; uf: number; ufName?: string }> = {};
      citiesData?.forEach((ct: any) => {
        const ufName = (ct.estados as any)?.uf || '';
        citiesMap[ct.id] = {
          id: ct.id,
          cidade: ct.cidade,
          uf: ct.uf,
          ufName
        };
      });

      const servicesMap: Record<number, any> = {};
      servicesRes.data?.forEach((s: any) => servicesMap[s.id] = s);

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
      avalRes.data?.forEach((a: any) => avalMap[a.chave] = a);

      const agendaMap: Record<number, any[]> = {};
      agendaRes.data?.forEach((ag: any) => {
        if (!agendaMap[ag.chave]) agendaMap[ag.chave] = [];
        agendaMap[ag.chave].push(ag);
      });

      const extractMeta = (desc: string | undefined | null, marker: string) => {
        if (!desc || !desc.includes(marker)) return null;
        const parts = desc.split(marker);
        return parts.length > 1 ? (parts[1].split('\n')[0]?.trim() || null) : null;
      };

      const enrichedTickets: ChamadoExtended[] = chaves.map(c => {
        const cityObj = citiesMap[c.cidade];
        const clientCityId = usersMap[c.cliente]?.cidade;
        const resolvedCity = cityObj || (clientCityId ? citiesMap[clientCityId] : undefined);
        const planDesc = planMap[c.id]?.[0]?.descricao;
        const metaCity = extractMeta(planDesc, '[CIDADE]:');

        const cityDisplayName = resolvedCity 
          ? `${resolvedCity.cidade}${resolvedCity.ufName ? ` / ${resolvedCity.ufName}` : ''}`
          : (metaCity || (c.cidade ? `Cidade #${c.cidade}` : '-'));

        return {
          ...c,
          cidadeNome: cityDisplayName,
          cidade_data: resolvedCity,
          clienteData: usersMap[c.cliente],
          profissionalData: usersMap[c.profissional],
          gestorData: c.gestor_responsavel ? usersMap[c.gestor_responsavel] : undefined,
          geral: servicesMap[c.atividade],
          orcamentos: orcMap[c.id] || [],
          planejamento: planMap[c.id] || [],
          avaliacao: avalMap[c.id],
          agenda: agendaMap[c.id] || [],
          organization: c.organization_id ? orgsMap[c.organization_id] : undefined
        };
      });

      setTickets(enrichedTickets);
    } catch (err) {
      console.error('Erro ao buscar chamados no Admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserRole();
    fetchChamados();
  }, []);

  const isTicketOnlyInitialRequest = (t: ChamadoExtended) => {
    const hasProf = Boolean(t.profissional || t.profissionalData);
    const hasBudget = Boolean(
      t.orcamentos && 
      t.orcamentos.length > 0 && 
      ((t.orcamentos[0]?.preco || 0) > 0 || (t.orcamentos[0]?.custofixo || 0) > 0)
    );
    const s = (t.status || '').toLowerCase();
    const isInitialStatus = ['pendente', 'solicitado', 'novo', 'cancelado', 'recusado'].includes(s);
    return !hasProf && !hasBudget && isInitialStatus;
  };

  const handleDeleteTicket = async (ticket: ChamadoExtended) => {
    if (!ticket?.id) return;
    setDeletingTicket(true);
    try {
      await Promise.all([
        supabase.from('planejamento').delete().eq('chave', ticket.id),
        supabase.from('orcamentos').delete().eq('chave', ticket.id),
        supabase.from('avaliacoes').delete().eq('chave', ticket.id),
        supabase.from('agenda').delete().eq('chave', ticket.id)
      ]);
      const { error } = await supabase.from('chaves').delete().eq('id', ticket.id);
      if (error) throw error;
      setTicketToDelete(null);
      await fetchChamados();
    } catch (err: any) {
      console.error('Erro ao deletar chamado:', err);
      alert('Erro ao excluir chamado: ' + (err.message || err));
    } finally {
      setDeletingTicket(false);
    }
  };

  const handleToggleHideTicket = async (ticket: ChamadoExtended) => {
    if (!ticket?.id) return;
    const nextState = !ticket.oculto;
    try {
      const { error } = await supabase
        .from('chaves')
        .update({ oculto: nextState })
        .eq('id', ticket.id);
      if (error) throw error;
      await fetchChamados();
    } catch (err: any) {
      console.error('Erro ao alterar visibilidade:', err);
      alert('Erro ao alterar visibilidade: ' + (err.message || err));
    }
  };

  const hiddenCount = tickets.filter(t => t.oculto === true).length;

  const filteredTickets = tickets.filter(t => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = term === '' || 
      t.id?.toString().includes(term) ||
      t.chaveunica?.toLowerCase().includes(term) ||
      t.clienteData?.nome?.toLowerCase().includes(term) ||
      t.profissionalData?.nome?.toLowerCase().includes(term) ||
      t.geral?.nome?.toLowerCase().includes(term) ||
      t.cidadeNome?.toLowerCase().includes(term);
    
    const isHidden = t.oculto === true;

    // Se estiver na aba Ocultos, filtra somente os ocultos
    if (selectedStatus === 'ocultos') {
      return matchesSearch && isHidden;
    }

    // Nas outras abas, esconde chamados ocultos
    if (isHidden) return false;

    const status = (t.status || '').toLowerCase();
    let matchesStatus = true;

    if (selectedStatus === 'solicitado') {
      matchesStatus = ['pendente', 'solicitado', 'novo'].includes(status);
    } else if (selectedStatus === 'orcamento') {
      matchesStatus = ['analise', 'aguardando_profissional', 'aguardando_aprovacao', 'orcamento', 'planejamento'].includes(status);
    } else if (selectedStatus === 'execucao') {
      matchesStatus = ['aprovado', 'executando', 'execucao', 'agendado'].includes(status);
    } else if (selectedStatus === 'concluido') {
      matchesStatus = ['concluido', 'aguardando_gestor'].includes(status);
    } else if (selectedStatus === 'recusado') {
      matchesStatus = ['recusado', 'reprovado', 'cancelado'].includes(status);
    } else if (selectedStatus !== 'todos') {
    const matchesOrg = selectedOrgFilter === 'todas' || t.organization_id === selectedOrgFilter;

    return matchesSearch && matchesStatus && matchesOrg;
  });

  const getPriorityBadge = (prioridade?: string) => {
    const p = (prioridade || 'media').toLowerCase();
    switch (p) {
      case 'urgente':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-600 text-white shadow-xs animate-pulse">
            <Flame size={10} /> Urgente
          </span>
        );
      case 'alta':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
            Alta
          </span>
        );
      case 'media':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
            Média
          </span>
        );
      case 'baixa':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium uppercase bg-slate-100 text-slate-600">
            Baixa
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium uppercase bg-slate-100 text-slate-600">
            {prioridade}
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'concluido':
      case 'aguardando_gestor':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Concluído</span>;
      case 'executando':
      case 'aprovado':
      case 'agendado':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">Em Execução</span>;
      case 'analise':
      case 'aguardando_profissional':
      case 'aguardando_aprovacao':
      case 'orcamento':
      case 'planejamento':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">Orçamento</span>;
      case 'recusado':
      case 'reprovado':
      case 'cancelado':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">Recusado</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">{status || 'Pendente'}</span>;
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            Gestão Central de Chamados & Tarefas
            <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold border border-amber-300/60">
              Multi-Tenant
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Supervisão e roteamento de todas as ordens de serviço por empresa parceira</p>
        </div>
        <button
          onClick={fetchChamados}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar Dados
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row gap-4 justify-between items-center">
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por Código, ID, Cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>

          {/* Organization Filter */}
          <div className="w-full sm:w-56">
            <select
              value={selectedOrgFilter}
              onChange={(e) => {
                setSelectedOrgFilter(e.target.value);
                if (e.target.value === 'todas') {
                  localStorage.removeItem('active_tenant_filter');
                } else {
                  localStorage.setItem('active_tenant_filter', e.target.value);
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="todas">🏢 Todas as Empresas</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>
                  {org.nome} ({org.slug})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'solicitado', label: 'Solicitado' },
            { id: 'orcamento', label: 'Orçamento' },
            { id: 'execucao', label: 'Execução' },
            { id: 'concluido', label: 'Concluído' },
            { id: 'recusado', label: 'Recusado' },
            { id: 'ocultos', label: `Ocultos ${hiddenCount > 0 ? `(${hiddenCount})` : ''}` }
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedStatus(st.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedStatus === st.id 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold text-xs border-b border-slate-200">
                <th className="p-4">Código Único</th>
                <th className="p-4">Empresa / Prioridade</th>
                <th className="p-4">Origem</th>
                <th className="p-4">Data</th>
                <th className="p-4">Status</th>
                <th className="p-4">Cidade / Local</th>
                <th className="p-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Carregando ordens de serviço...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Nenhum chamado encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t) => {
                  const originCfg = getOriginBadgeConfig(t.origem || t.clienteData?.origem);
                  return (
                  <tr 
                    key={t.id} 
                    onClick={() => setSelectedTicket(t)} 
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <td className="p-4 font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{t.chaveunica ? `#${t.chaveunica}` : `#${t.id}`}</span>
                      {t.oculto && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          Oculto
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-800 truncate max-w-[150px]">
                          <Building2 size={12} className="text-amber-600 flex-shrink-0" />
                          <span className="truncate">{t.organization?.nome || 'UAI Fix Matriz'}</span>
                        </div>
                        <div>
                          {getPriorityBadge(t.prioridade)}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${originCfg.badgeBg}`}>
                        <span>{originCfg.icon}</span>
                        <span>{originCfg.label}</span>
                      </span>
                    </td>
                    <td className="p-4 text-slate-500">{t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR') : (t.data ? new Date(t.data).toLocaleDateString('pt-BR') : '-')}</td>
                    <td className="p-4">{getStatusBadge(t.status)}</td>
                    <td className="p-4 font-medium text-slate-700">{t.cidadeNome || '-'}</td>
                    <td className="p-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedTicket(t)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold rounded-lg transition-all text-xs cursor-pointer"
                        >
                          <Eye size={14} /> Detalhes
                        </button>

                        {isTicketOnlyInitialRequest(t) ? (
                          <button
                            onClick={() => setTicketToDelete(t)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all text-xs cursor-pointer"
                            title="Excluir Pedido Inicial"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleHideTicket(t)}
                            className={`p-1.5 rounded-lg transition-all text-xs cursor-pointer ${
                              t.oculto
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-700'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
                            }`}
                            title={t.oculto ? "Restaurar Chamado" : "Ocultar Chamado"}
                          >
                            {t.oculto ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );})
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Confirm Delete */}
      {ticketToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-red-600 font-bold">
                <Trash2 size={20} />
                <h3 className="text-lg font-black text-slate-900">Excluir Pedido Inicial</h3>
              </div>
              <button 
                onClick={() => setTicketToDelete(null)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-red-50 p-4 rounded-2xl space-y-2 border border-red-100">
              <p className="text-xs font-bold text-red-800 leading-relaxed">
                Tem certeza que deseja excluir o pedido <span className="font-mono font-black">#{ticketToDelete.chaveunica || ticketToDelete.id}</span>?
              </p>
              <p className="text-[11px] text-red-600">
                Este item é apenas uma solicitação inicial do cliente e será removido permanentemente.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setTicketToDelete(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteTicket(ticketToDelete)}
                disabled={deletingTicket}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-red-200 cursor-pointer"
              >
                {deletingTicket ? <Loader2 className="animate-spin" size={16} /> : <><Trash2 size={16} /><span>Confirmar Exclusão</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Quick View */}
      {selectedTicket && (
        <ProfessionalOrderModal
          order={selectedTicket}
          isOpen={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdate={fetchChamados}
          userRole={currentUserRole || 'gestor'}
          userUuid={currentUserId}
        />
      )}

    </div>
  );
};

export default AdminChamados;

