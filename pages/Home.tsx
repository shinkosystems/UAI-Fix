import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Geral } from '../types';
import StoryCircle from '../components/StoryCircle';
import { Bell, ChevronRight, TrendingUp, CalendarCheck, Clock, Star, Trophy, Briefcase, Calendar, AlertTriangle, X, User, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ServiceItem {
  id: number;
  title: string;
  date: string;
  status: string;
  color: string;
  timestamp: string;
}

interface TopProfessional {
  uuid: string;
  nome: string;
  fotoperfil: string;
  serviceCount: number;
  rating: number;
  weightedRating: number;
  rankingScore: number; // Nova propriedade para o ranking final
}

interface NextAppointment {
  id: number;
  serviceName: string;
  date: Date;
  proName: string;
  proPhoto: string;
}

interface NotificationItem {
  id: number;
  title: string;
  description: string;
  date: string;
  type: 'agenda' | 'planning' | 'approval';
  read: boolean;
}

type TimeFilter = 'day' | 'week' | 'month' | 'all';

const Home: React.FC = () => {
  const [categories, setCategories] = useState<Geral[]>([]);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState<string>('');
  const [userName, setUserName] = useState<string>('Usuário');
  const [currentUserUuid, setCurrentUserUuid] = useState<string | null>(null);
  const navigate = useNavigate();

  // Stats State - Alterado de 'month' para 'all' conforme solicitação
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [agendamentosCount, setAgendamentosCount] = useState(0);
  const [servicosAtivosCount, setServicosAtivosCount] = useState(0);
  const [mediaGeral, setMediaGeral] = useState(0);

  const [recentServices, setRecentServices] = useState<ServiceItem[]>([]);
  const [topProfessionals, setTopProfessionals] = useState<TopProfessional[]>([]);
  const [nextAppointment, setNextAppointment] = useState<NextAppointment | null>(null);

  const [pendingApprovalId, setPendingApprovalId] = useState<number | null>(null);
  const [pendingProfessionalId, setPendingProfessionalId] = useState<number | null>(null);
  const [pendingRatingId, setPendingRatingId] = useState<number | null>(null);
  const [pendingRatingServiceName, setPendingRatingServiceName] = useState<string>('');

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();

    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [timeFilter]);

  const getTimeRange = (filter: TimeFilter) => {
    if (filter === 'all') return null;

    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    if (filter === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (filter === 'week') {
      const day = now.getDay();
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (filter === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    return { start: start.toISOString(), end: end.toISOString() };
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      let userUuid = authUser?.id;

      if (!userUuid) {
        const { data: demoUsers } = await supabase.from('users').select('uuid').eq('ativo', true).limit(1);
        if (demoUsers && demoUsers.length > 0) userUuid = demoUsers[0].uuid;
      }

      if (userUuid) {
        setCurrentUserUuid(userUuid);
        const { data: userData } = await supabase.from('users').select('*').eq('uuid', userUuid).maybeSingle();

        if (userData) {
          const tipoRaw = userData.tipo || '';
          const normType = tipoRaw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          setUserType(tipoRaw);

          if (userData.nome && userData.nome !== 'Insere') {
            setUserName(userData.nome.split(' ')[0]);
          }

          const range = getTimeRange(timeFilter);
          const isStaff = ['gestor', 'planejista', 'orcamentista'].includes(normType);

          // 1. REGRA AGENDAMENTOS
          let agQuery = supabase.from('chaves').select('*', { count: 'exact', head: true });
          if (range) agQuery = agQuery.gte('created_at', range.start).lte('created_at', range.end);
          if (normType === 'profissional') agQuery = agQuery.eq('profissional', userUuid);
          else if (normType === 'consumidor') agQuery = agQuery.eq('cliente', userUuid);
          const { count: agCount } = await agQuery;
          setAgendamentosCount(agCount || 0);

          // 2. REGRA SERVIÇOS ATIVOS
          let activeQuery = supabase.from('chaves').select('*', { count: 'exact', head: true }).not('status', 'in', '("concluido","cancelado")');
          if (range) activeQuery = activeQuery.gte('created_at', range.start).lte('created_at', range.end);
          if (normType === 'profissional') activeQuery = activeQuery.eq('profissional', userUuid);
          else if (normType === 'consumidor') activeQuery = activeQuery.eq('cliente', userUuid);
          const { count: activeCount } = await activeQuery;
          setServicosAtivosCount(activeCount || 0);

          // 3. REGRA MÉDIA (Personalizada por Tipo)
          const calculateMediaGeral = async () => {
            const m = 5; // Constante bayesiana

            if (normType === 'profissional') {
              // Média Bayesiana para o próprio profissional
              const { data: proRats } = await supabase.from('avaliacoes').select('nota').eq('profissional', userUuid);
              const { data: allRats } = await supabase.from('avaliacoes').select('nota');

              const v = proRats?.length || 0;
              const R = v > 0 ? proRats!.reduce((a, b) => a + (b.nota || 0), 0) / v : 0;
              const C = allRats && allRats.length > 0 ? allRats.reduce((a, b) => a + (b.nota || 0), 0) / allRats.length : 0;

              const weightedRating = (v / (v + m)) * R + (m / (v + m)) * C;
              setMediaGeral(weightedRating);
            }
            else if (normType === 'consumidor') {
              // Média simples das notas dadas pelo consumidor
              let query = supabase.from('avaliacoes').select('nota').eq('cliente', userUuid);
              if (range) query = query.gte('created_at', range.start).lte('created_at', range.end);

              const { data: consumerRats } = await query;
              if (consumerRats && consumerRats.length > 0) {
                const sum = consumerRats.reduce((a, b) => a + (b.nota || 0), 0);
                setMediaGeral(sum / consumerRats.length);
              } else {
                setMediaGeral(0);
              }
            }
            else if (isStaff) {
              // Média simples de todos os profissionais da plataforma
              let query = supabase.from('avaliacoes').select('nota');
              if (range) query = query.gte('created_at', range.start).lte('created_at', range.end);

              const { data: allRats } = await query;
              if (allRats && allRats.length > 0) {
                const sum = allRats.reduce((a, b) => a + (b.nota || 0), 0);
                setMediaGeral(sum / allRats.length);
              } else {
                setMediaGeral(0);
              }
            }
          };

          await calculateMediaGeral();

          // Auxiliares
          const nowISO = new Date().toISOString();
          let nextAgendaQuery = supabase.from('agenda').select(`id, execucao, chaves (geral (nome), profissional (nome, fotoperfil), clienteData:users!cliente (nome, fotoperfil))`).gt('execucao', nowISO).is('dataconclusao', null).order('execucao', { ascending: true }).limit(1);
          if (normType === 'profissional') nextAgendaQuery = nextAgendaQuery.eq('profissional', userUuid);
          else if (normType === 'consumidor') nextAgendaQuery = nextAgendaQuery.eq('cliente', userUuid);
          const { data: nextData } = await nextAgendaQuery;
          if (nextData?.[0]) {
            const item = nextData[0];
            const key: any = item.chaves;
            setNextAppointment({
              id: item.id,
              serviceName: key?.geral?.nome || 'Serviço Agendado',
              date: new Date(item.execucao),
              proName: (normType === 'profissional' || isStaff) ? (key?.clienteData?.nome || 'Cliente') : (key?.profissional?.nome || 'Profissional'),
              proPhoto: (normType === 'profissional' || isStaff) ? (key?.clienteData?.fotoperfil || '') : (key?.profissional?.fotoperfil || '')
            });
          }

          let recentQuery = supabase.from('agenda').select(`id, execucao, dataconclusao, chaves (status, geral (nome))`).order('execucao', { ascending: false }).limit(6);
          if (normType === 'profissional') recentQuery = recentQuery.eq('profissional', userUuid);
          else if (normType === 'consumidor') recentQuery = recentQuery.eq('cliente', userUuid);
          const { data: recentData } = await recentQuery;
          if (recentData) {
            setRecentServices(recentData.map((item: any) => {
              const dateObj = new Date(item.execucao);
              const isConcluido = !!item.dataconclusao;
              let statusLabel = 'Agendado', statusColor = 'bg-blue-100 text-blue-700';
              if (isConcluido) { statusLabel = 'Concluído'; statusColor = 'bg-gray-100 text-gray-900'; }
              else if (dateObj < new Date()) { statusLabel = 'Pendente'; statusColor = 'bg-red-100 text-red-900'; }
              return { id: item.id, title: item.chaves?.geral?.nome || 'Serviço', date: dateObj.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), status: statusLabel, color: statusColor, timestamp: item.execucao };
            }));
          }
          fetchNotifications(tipoRaw, userUuid).catch(console.error);
          checkPendingApprovals(userUuid).catch(console.error);
          if (normType === 'profissional') {
            checkPendingProfessionalTasks(userUuid).catch(console.error);
          }
          checkPendingRatings(userUuid).catch(console.error);
        }
      }

      // 4. CATEGORIAS
      const { data: catData } = await supabase.from('geral').select('*').eq('primaria', true).eq('ativa', true).order('id', { ascending: true });
      setCategories(catData || []);

      // 5. PROFISSIONAIS ELITE
      const { data: topProsData } = await supabase.from('users').select('uuid, nome, fotoperfil').ilike('tipo', 'profissional').eq('ativo', true).limit(100);

      if (topProsData && topProsData.length > 0) {
        const proIds = topProsData.map(p => p.uuid);
        const [{ data: ags }, { data: rats }, { data: allEvaluations }] = await Promise.all([
          supabase.from('agenda').select('profissional').in('profissional', proIds),
          supabase.from('avaliacoes').select('profissional, nota').in('profissional', proIds),
          supabase.from('avaliacoes').select('nota')
        ]);

        const totalEvaluationsCount = allEvaluations?.length || 0;
        const globalMeanC = totalEvaluationsCount > 0
          ? allEvaluations!.reduce((acc, curr) => acc + (curr.nota || 0), 0) / totalEvaluationsCount
          : 0;

        const m = 5;

        const stats = topProsData.map(p => {
          const count = ags?.filter(a => a.profissional === p.uuid).length || 0;
          const pRats = rats?.filter(r => r.profissional === p.uuid) || [];
          const v = pRats.length;
          const R = v > 0 ? pRats.reduce((a, b) => a + b.nota, 0) / v : 0;
          // Se não tem avaliações, WR é 0 para não superar quem já tem histórico.
          const weightedRating = v > 0 ? (v / (v + m)) * R + (m / (v + m)) * globalMeanC : 0;

          // Score Elite: Peso da nota + Bônus de Volume (0.1 por atendimento)
          const rankingScore = weightedRating + (count * 0.1);

          return {
            uuid: p.uuid,
            nome: p.nome,
            fotoperfil: p.fotoperfil,
            serviceCount: count,
            rating: R,
            weightedRating: weightedRating,
            rankingScore: rankingScore
          };
        });

        // Ordenar pelo Score Elite (limite de 6 profissionais)
        setTopProfessionals(stats.sort((a, b) => {
          if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
          return b.serviceCount - a.serviceCount;
        }).slice(0, 6));
      }
    } catch (error) { console.error("Home Fetch Error:", error); } finally { setLoading(false); }
  };

  const checkPendingApprovals = async (uuid: string) => {
    const { data } = await supabase.from('chaves').select('id').eq('cliente', uuid).eq('status', 'aguardando_aprovacao').limit(1).maybeSingle();
    if (data) setPendingApprovalId(data.id);
  };

  const checkPendingProfessionalTasks = async (uuid: string) => {
    const { data } = await supabase
      .from('chaves')
      .select('id')
      .eq('profissional', uuid)
      .eq('status', 'aguardando_profissional')
      .limit(1)
      .maybeSingle();

    if (data) setPendingProfessionalId(data.id);
    else setPendingProfessionalId(null);
  };

  const checkPendingRatings = async (uuid: string) => {
    // Busca chamados concluídos do cliente
    const { data: concludedOrders } = await supabase
      .from('chaves')
      .select('id, geral(nome)')
      .eq('cliente', uuid)
      .eq('status', 'concluido');

    if (concludedOrders && concludedOrders.length > 0) {
      const orderIds = concludedOrders.map(o => o.id);
      // Verifica quais já possuem avaliação
      const { data: evaluations } = await supabase
        .from('avaliacoes')
        .select('chave')
        .in('chave', orderIds);

      const evaluatedIds = evaluations?.map(e => e.chave) || [];
      // Encontra o primeiro que NÃO está na lista de avaliados
      const pending = concludedOrders.find(o => !evaluatedIds.includes(o.id));

      if (pending) {
        setPendingRatingId(pending.id);
        setPendingRatingServiceName((pending.geral as any)?.nome || 'Serviço');
      } else {
        setPendingRatingId(null);
      }
    }
  };

  const fetchNotifications = async (role: string, uuid: string) => {
    const normRole = role.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let notifs: NotificationItem[] = [];
    try {
      if (['planejista', 'orcamentista', 'gestor'].includes(normRole)) {
        const { data } = await supabase.from('chaves').select(`id, created_at, status, geral (nome)`).in('status', ['pendente', 'analise']).order('created_at', { ascending: false }).limit(5);
        if (data) notifs = data.map((i: any) => ({ id: i.id, title: 'Chamado Pendente', description: i.geral?.nome || 'Novo chamado', date: new Date(i.created_at).toLocaleDateString('pt-BR'), type: 'planning', read: false }));
      } else {
        const { data } = await supabase.from('chaves').select(`id, created_at, geral (nome)`).eq('cliente', uuid).eq('status', 'aguardando_aprovacao').limit(3);
        if (data) notifs = data.map((i: any) => ({ id: i.id, title: 'Orçamento Pronto', description: i.geral?.nome || 'Um serviço aguarda sua aprovação', date: new Date(i.created_at).toLocaleDateString('pt-BR'), type: 'approval', read: false }));
      }
      setNotifications(notifs);
    } catch (e) { console.error(e); }
  };

  const handleNotificationClick = (notif: NotificationItem) => {
    setShowNotifications(false);
    const normType = userType.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (['planejista', 'orcamentista', 'gestor', 'profissional'].includes(normType)) navigate('/chamados');
    else if (notif.type === 'approval') navigate('/orders');
    else navigate('/calendar');
  };

  return (
    <div className="min-h-screen bg-[#F2F4F8]">
      <header className="px-5 pt-12 md:pt-8 pb-4 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-gray-200 mb-4 shadow-sm">
        <div>
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Olá, {userName}</h2>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
        </div>
        <div className="flex items-center space-x-3" ref={notificationRef}>
          <div className="relative">
            <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2.5 rounded-full bg-white shadow-sm border border-gray-100 active:scale-95 transition-all">
              <Bell size={20} className="text-gray-900" />
              {notifications.length > 0 && <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>}
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-14 w-80 bg-white/90 backdrop-blur-xl border border-gray-200 shadow-2xl rounded-[1.5rem] overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white/50"><h3 className="font-bold text-gray-900 text-sm">Notificações</h3><button onClick={() => setShowNotifications(false)} className="text-gray-400"><X size={16} /></button></div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length > 0 ? notifications.map((notif) => (
                    <div key={notif.id} onClick={() => handleNotificationClick(notif)} className="p-4 border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
                      <div className="flex justify-between mb-1"><span className={`text-[9px] px-1.5 rounded font-black uppercase ${notif.type === 'approval' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{notif.type}</span><span className="text-[9px] text-gray-400">{notif.date}</span></div>
                      <h4 className="text-sm font-bold text-gray-900 leading-tight">{notif.title}</h4>
                      <p className="text-xs text-gray-500 mt-1 truncate">{notif.description}</p>
                    </div>
                  )) : <div className="p-8 text-center text-xs text-gray-400 font-bold">Tudo em dia!</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {pendingApprovalId && (
        <div onClick={() => navigate('/orders')} className="mx-5 mb-4 bg-blue-600 rounded-[2rem] p-5 shadow-xl flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center space-x-4 relative z-10">
            <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl text-white"><AlertCircle size={24} className="animate-pulse" /></div>
            <div><h3 className="font-bold text-white text-base">Orçamento Pronto!</h3><p className="text-blue-100 text-xs font-medium">Um serviço aguarda sua aprovação.</p></div>
          </div>
          <ChevronRight size={20} className="text-white relative z-10" />
        </div>
      )}

      {pendingProfessionalId && (
        <div onClick={() => navigate('/chamados')} className="mx-5 mb-4 bg-blue-600 rounded-[2rem] p-5 shadow-xl flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center space-x-4 relative z-10">
            <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl text-white"><Briefcase size={24} className="animate-pulse" /></div>
            <div><h3 className="font-bold text-white text-base">Novo Chamado Disponível!</h3><p className="text-blue-100 text-xs font-medium">Um serviço aguarda sua aceitação.</p></div>
          </div>
          <ChevronRight size={20} className="text-white relative z-10" />
        </div>
      )}

      {pendingRatingId && (
        <div
          onClick={() => navigate('/orders', { state: { ratingOrderId: pendingRatingId } })}
          className="mx-5 mb-4 bg-white border border-yellow-100 rounded-[2rem] p-5 shadow-lg flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all group overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-50 rounded-full -mr-8 -mt-8 blur-2xl group-hover:scale-110 transition-transform opacity-70"></div>
          <div className="flex items-center space-x-4 relative z-10">
            <div className="bg-yellow-100 p-3 rounded-2xl text-yellow-600 shadow-sm border border-yellow-200"><Star size={24} className="fill-yellow-500 animate-bounce" /></div>
            <div>
              <h3 className="font-black text-gray-900 text-base">Avaliação Pendente</h3>
              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Como foi o serviço de {pendingRatingServiceName}?</p>
            </div>
          </div>
          <div className="bg-yellow-500 text-white p-2 rounded-xl shadow-lg group-hover:translate-x-1 transition-transform">
            <ChevronRight size={18} />
          </div>
        </div>
      )}

      <div className="flex space-x-4 overflow-x-auto px-5 pb-4 no-scrollbar">
        {loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="min-w-[68px] h-[68px] rounded-full bg-white animate-pulse shadow-sm"></div>) : categories.map((cat) => <StoryCircle key={cat.id} item={cat} />)}
      </div>

      <div className="px-5 space-y-6 mt-2 md:mt-6">
        {nextAppointment && (
          <div className="bg-white border border-blue-100 rounded-[2.5rem] p-6 text-gray-900 shadow-vitrified relative overflow-hidden group hover:scale-[1.01] transition-transform cursor-pointer" onClick={() => navigate('/calendar')}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full -mr-8 -mt-8 blur-2xl"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <span className="text-ios-blue text-[10px] font-black uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">Próximo Atendimento</span>
                <h3 className="text-xl font-black mt-3 mb-1 text-gray-900 leading-tight">{nextAppointment.serviceName}</h3>
                <div className="flex items-center space-x-2 text-gray-500 text-xs font-bold uppercase tracking-wider mt-1"><Calendar size={12} /><span>{nextAppointment.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</span></div>
                <div className="flex items-center space-x-2 text-ios-blue text-sm font-black mt-1"><Clock size={14} /><span>{nextAppointment.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full border-2 border-white shadow-lg bg-gray-50 overflow-hidden mb-2">
                  <img src={nextAppointment.proPhoto || `https://ui-avatars.com/api/?name=${nextAppointment.proName}`} className="w-full h-full object-cover" alt="Perfil" />
                </div>
                <span className="text-[10px] font-black text-gray-900 uppercase">{nextAppointment.proName?.split(' ')[0] || ''}</span>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white/50 backdrop-blur-md p-1 rounded-2xl flex shadow-sm border border-white max-w-md mx-auto overflow-x-auto no-scrollbar">
          <button onClick={() => setTimeFilter('day')} className={`flex-1 min-w-[70px] py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${timeFilter === 'day' ? 'bg-black text-white shadow-md scale-105' : 'text-gray-400 hover:text-gray-600'}`}>Dia</button>
          <button onClick={() => setTimeFilter('week')} className={`flex-1 min-w-[70px] py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${timeFilter === 'week' ? 'bg-black text-white shadow-md scale-105' : 'text-gray-400 hover:text-gray-600'}`}>Semana</button>
          <button onClick={() => setTimeFilter('month')} className={`flex-1 min-w-[70px] py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${timeFilter === 'month' ? 'bg-black text-white shadow-md scale-105' : 'text-gray-400 hover:text-gray-600'}`}>Mês</button>
          <button onClick={() => setTimeFilter('all')} className={`flex-1 min-w-[70px] py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${timeFilter === 'all' ? 'bg-black text-white shadow-md scale-105' : 'text-gray-400 hover:text-gray-600'}`}>Geral</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { icon: CalendarCheck, label: 'Agendamentos', count: agendamentosCount, color: 'text-blue-600', bg: 'bg-blue-50' },
            { icon: TrendingUp, label: 'Ativos', count: servicosAtivosCount, color: 'text-purple-600', bg: 'bg-purple-50' }
          ].map((stat, i) => (
            <div key={i} className="bg-white p-5 rounded-[2rem] shadow-vitrified flex flex-col justify-between h-36 relative overflow-hidden group hover:scale-[1.02] transition-transform border border-white">
              <div className={`absolute -top-6 -right-6 w-24 h-24 ${stat.bg}/30 rounded-full`}></div>
              <div className="relative z-10">
                <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-4`}><stat.icon size={20} /></div>
                <span className="text-3xl font-black text-gray-900 tracking-tight">{loading ? '...' : stat.count}</span>
                <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mt-1">{stat.label}</p>
              </div>
            </div>
          ))}
          <div className="bg-white p-5 rounded-[2rem] shadow-vitrified flex flex-col justify-between h-36 relative overflow-hidden group hover:scale-[1.02] transition-transform border border-white">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-green-50/30 rounded-full"></div>
            <div className="relative z-10">
              <div className="w-10 h-10 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-4"><Star size={20} /></div>
              <span className="text-3xl font-black text-gray-900 tracking-tight">{loading ? '...' : mediaGeral.toFixed(1)}</span>
              <div className="flex items-center gap-1">
                <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mt-1">
                  {userType.toLowerCase().includes('profissional') ? 'Reputação' : userType.toLowerCase().includes('consumidor') ? 'Minha Média' : 'Média Global'}
                </p>
                <div className="group relative mt-1">
                  <AlertTriangle size={10} className="text-gray-300 cursor-help" />
                  <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-black text-white text-[8px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed">
                    {userType.toLowerCase().includes('profissional')
                      ? "Média Bayesiana: Ponderação entre suas notas reais e a média da plataforma para maior justiça."
                      : userType.toLowerCase().includes('consumidor')
                        ? "Média aritmética simples de todas as notas que você atribuiu em seus pedidos."
                        : "Média aritmética de todas as avaliações registradas na plataforma."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {topProfessionals.length > 0 && (
          <div>
            <div className="flex items-center space-x-2 mb-4 px-1">
              <Trophy size={18} className="text-yellow-500" />
              <h3 className="text-lg font-bold text-gray-900">Profissionais Elite</h3>
              <div className="group relative ml-auto">
                <AlertTriangle size={14} className="text-gray-300 cursor-help" />
                <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-black text-white text-[8px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed">
                  Ranking baseado em volume de atendimentos e qualidade consistente (Média Bayesiana).
                </div>
              </div>
            </div>
            <div className="flex space-x-4 overflow-x-auto no-scrollbar pb-2">
              {topProfessionals.map((pro) => (
                <div key={pro.uuid} onClick={() => navigate(`/professional/${pro.uuid}`)} className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-50 min-w-[170px] flex flex-col items-center relative cursor-pointer group active:scale-95 transition-all">
                  <div className="w-16 h-16 rounded-full p-1 bg-gradient-to-tr from-gray-100 to-gray-200 mb-3 group-hover:scale-105 transition-transform"><img src={pro.fotoperfil || `https://ui-avatars.com/api/?name=${pro.nome}`} className="w-full h-full rounded-full object-cover border-2 border-white shadow-sm" alt="Pro" /></div>
                  <h4 className="font-bold text-gray-900 text-sm text-center truncate w-full mb-1">{pro.nome}</h4>
                  <div className="flex items-center space-x-1 mb-3"><Star size={10} className="text-yellow-500 fill-yellow-500" /><span className="text-[10px] font-black text-gray-900">{pro.rating.toFixed(1)}</span></div>
                  <div className="bg-blue-50 text-ios-blue px-3 py-1.5 rounded-xl text-[9px] font-black uppercase flex items-center w-full justify-center"><Briefcase size={10} className="mr-1" />{pro.serviceCount} serviços</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pb-10">
          <div className="flex justify-between items-center mb-4 px-1"><h3 className="text-lg font-bold text-gray-900">Atividades Recentes</h3><button onClick={() => navigate(userType.toLowerCase().includes('profissional') ? '/chamados' : '/orders')} className="text-ios-blue text-[10px] font-black uppercase tracking-widest hover:underline">Ver Histórico</button></div>
          <div className="space-y-3">
            {loading ? <div className="h-20 bg-white rounded-3xl animate-pulse w-full"></div> : recentServices.length > 0 ? recentServices.map((service) => (
              <div key={service.id} onClick={() => navigate('/calendar')} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer group active:scale-[0.99]">
                <div className="flex items-center space-x-4"><div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${service.color}`}><Clock size={20} /></div><div><h4 className="font-bold text-gray-900 text-sm leading-tight">{service.title}</h4><p className="text-[9px] text-gray-400 font-black mt-1 uppercase tracking-wider">{service.status} • {service.date}</p></div></div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-ios-blue group-hover:translate-x-1 transition-all" />
              </div>
            )) : <div className="text-center py-12 bg-white rounded-[2.5rem] border border-dashed border-gray-200"><p className="text-gray-400 text-xs font-black uppercase tracking-widest">Sem atividades registradas</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;