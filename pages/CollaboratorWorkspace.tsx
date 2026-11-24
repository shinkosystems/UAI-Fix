import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import {
  Agenda,
  Avaliacao,
  ChamadoExtended,
  Geral,
  Orcamento,
  Organization,
  Planejamento,
  User
} from '../types';
import {
  Activity,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Columns,
  Hash,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  User as UserIcon
} from 'lucide-react';
import ProfessionalOrderModal from '../components/modals/ProfessionalOrderModal';

type ViewMode = 'board' | 'routine';

const CollaboratorWorkspace: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyMyTasks, setOnlyMyTasks] = useState(true);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [tickets, setTickets] = useState<ChamadoExtended[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ChamadoExtended | null>(null);

  const normRole = useMemo(() => {
    return (currentUser?.tipo || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }, [currentUser?.tipo]);

  const isCollaboratorRole = normRole === 'profissional' || normRole === 'colaborador';
  const isSuperAdmin = Boolean(
    currentUser?.is_super_admin ||
      (currentUser?.email || '').toLowerCase().trim() === 'peboorba@gmail.com'
  );

  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const {
        data: { user: authUser }
      } = await supabase.auth.getUser();
      if (!authUser) {
        setTickets([]);
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('uuid', authUser.id)
        .maybeSingle();

      if (!userData) {
        setTickets([]);
        return;
      }
      setCurrentUser(userData as User);

      const userOrgId: string | null = userData.organization_id || null;
      const userIsSuper = Boolean(
        userData.is_super_admin ||
          (authUser.email || '').toLowerCase().trim() === 'peboorba@gmail.com'
      );

      if (userOrgId) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', userOrgId)
          .maybeSingle();
        setOrganization((orgData as Organization) || null);
      } else {
        setOrganization(null);
      }

      // Isolamento estrito por organização (Multi-Tenant [UAIFIX-FE-05])
      let chavesQuery = supabase
        .from('chaves')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!userIsSuper && userOrgId) {
        chavesQuery = chavesQuery.eq('organization_id', userOrgId);
      }

      const roleNorm = (userData.tipo || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      // Profissionais/colaboradores sem org enxergam apenas os seus próprios chamados
      if (!userIsSuper && !userOrgId && (roleNorm === 'profissional' || roleNorm === 'colaborador')) {
        chavesQuery = chavesQuery.eq('profissional', authUser.id);
      }

      const { data: chavesData, error: chavesError } = await chavesQuery;
      if (chavesError) throw chavesError;
      if (!chavesData?.length) {
        setTickets([]);
        return;
      }

      const chaveIds = chavesData.map((c: any) => c.id);
      const userUuids = new Set<string>();
      const serviceIds = new Set<number>();
      chavesData.forEach((c: any) => {
        if (c.cliente) userUuids.add(c.cliente);
        if (c.profissional) userUuids.add(c.profissional);
        if (c.gestor_responsavel) userUuids.add(c.gestor_responsavel);
        if (c.atividade) serviceIds.add(c.atividade);
      });

      const [usersRes, servicesRes, orcRes, planRes, avalRes, agendaRes] = await Promise.all([
        userUuids.size > 0
          ? supabase.from('users').select('*').in('uuid', Array.from(userUuids))
          : Promise.resolve({ data: [] }),
        serviceIds.size > 0
          ? supabase.from('geral').select('*').in('id', Array.from(serviceIds))
          : Promise.resolve({ data: [] }),
        supabase
          .from('orcamentos')
          .select('*')
          .in('chave', chaveIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('planejamento')
          .select('*')
          .in('chave', chaveIds)
          .order('created_at', { ascending: false }),
        supabase.from('avaliacoes').select('*').in('chave', chaveIds),
        supabase.from('agenda').select('*').in('chave', chaveIds)
      ]);

      const usersMap: Record<string, User> = {};
      (usersRes.data || []).forEach((u: any) => {
        usersMap[u.uuid] = u;
      });
      const servicesMap: Record<number, Geral> = {};
      (servicesRes.data || []).forEach((s: any) => {
        servicesMap[s.id] = s;
      });
      const orcMap: Record<number, Orcamento[]> = {};
      (orcRes.data || []).forEach((o: any) => {
        const key = Number(o.chave);
        if (!orcMap[key]) orcMap[key] = [];
        orcMap[key].push(o);
      });
      const planMap: Record<number, Planejamento[]> = {};
      (planRes.data || []).forEach((p: any) => {
        const key = Number(p.chave);
        if (!planMap[key]) planMap[key] = [];
        planMap[key].push(p);
      });
      const avalMap: Record<number, Avaliacao> = {};
      const avalPlatMap: Record<number, Avaliacao> = {};
      (avalRes.data || []).forEach((a: any) => {
        if (a.tipo_alvo === 'plataforma_uaifix') avalPlatMap[a.chave] = a;
        else avalMap[a.chave] = a;
      });
      const agendaMap: Record<number, Agenda[]> = {};
      (agendaRes.data || []).forEach((ag: any) => {
        if (!agendaMap[ag.chave]) agendaMap[ag.chave] = [];
        agendaMap[ag.chave].push(ag);
      });

      const mapped: ChamadoExtended[] = chavesData.map((c: any) => ({
        ...c,
        clienteData: usersMap[c.cliente],
        profissionalData: usersMap[c.profissional],
        gestorData: c.gestor_responsavel ? usersMap[c.gestor_responsavel] : undefined,
        geral: servicesMap[c.atividade],
        orcamentos: orcMap[c.id] || [],
        planejamento: planMap[c.id] || [],
        avaliacao: avalMap[c.id],
        avaliacaoPlataforma: avalPlatMap[c.id],
        agenda: agendaMap[c.id] || []
      }));

      setTickets(mapped);
    } catch (err) {
      console.error('[UAIFIX-FE-05] Erro ao carregar Workspace do Colaborador:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, []);

  const scopedTickets = useMemo(() => {
    let list = tickets;
    if (isCollaboratorRole && onlyMyTasks && currentUser?.uuid) {
      list = list.filter((t) => t.profissional === currentUser.uuid);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (t) =>
          (t.chaveunica || '').toLowerCase().includes(q) ||
          (t.geral?.nome || '').toLowerCase().includes(q) ||
          (t.clienteData?.nome || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [tickets, isCollaboratorRole, onlyMyTasks, currentUser?.uuid, searchTerm]);

  const columns = useMemo(() => {
    const pendentes = scopedTickets.filter((t) =>
      ['pendente', 'analise', 'orcamento_enviado', 'aguardando_profissional', 'aguardando_aprovacao'].includes(
        (t.status || '').toLowerCase()
      )
    );
    const execucao = scopedTickets.filter((t) =>
      ['agendado', 'em_execucao', 'execucao', 'aprovado'].includes((t.status || '').toLowerCase())
    );
    const concluidos = scopedTickets.filter((t) =>
      ['concluido', 'aguardando_gestor', 'finalizado'].includes((t.status || '').toLowerCase())
    );
    return { pendentes, execucao, concluidos };
  }, [scopedTickets]);

  const routineItems = useMemo(() => {
    const withDates = scopedTickets
      .map((t) => {
        const ag = t.agenda?.[0]?.execucao;
        const pl = t.planejamento?.[0]?.execucao;
        const iso = ag || pl || t.created_at;
        return { ticket: t, dateIso: iso, dateObj: iso ? new Date(iso) : null };
      })
      .filter((x) => x.dateObj && !isNaN(x.dateObj.getTime()))
      .sort((a, b) => (a.dateObj!.getTime() - b.dateObj!.getTime()));
    return withDates;
  }, [scopedTickets]);

  const todayCount = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return routineItems.filter((r) => r.dateIso && String(r.dateIso).slice(0, 10) === todayStr).length;
  }, [routineItems]);

  const renderCard = (t: ChamadoExtended) => {
    const agDate = t.agenda?.[0]?.execucao || t.planejamento?.[0]?.execucao;
    const formattedDate = agDate
      ? new Date(agDate).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'Sem agenda definida';

    return (
      <button
        key={t.id}
        type="button"
        onClick={() => setSelectedOrder(t)}
        className="w-full text-left bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs hover:border-amber-400 hover:shadow-md transition-all space-y-2.5 group"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
            <Hash size={11} />
            {t.chaveunica}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/70">
            {t.status}
          </span>
        </div>

        <h4 className="text-sm font-bold text-gray-900 group-hover:text-amber-600 transition-colors line-clamp-2">
          {t.geral?.nome || 'Serviço de Manutenção'}
        </h4>

        <div className="space-y-1 text-xs text-gray-500">
          <div className="flex items-center gap-1.5 truncate">
            <UserIcon size={13} className="text-gray-400 shrink-0" />
            <span className="truncate">{t.clienteData?.nome || 'Cliente'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={13} className="text-gray-400 shrink-0" />
            <span>{formattedDate}</span>
          </div>
          {t.clienteData?.bairro && (
            <div className="flex items-center gap-1.5 truncate">
              <MapPin size={13} className="text-gray-400 shrink-0" />
              <span className="truncate">{t.clienteData.bairro}</span>
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-full bg-[#F5F5F7] p-4 sm:p-6 lg:p-8 pb-24 space-y-6">
      {/* Header Institucional do Workspace */}
      <div className="bg-white rounded-3xl border border-gray-200/80 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/70 flex items-center justify-center shrink-0 overflow-hidden">
            {organization?.logo_url ? (
              <img src={organization.logo_url} alt={organization.nome} className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-6 h-6 text-amber-600" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Workspace do Colaborador
              </h1>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                <ShieldCheck size={12} />
                {organization ? organization.nome : isSuperAdmin ? 'Visão Matriz (Master)' : 'Ambiente Isolado'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {currentUser?.nome || 'Colaborador'}
              {currentUser?.cargo ? ` · ${currentUser.cargo}` : ''}
              {currentUser?.departamento ? ` · ${currentUser.departamento}` : ''}
              {' · Quadro de tarefas e rotina operacional segregado por organização.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex bg-[#F2F2F7] p-1 rounded-xl border border-gray-200/70">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'board' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Columns size={14} />
              Quadro
            </button>
            <button
              type="button"
              onClick={() => setViewMode('routine')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'routine' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Calendar size={14} />
              Rotina
            </button>
          </div>

          <button
            type="button"
            onClick={loadWorkspace}
            className="px-3 py-2 rounded-xl bg-white border border-gray-200 hover:border-amber-400 text-xs font-semibold text-gray-700 flex items-center gap-1.5 transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* KPIs Reais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4">
          <div className="text-xs font-semibold text-gray-500">Pendentes / Triagem</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{columns.pendentes.length}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4">
          <div className="text-xs font-semibold text-gray-500">Em Execução / Agendadas</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{columns.execucao.length}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4">
          <div className="text-xs font-semibold text-gray-500">Concluídas</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{columns.concluidos.length}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4">
          <div className="text-xs font-semibold text-gray-500">Rotina de Hoje</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{todayCount}</div>
        </div>
      </div>

      {/* Barra de Busca e Escopo */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por chave da OS, serviço ou cliente..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#F5F5F7] text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:bg-white transition-all"
          />
        </div>
        {isCollaboratorRole && (
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F5F5F7] text-xs font-semibold text-gray-700 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={onlyMyTasks}
              onChange={(e) => setOnlyMyTasks(e.target.checked)}
              className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            Apenas minhas tarefas atribuídas
          </label>
        )}
      </div>

      {/* Conteúdo Principal */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-gray-200/80 p-16 flex flex-col items-center justify-center text-gray-400">
          <Loader2 className="w-7 h-7 animate-spin text-amber-500 mb-3" />
          <span className="text-xs font-medium">Carregando quadro operacional da organização...</span>
        </div>
      ) : viewMode === 'board' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* Coluna 1: Pendentes */}
          <div className="bg-white/70 rounded-3xl border border-gray-200/80 p-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-amber-600" />
                <h3 className="text-sm font-bold text-gray-900">Pendentes</h3>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                {columns.pendentes.length}
              </span>
            </div>
            <div className="space-y-3">
              {columns.pendentes.length ? (
                columns.pendentes.map(renderCard)
              ) : (
                <div className="p-6 text-center text-xs text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                  Nenhuma tarefa pendente nesta organização.
                </div>
              )}
            </div>
          </div>

          {/* Coluna 2: Em Execução */}
          <div className="bg-white/70 rounded-3xl border border-gray-200/80 p-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-amber-600" />
                <h3 className="text-sm font-bold text-gray-900">Em Execução & Agendadas</h3>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                {columns.execucao.length}
              </span>
            </div>
            <div className="space-y-3">
              {columns.execucao.length ? (
                columns.execucao.map(renderCard)
              ) : (
                <div className="p-6 text-center text-xs text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                  Nenhuma OS em execução no momento.
                </div>
              )}
            </div>
          </div>

          {/* Coluna 3: Concluídas */}
          <div className="bg-white/70 rounded-3xl border border-gray-200/80 p-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-gray-700" />
                <h3 className="text-sm font-bold text-gray-900">Concluídas</h3>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {columns.concluidos.length}
              </span>
            </div>
            <div className="space-y-3">
              {columns.concluidos.length ? (
                columns.concluidos.slice(0, 20).map(renderCard)
              ) : (
                <div className="p-6 text-center text-xs text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                  Nenhuma OS concluída registrada.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Visão Rotina Cronológica */
        <div className="bg-white rounded-3xl border border-gray-200/80 p-5 space-y-3">
          <h3 className="text-sm font-bold text-gray-900">Agenda & Rotina Operacional</h3>
          {routineItems.length ? (
            <div className="divide-y divide-gray-100">
              {routineItems.map(({ ticket, dateObj }) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelectedOrder(ticket)}
                  className="w-full py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left hover:bg-amber-50/40 px-3 rounded-xl transition-all"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-700">
                        {dateObj?.toLocaleDateString('pt-BR')} ·{' '}
                        {dateObj?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[11px] font-semibold text-gray-500">#{ticket.chaveunica}</span>
                    </div>
                    <div className="text-sm font-bold text-gray-900 truncate mt-0.5">
                      {ticket.geral?.nome || 'Serviço'}
                    </div>
                    <div className="text-xs text-gray-500">
                      Cliente: {ticket.clienteData?.nome || 'Não informado'}
                      {ticket.profissionalData?.nome ? ` · Técnico: ${ticket.profissionalData.nome}` : ''}
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shrink-0 self-start sm:self-center">
                    {ticket.status}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-gray-400">
              Nenhuma atividade agendada na rotina desta organização.
            </div>
          )}
        </div>
      )}

      {/* Modal Real de Execução / Detalhes da OS */}
      {selectedOrder && currentUser && (
        <ProfessionalOrderModal
          order={selectedOrder}
          isOpen={Boolean(selectedOrder)}
          onClose={() => setSelectedOrder(null)}
          onUpdate={async () => {
            await loadWorkspace();
          }}
          userRole={normRole || 'profissional'}
          userUuid={currentUser.uuid}
        />
      )}
    </div>
  );
};

export default CollaboratorWorkspace;
