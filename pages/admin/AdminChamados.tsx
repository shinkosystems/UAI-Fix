import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  Search, Filter, Eye, Clock, CheckCircle2, AlertTriangle, 
  RefreshCw, User, Calendar, MapPin, Tag, ChevronRight, X
} from 'lucide-react';
import { ChamadoExtended, getOriginBadgeConfig } from '../../types';
import ProfessionalOrderModal from '../../components/modals/ProfessionalOrderModal';

const AdminChamados: React.FC = () => {
  const [tickets, setTickets] = useState<ChamadoExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [selectedTicket, setSelectedTicket] = useState<ChamadoExtended | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('gestor');
  const [currentUserId, setCurrentUserId] = useState<string>('');

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
      chaves.forEach(c => {
        if (c.cliente) userUuids.add(c.cliente);
        if (c.profissional) userUuids.add(c.profissional);
        if (c.gestor_responsavel) userUuids.add(c.gestor_responsavel);
        if (c.atividade) serviceIds.add(c.atividade);
      });

      const [usersRes, servicesRes, orcRes, planRes, avalRes, agendaRes] = await Promise.all([
        userUuids.size > 0 ? supabase.from('users').select('*').in('uuid', Array.from(userUuids)) : { data: [] },
        serviceIds.size > 0 ? supabase.from('geral').select('*').in('id', Array.from(serviceIds)) : { data: [] },
        chaveIds.length > 0 ? supabase.from('orcamentos').select('*').in('chave', chaveIds).order('created_at', { ascending: false }) : { data: [] },
        chaveIds.length > 0 ? supabase.from('planejamento').select('*').in('chave', chaveIds).order('created_at', { ascending: false }) : { data: [] },
        chaveIds.length > 0 ? supabase.from('avaliacoes').select('*').in('chave', chaveIds) : { data: [] },
        chaveIds.length > 0 ? supabase.from('agenda').select('*').in('chave', chaveIds) : { data: [] }
      ]);

      const usersMap: Record<string, any> = {};
      usersRes.data?.forEach((u: any) => usersMap[u.uuid] = u);

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

      const enrichedTickets: ChamadoExtended[] = chaves.map(c => ({
        ...c,
        clienteData: usersMap[c.cliente],
        profissionalData: usersMap[c.profissional],
        gestorData: c.gestor_responsavel ? usersMap[c.gestor_responsavel] : undefined,
        geral: servicesMap[c.atividade],
        orcamentos: orcMap[c.id] || [],
        planejamento: planMap[c.id] || [],
        avaliacao: avalMap[c.id],
        agenda: agendaMap[c.id] || []
      }));

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

  const filteredTickets = tickets.filter(t => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = term === '' || 
      t.id?.toString().includes(term) ||
      t.chaveunica?.toLowerCase().includes(term) ||
      t.clienteData?.nome?.toLowerCase().includes(term) ||
      t.profissionalData?.nome?.toLowerCase().includes(term) ||
      t.geral?.nome?.toLowerCase().includes(term);
    
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
      matchesStatus = status === selectedStatus;
    }

    return matchesSearch && matchesStatus;
  });

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
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Gestão Central de Chamados</h1>
          <p className="text-xs text-slate-500 mt-1">Supervisão de todas as ordens de serviço solicitadas na plataforma</p>
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
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por Código Único, ID, Cliente ou Prestador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'solicitado', label: 'Solicitado' },
            { id: 'orcamento', label: 'Orçamento' },
            { id: 'execucao', label: 'Execução' },
            { id: 'concluido', label: 'Concluído' },
            { id: 'recusado', label: 'Recusado' }
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
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Carregando ordens de serviço...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
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
                    <td className="p-4 font-bold text-slate-900">{t.chaveunica ? `#${t.chaveunica}` : `#${t.id}`}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${originCfg.badgeBg}`}>
                        <span>{originCfg.icon}</span>
                        <span>{originCfg.label}</span>
                      </span>
                    </td>
                    <td className="p-4 text-slate-500">{t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR') : (t.data ? new Date(t.data).toLocaleDateString('pt-BR') : '-')}</td>
                    <td className="p-4">{getStatusBadge(t.status)}</td>
                    <td className="p-4 font-medium text-slate-700">{t.cidade || 'Uberlândia / MG'}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTicket(t);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold rounded-lg transition-all text-xs cursor-pointer"
                      >
                        <Eye size={14} /> Detalhes
                      </button>
                    </td>
                  </tr>
                );})
              )}
            </tbody>
          </table>
        </div>
      </div>

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

