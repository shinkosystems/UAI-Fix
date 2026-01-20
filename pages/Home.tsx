
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Geral } from '../types';
import StoryCircle from '../components/StoryCircle';
import { Bell, ChevronRight, TrendingUp, CalendarCheck, Clock, Star, Loader2, Trophy, Briefcase, Calendar, MapPin, AlertTriangle, X, FileText, CheckCircle, User, AlertCircle } from 'lucide-react';
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

const Home: React.FC = () => {
  const [categories, setCategories] = useState<Geral[]>([]);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState<string>('');
  const [userName, setUserName] = useState<string>('Usuário');
  const [currentUserUuid, setCurrentUserUuid] = useState<string | null>(null);
  const [showProfileAlert, setShowProfileAlert] = useState(false);
  const navigate = useNavigate();

  const [agendamentosCount, setAgendamentosCount] = useState(0);
  const [servicosAtivosCount, setServicosAtivosCount] = useState(0);
  const [recentServices, setRecentServices] = useState<ServiceItem[]>([]);
  const [topProfessionals, setTopProfessionals] = useState<TopProfessional[]>([]);
  const [nextAppointment, setNextAppointment] = useState<NextAppointment | null>(null);
  
  const [pendingApprovalId, setPendingApprovalId] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [pendingReviewId, setPendingReviewId] = useState<number | null>(null);
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
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      let userUuid = authUser?.id;

      if (!userUuid) {
        const { data: demoUsers } = await supabase.from('users').select('*').eq('ativo', true).limit(1);
        if (demoUsers && demoUsers.length > 0) userUuid = demoUsers[0].uuid;
      }

      if (userUuid) {
          setCurrentUserUuid(userUuid);
          const { data: userData } = await supabase.from('users').select('*').eq('uuid', userUuid).single();
          
          if (userData) {
              const tipo = userData.tipo || '';
              const normalizedType = tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              setUserType(tipo);

              if (userData.nome && userData.nome !== 'Insere') {
                  setUserName(userData.nome.split(' ')[0]);
              }
              
              const isInvalid = (val: any) => {
                  if (!val) return true;
                  const str = String(val).trim().toLowerCase();
                  return str === '' || str === 'insere' || str === '000.000.000-00' || str === '00000-000' || str === '(00) 00000-0000';
              };

              const isProfileIncomplete = isInvalid(userData.nome) || isInvalid(userData.cpf) || isInvalid(userData.whatsapp) || isInvalid(userData.cep) || !userData.cidade || isInvalid(userData.rua) || isInvalid(userData.numero) || isInvalid(userData.bairro);
              if (isProfileIncomplete) setShowProfileAlert(true);

              await fetchNotifications(tipo, userUuid);
              await checkPendingReviews(userUuid);
              await checkPendingApprovals(userUuid);

              const isInternal = ['gestor', 'planejista', 'orcamentista'].includes(normalizedType);
              const isProfessional = normalizedType === 'profissional';

              let agendamentosQuery = supabase.from('agenda').select('*', { count: 'exact', head: true }).is('dataconclusao', null);
              if (!isInternal) {
                  if (isProfessional) agendamentosQuery = agendamentosQuery.eq('profissional', userUuid);
                  else agendamentosQuery = agendamentosQuery.eq('cliente', userUuid);
              }
              const { count: countAgendamentos } = await agendamentosQuery;
              setAgendamentosCount(countAgendamentos || 0);

              let ativosQuery = supabase.from('chaves').select('*', { count: 'exact', head: true }).neq('status', 'concluido').neq('status', 'cancelado');
              if (!isInternal) {
                  if (isProfessional) ativosQuery = ativosQuery.eq('profissional', userUuid);
                  else ativosQuery = ativosQuery.eq('cliente', userUuid);
              }
              const { count: countAtivos } = await ativosQuery;
              setServicosAtivosCount(countAtivos || 0);

              const nowISO = new Date().toISOString();
              let nextAgendaQuery = supabase.from('agenda').select(`id, execucao, chaves (geral (nome), profissional (nome, fotoperfil), clienteData:users!cliente (nome, fotoperfil))`).gt('execucao', nowISO).is('dataconclusao', null).order('execucao', { ascending: true }).limit(1);
              if (!isInternal) {
                  if (isProfessional) nextAgendaQuery = nextAgendaQuery.eq('profissional', userUuid);
                  else nextAgendaQuery = nextAgendaQuery.eq('cliente', userUuid);
              }
              const { data: nextAgendaData } = await nextAgendaQuery;
              const nextAgenda = nextAgendaData?.[0];

              if (nextAgenda) {
                   const key: any = nextAgenda.chaves;
                   const displayName = (isProfessional || isInternal) ? (key?.clienteData?.nome || 'Cliente') : (key?.profissional?.nome || 'Profissional');
                   const displayPhoto = (isProfessional || isInternal) ? (key?.clienteData?.fotoperfil) : (key?.profissional?.fotoperfil);
                   setNextAppointment({ id: nextAgenda.id, serviceName: key?.geral?.nome || 'Serviço Agendado', date: new Date(nextAgenda.execucao), proName: displayName, proPhoto: displayPhoto || '' });
              }

              let recentQuery = supabase.from('agenda').select(`id, execucao, dataconclusao, chaves (status, geral (nome))`).order('execucao', { ascending: false }).limit(6);
              if (!isInternal) {
                  if (isProfessional) recentQuery = recentQuery.eq('profissional', userUuid);
                  else recentQuery = recentQuery.eq('cliente', userUuid);
              }
              const { data: agendaData } = await recentQuery;
              if (agendaData) {
                setRecentServices(agendaData.map((item: any) => {
                  const dateObj = new Date(item.execucao);
                  const now = new Date();
                  const isConcluded = !!item.dataconclusao;
                  let status = 'Agendado', color = 'bg-blue-100 text-blue-700';
                  if (isConcluded) { status = 'Concluído'; color = 'bg-gray-100 text-gray-900'; }
                  else if (dateObj < now) { status = 'Pendente'; color = 'bg-yellow-100 text-yellow-900'; }
                  else { status = 'Confirmado'; color = 'bg-green-100 text-green-900'; }
                  return { id: item.id, title: item.chaves?.geral?.nome || 'Serviço', date: dateObj.toLocaleString('pt-BR', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}), status, color, timestamp: item.execucao };
                }));
              }
          }
      }

      const { data: catData } = await supabase.from('geral').select('*').eq('primaria', true).eq('ativa', true).order('id', { ascending: true });
      setCategories(catData || []);

      const { data: pros } = await supabase.from('users').select('uuid, nome, fotoperfil').ilike('tipo', 'profissional').eq('ativo', true);
      if (pros && pros.length > 0) {
          const [{ data: ags }, { data: rats }] = await Promise.all([supabase.from('agenda').select('profissional'), supabase.from('avaliacoes').select('profissional, nota')]);
          const stats = pros.map(p => {
              const count = ags?.filter(a => a.profissional === p.uuid).length || 0;
              const pRats = rats?.filter(r => r.profissional === p.uuid) || [];
              return { uuid: p.uuid, nome: p.nome, fotoperfil: p.fotoperfil, serviceCount: count, rating: pRats.length > 0 ? pRats.reduce((a, b) => a + b.nota, 0) / pRats.length : 0 };
          });
          setTopProfessionals(stats.sort((a, b) => b.rating !== a.rating ? b.rating - a.rating : b.serviceCount - a.serviceCount).slice(0, 5));
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const checkPendingReviews = async (userUuid: string) => {
      const { data: concluded } = await supabase.from('chaves').select('id').eq('cliente', userUuid).eq('status', 'concluido');
      if(!concluded?.length) return;
      const ids = concluded.map(c => c.id);
      const { data: reviews } = await supabase.from('avaliacoes').select('chave').in('chave', ids);
      const reviewedIds = reviews?.map(r => r.chave) || [];
      const firstPending = ids.find(id => !reviewedIds.includes(id));
      if(firstPending) setPendingReviewId(firstPending);
  };

  const checkPendingApprovals = async (userUuid: string) => {
      const { data } = await supabase
          .from('chaves')
          .select('id')
          .eq('cliente', userUuid)
          .eq('status', 'aguardando_aprovacao')
          .limit(1)
          .maybeSingle();
      if (data) setPendingApprovalId(data.id);
      else setPendingApprovalId(null);
  };

  const fetchNotifications = async (role: string, uuid: string) => {
      const normalizedRole = role.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      let notifs: NotificationItem[] = [];
      try {
          if (['planejista', 'orcamentista', 'gestor'].includes(normalizedRole)) {
              const { data } = await supabase
                .from('chaves')
                .select(`id, created_at, chaveunica, status, geral (nome)`)
                .in('status', ['pendente', 'analise'])
                .order('created_at', { ascending: false })
                .limit(10);
              
              if (data) {
                  notifs = data.map((item: any) => ({ 
                      id: item.id, 
                      title: item.status === 'analise' ? 'Aguardando Orçamento' : 'Novo Chamado Pendente', 
                      description: `Chave: ${item.chaveunica} - ${item.geral?.nome}`, 
                      date: new Date(item.created_at).toLocaleDateString('pt-BR'), 
                      type: 'planning', 
                      read: false 
                  }));
              }
          } 
          else {
              // Notificações para Consumidor/Profissional
              const [agendaRes, chavesRes] = await Promise.all([
                  supabase.from('agenda').select(`id, execucao, observacoes, chaves (geral (nome), status)`).or(`cliente.eq.${uuid},profissional.eq.${uuid}`).order('execucao', { ascending: false }).limit(5),
                  supabase.from('chaves').select(`id, created_at, status, geral (nome)`).eq('cliente', uuid).eq('status', 'aguardando_aprovacao').limit(5)
              ]);

              if (chavesRes.data) {
                  const approvalNotifs: NotificationItem[] = chavesRes.data.map(c => ({
                      id: c.id,
                      title: 'Orçamento Pronto!',
                      description: `O orçamento para "${c.geral?.nome}" está disponível para sua aprovação.`,
                      date: new Date(c.created_at).toLocaleDateString('pt-BR'),
                      type: 'approval',
                      read: false
                  }));
                  notifs = [...approvalNotifs];
              }

              if (agendaRes.data) {
                  const agendaNotifs: NotificationItem[] = agendaRes.data.map((item: any) => ({ 
                      id: item.id, 
                      title: item.chaves?.geral?.nome || 'Serviço', 
                      description: `Status: ${item.chaves?.status.replace('_',' ')}`, 
                      date: new Date(item.execucao).toLocaleDateString('pt-BR'), 
                      type: 'agenda', 
                      read: false 
                  }));
                  notifs = [...notifs, ...agendaNotifs];
              }
          }
          setNotifications(notifs.slice(0, 10));
      } catch (error) { console.error(error); }
  };
  
  const handleSmartNavigation = () => {
      const type = userType.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (type === 'profissional') navigate('/chamados');
      else if (type === 'consumidor') navigate('/orders');
      else navigate('/calendar');
  };
  
  const handleServiceClick = (agendaId: number) => { 
      const type = userType.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (type === 'profissional') navigate('/chamados');
      else navigate('/calendar', { state: { openEventId: agendaId } }); 
  };

  const handleNotificationClick = (notif: NotificationItem) => {
      setShowNotifications(false);
      const type = userType.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (['planejista', 'orcamentista', 'gestor', 'profissional'].includes(type)) navigate('/chamados');
      else if (type === 'consumidor' || notif.type === 'approval') navigate('/orders');
      else navigate('/calendar');
  };

  return (
    <div className="min-h-screen bg-[#F2F4F8]">
      {/* HEADER: Atualizado para bg-white/80 e borda inferior para ser idêntico às outras páginas */}
      <header className="px-5 pt-12 md:pt-8 pb-4 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-gray-200 shadow-sm mb-4">
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-0.5">Bem-vindo, {userName}</h2>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
        </div>
        <div className="flex items-center space-x-3" ref={notificationRef}>
            {userType.toLowerCase() === 'profissional' && currentUserUuid && (
                <button onClick={() => navigate(`/professional/${currentUserUuid}`)} className="flex items-center space-x-2 bg-white px-3 py-2 rounded-full text-xs font-bold text-gray-900 border border-gray-200 shadow-sm active:scale-95"><User size={16} /><span className="hidden sm:inline">Minha Página</span></button>
            )}
            <div className="relative">
                <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2.5 rounded-full bg-white shadow-sm border border-gray-100"><Bell size={20} className="text-gray-900" />{notifications.length > 0 && <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-pulse"></span>}</button>
                {showNotifications && (
                    /* DROPDOWN: Mantido o z-index para z-[100] para garantir que fique por cima de tudo */
                    <div className="absolute right-0 top-14 w-80 bg-white/90 backdrop-blur-xl border border-gray-200 shadow-2xl rounded-[1.5rem] overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white/50"><h3 className="font-bold text-gray-900 text-sm">Notificações</h3><button onClick={() => setShowNotifications(false)} className="text-gray-400"><X size={16} /></button></div>
                        <div className="max-h-80 overflow-y-auto">
                            {notifications.length > 0 ? notifications.map((notif) => (
                                <div key={notif.id} onClick={() => handleNotificationClick(notif)} className={`p-4 border-b border-gray-50 hover:bg-blue-50 transition-colors cursor-pointer group ${notif.type === 'approval' ? 'bg-orange-50/30' : ''}`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                                            notif.type === 'approval' ? 'bg-orange-100 text-orange-700 border-orange-200' : 
                                            notif.type === 'agenda' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                                            'bg-gray-50 text-gray-700 border-gray-100'
                                        }`}>
                                            {notif.type === 'approval' ? 'Aprovação' : notif.type === 'agenda' ? 'Agenda' : 'Pedido'}
                                        </span>
                                        <span className="text-[10px] text-gray-400">{notif.date}</span>
                                    </div>
                                    <h4 className="text-sm font-bold text-gray-900 leading-tight">{notif.title}</h4>
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{notif.description}</p>
                                </div>
                            )) : <div className="p-8 text-center"><Bell size={18} className="mx-auto text-gray-300 mb-2"/><p className="text-xs text-gray-400">Vazio.</p></div>}
                        </div>
                    </div>
                )}
            </div>
        </div>
      </header>

      {showProfileAlert && (
          <div className="mx-5 mb-4 bg-orange-50 border border-orange-100 rounded-[2rem] p-5 shadow-sm flex items-start justify-between">
              <div className="flex items-start space-x-3"><div className="bg-orange-100 p-2 rounded-xl text-orange-600 mt-1"><AlertTriangle size={20} /></div><div><h3 className="font-bold text-orange-900 text-sm">Perfil Incompleto</h3><p className="text-xs text-orange-700 mt-1 mb-2 max-w-xs">Precisamos dos seus dados para agendamentos.</p><button onClick={() => navigate('/profile')} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm">Completar Agora</button></div></div>
          </div>
      )}

      {pendingApprovalId && !showProfileAlert && (
          <div onClick={() => navigate('/orders')} className="mx-5 mb-4 bg-blue-600 rounded-[2rem] p-5 shadow-xl shadow-blue-200 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:scale-110 transition-transform"></div>
              <div className="flex items-center space-x-4 relative z-10">
                  <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl text-white">
                      <AlertCircle size={24} className="animate-pulse" />
                  </div>
                  <div>
                      <h3 className="font-bold text-white text-base">Orçamento Disponível!</h3>
                      <p className="text-blue-100 text-xs font-medium">Você tem um serviço aguardando sua aprovação.</p>
                  </div>
              </div>
              <div className="bg-white/20 backdrop-blur-md p-2 rounded-full text-white relative z-10">
                  <ChevronRight size={20} />
              </div>
          </div>
      )}
      
      {pendingReviewId && !showProfileAlert && !pendingApprovalId && (
          <div onClick={() => navigate('/orders', { state: { ratingOrderId: pendingReviewId } })} className="mx-5 mb-4 bg-yellow-50 border border-yellow-100 rounded-[2rem] p-5 shadow-sm flex items-center justify-between cursor-pointer hover:bg-yellow-100/50 transition-colors">
              <div className="flex items-center space-x-3"><div className="bg-yellow-100 p-2 rounded-xl text-yellow-600"><Star size={20} className="fill-yellow-600"/></div><div><h3 className="font-bold text-yellow-900 text-sm">Avaliação Pendente</h3><p className="text-xs text-yellow-700 mt-0.5">Você tem serviços concluídos para avaliar.</p></div></div>
              <ChevronRight size={18} className="text-yellow-400" />
          </div>
      )}

      <div className="flex space-x-4 overflow-x-auto px-5 pb-4 no-scrollbar">
          {loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="w-[68px] h-[68px] rounded-full bg-white animate-pulse"></div>) : categories.map((cat) => <StoryCircle key={cat.id} item={cat} />)}
      </div>

      <div className="px-5 space-y-6 mt-2 md:mt-6">
        {nextAppointment && (
            <div className="bg-white border border-blue-100 rounded-[2.5rem] p-6 text-gray-900 shadow-vitrified relative overflow-hidden group hover:scale-[1.01] transition-transform cursor-pointer" onClick={() => handleServiceClick(nextAppointment.id)}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full -mr-8 -mt-8 blur-2xl"></div>
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <span className="text-ios-blue text-[10px] font-bold uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">Próximo Atendimento</span>
                        <h3 className="text-xl font-bold mt-3 mb-1 text-gray-900">{nextAppointment.serviceName}</h3>
                        <div className="flex items-center space-x-2 text-gray-500 text-sm"><Calendar size={14} /><span>{nextAppointment.date.toLocaleDateString('pt-BR', {weekday: 'long', day: '2-digit', month: 'long'})}</span></div>
                         <div className="flex items-center space-x-2 text-gray-500 text-sm mt-1"><Clock size={14} /><span className="font-bold text-gray-900">{nextAppointment.date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</span></div>
                    </div>
                    <div className="flex flex-col items-center"><div className="w-12 h-12 rounded-full border-2 border-white shadow-md bg-gray-50 overflow-hidden mb-2"><img src={nextAppointment.proPhoto || `https://ui-avatars.com/api/?name=${nextAppointment.proName}`} className="w-full h-full object-cover"/></div><span className="text-[10px] font-bold text-gray-900">{nextAppointment.proName.split(' ')[0]}</span></div>
                </div>
            </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[ {icon: CalendarCheck, label: 'Agendamentos', count: agendamentosCount, color: 'text-blue-600', bg: 'bg-blue-50'}, {icon: TrendingUp, label: 'Serviços Ativos', count: servicosAtivosCount, color: 'text-purple-600', bg: 'bg-purple-50'} ].map((stat, i) => (
            <div key={i} className="bg-white p-5 rounded-[2rem] shadow-vitrified flex flex-col justify-between h-36 relative overflow-hidden group hover:scale-[1.02] transition-transform">
              <div className={`absolute -top-6 -right-6 w-24 h-24 ${stat.bg}/30 rounded-full`}></div>
              <div className="relative z-10"><div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-4`}><stat.icon size={20} /></div><span className="text-3xl font-bold text-gray-900 tracking-tight">{loading ? '...' : stat.count}</span><p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">{stat.label}</p></div>
            </div>
          ))}
          <div className="bg-white p-5 rounded-[2rem] shadow-vitrified flex flex-col justify-between h-36 relative overflow-hidden group hover:scale-[1.02] transition-transform">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-green-50/30 rounded-full"></div>
            <div className="relative z-10"><div className="w-10 h-10 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-4"><Star size={20} /></div><span className="text-3xl font-bold text-gray-900 tracking-tight">4.9</span><p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">Avaliação Média</p></div>
          </div>
        </div>

        {topProfessionals.length > 0 && (
            <div>
                <div className="flex items-center space-x-2 mb-4 px-1"><Trophy size={18} className="text-yellow-500" /><h3 className="text-lg font-bold text-gray-900">Top Profissionais</h3></div>
                <div className="flex space-x-4 overflow-x-auto no-scrollbar pb-2">
                    {topProfessionals.map((pro, index) => (
                        <div key={pro.uuid} onClick={() => navigate(`/professional/${pro.uuid}`)} className="bg-white p-4 rounded-[1.8rem] shadow-sm border border-gray-50 min-w-[160px] flex flex-col items-center relative overflow-hidden cursor-pointer group">
                            <div className={`absolute top-0 left-0 px-3 py-1.5 rounded-br-2xl text-[10px] font-bold text-white z-10 ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-400' : 'bg-gray-800'}`}>#{index + 1}</div>
                            <div className="w-16 h-16 rounded-full p-1 bg-gradient-to-tr from-gray-100 to-gray-200 mb-3 mt-2 group-hover:scale-105 transition-transform"><img src={pro.fotoperfil || `https://ui-avatars.com/api/?name=${pro.nome}`} className="w-full h-full rounded-full object-cover border-2 border-white"/></div>
                            <h4 className="font-bold text-gray-900 text-sm text-center truncate w-full mb-1">{pro.nome}</h4>
                            <div className="flex items-center space-x-1 mb-2"><Star size={10} className="text-yellow-500 fill-yellow-500" /><span className="text-xs font-bold text-gray-900">{pro.rating.toFixed(1)}</span></div>
                            <div className="bg-blue-50 text-ios-blue px-3 py-1 rounded-full text-[10px] font-bold flex items-center w-full justify-center"><Briefcase size={10} className="mr-1" />{pro.serviceCount} serviços</div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div>
          <div className="flex justify-between items-center mb-4 px-1"><h3 className="text-lg font-bold text-gray-900">Últimos Serviços</h3><button onClick={handleSmartNavigation} className="text-ios-blue text-xs font-bold uppercase tracking-wide">Ver todos</button></div>
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4">
            {loading ? <div className="h-20 bg-white rounded-[1.5rem] animate-pulse w-full"></div> : recentServices.length > 0 ? recentServices.map((service) => (
                <div key={service.id} onClick={() => handleServiceClick(service.id)} className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer group">
                  <div className="flex items-center space-x-4"><div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${service.color}`}><Clock size={20} /></div><div><h4 className="font-bold text-gray-900 text-sm">{service.title}</h4><p className="text-xs text-gray-400 font-bold mt-0.5 uppercase tracking-wide">{service.status}</p></div></div>
                  <ChevronRight size={18} className="text-gray-300" />
                </div>
              )) : <div className="col-span-full text-center py-10 bg-white rounded-[2rem] border border-dashed border-gray-200"><p className="text-gray-400 text-sm font-bold">Nenhum serviço agendado.</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
