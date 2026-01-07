
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Agenda, Geral } from '../types';
import { 
    Loader2, ChevronLeft, ChevronRight, X, Clock, User, Save, 
    Calendar as CalendarIcon, MapPin, Grid, Columns, List, 
    Camera, Plus, Trash2, CheckCircle, AlertTriangle, AlertCircle, 
    FileText, Package, Lock, Eye, Check, Ban 
} from 'lucide-react';

interface AgendaExtended extends Agenda {
    geral?: Geral;
    profissionalData?: { nome: string; fotoperfil: string };
    clienteData?: { nome: string; fotoperfil: string; fullCity?: string };
    ordemServico?: {
        id: number;
        status: string;
        datainicio: string;
    };
    chaveData?: {
        id: number;
        status: string;
        chaveunica: string;
        fotoantes: string[];
        fotodepois: string[];
    };
    planejamentoData?: {
        id: number;
        descricao: string;
        recursos: string[];
    };
}

type CalendarView = 'month' | 'week' | 'day';
type ModalTab = 'geral' | 'recursos' | 'fotos' | 'obs';

const Execution: React.FC = () => {
  const [events, setEvents] = useState<AgendaExtended[]>([]);
  const [pendingAcceptance, setPendingAcceptance] = useState<AgendaExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [userType, setUserType] = useState<string>('');
  
  const [selectedEvent, setSelectedEvent] = useState<AgendaExtended | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>('geral');
  const [uploading, setUploading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
      status: '',
      descricao: '', 
      planDescricao: '', 
      recursos: [] as string[],
      fotoantes: [] as string[],
      fotodepois: [] as string[],
      newResource: ''
  });

  useEffect(() => {
    fetchUserType();
    fetchAgenda();
  }, []); // Fetch data once on load

  const fetchUserType = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
          const { data } = await supabase.from('users').select('tipo').eq('uuid', user.id).single();
          if (data) setUserType(data.tipo || '');
      }
  };

  const isProfessional = (userType || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 'profissional';

  const fetchAgenda = async () => {
    try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; 

        const { data: agendaData, error: agendaError } = await supabase
            .from('agenda')
            .select('*')
            .or(`cliente.eq.${user.id},profissional.eq.${user.id}`);

        if (agendaError) throw agendaError;
        if (!agendaData || agendaData.length === 0) { 
            setEvents([]); 
            setPendingAcceptance([]);
            return; 
        }

        const chaveIds = agendaData.map((a: any) => a.chave).filter((id: any) => id);
        const userIds = new Set<string>();
        agendaData.forEach((a: any) => { if (a.cliente) userIds.add(a.cliente); if (a.profissional) userIds.add(a.profissional); });

        const [chavesRes, osRes, usersRes, planRes, servicesRes] = await Promise.all([
            chaveIds.length > 0 ? supabase.from('chaves').select('*').in('id', chaveIds) : { data: [] },
            chaveIds.length > 0 ? supabase.from('ordemservico').select('*').in('chave', chaveIds) : { data: [] },
            userIds.size > 0 ? supabase.from('users').select('uuid, nome, fotoperfil, cidade').in('uuid', Array.from(userIds)) : { data: [] },
            chaveIds.length > 0 ? supabase.from('planejamento').select('*').in('chave', chaveIds) : { data: [] },
            supabase.from('geral').select('*')
        ]);

        const chavesMap: Record<number, any> = {};
        chavesRes.data?.forEach((c: any) => chavesMap[c.id] = c);
        const osMap: Record<number, any> = {};
        osRes.data?.forEach((os: any) => osMap[os.chave] = os);
        const planMap: Record<number, any> = {};
        planRes.data?.forEach((p: any) => planMap[p.chave] = p);
        const usersMap: Record<string, any> = {};
        usersRes.data?.forEach((u: any) => usersMap[u.uuid] = u);
        const servicesMap: Record<number, any> = {};
        servicesRes.data?.forEach((s: any) => servicesMap[s.id] = s);

        const enriched = agendaData.map((item: any) => {
            const chave = chavesMap[item.chave];
            const os = osMap[item.chave];
            const plan = planMap[item.chave];
            const service = chave ? servicesMap[chave.atividade] : null;
            return { ...item, geral: service, chaveData: chave, ordemServico: os, planejamentoData: plan, profissionalData: usersMap[item.profissional], clienteData: usersMap[item.cliente] };
        });

        const pending = enriched.filter(ev => ev.chaveData?.status === 'aguardando_profissional' && ev.profissional === user.id);
        const filteredEvents = enriched.filter(ev => ev.chaveData?.status !== 'aguardando_profissional');

        setEvents(filteredEvents);
        setPendingAcceptance(pending);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
      const newDate = new Date(currentDate);
      if (view === 'month') {
          newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      } else if (view === 'week') {
          newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
      } else {
          newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
      }
      setCurrentDate(newDate);
  };

  const handleDecision = async (agendaItem: AgendaExtended, accept: boolean) => {
      if (!window.confirm(accept ? "Aceitar este serviço e confirmar agendamento?" : "Recusar este serviço? O pedido voltará para o planejamento.")) return;
      setProcessingId(agendaItem.id);
      try {
          if (accept) {
              const { error } = await supabase.from('chaves').update({ status: 'aprovado' }).eq('id', agendaItem.chave);
              if (error) throw error;
          } else {
              await supabase.from('chaves').update({ status: 'pendente', profissional: null }).eq('id', agendaItem.chave);
              await supabase.from('agenda').delete().eq('id', agendaItem.id);
          }
          await fetchAgenda();
      } catch (e: any) { alert(e.message); } finally { setProcessingId(null); }
  };

  const handleEventClick = (event: AgendaExtended) => {
      setSelectedEvent(event);
      setFormData({
          status: event.chaveData?.status || 'pendente',
          descricao: event.observacoes || '',
          planDescricao: event.planejamentoData?.descricao || '',
          recursos: event.planejamentoData?.recursos || [],
          fotoantes: event.chaveData?.fotoantes || [],
          fotodepois: event.chaveData?.fotodepois || [],
          newResource: ''
      });
      setActiveTab('geral');
      setIsModalOpen(true);
  };

  const handleSave = async () => {
      if (!selectedEvent || !isProfessional) return;
      setSaving(true);
      try {
          if (selectedEvent.chaveData) await supabase.from('chaves').update({ status: formData.status, fotoantes: formData.fotoantes, fotodepois: formData.fotodepois }).eq('id', selectedEvent.chaveData.id);
          await supabase.from('agenda').update({ observacoes: formData.descricao }).eq('id', selectedEvent.id);
          await fetchAgenda(); setIsModalOpen(false); alert("Salvo!");
      } catch (error: any) { alert(error.message); } finally { setSaving(false); }
  };

  const getStatusColor = (s: string | undefined) => {
      switch (s?.toLowerCase()) {
          case 'concluido': return 'bg-green-100 text-green-900 border-green-200';
          case 'executando': return 'bg-purple-100 text-purple-900 border-purple-200';
          case 'pendente': return 'bg-yellow-100 text-yellow-900 border-yellow-200';
          case 'aprovado': return 'bg-green-50 text-green-700 border-green-100';
          default: return 'bg-blue-100 text-blue-900 border-blue-200';
      }
  };

  const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const days = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1).getDay();
      return { days, firstDay };
  };

  const getDaysInWeek = (date: Date) => {
      const start = new Date(date);
      start.setDate(date.getDate() - date.getDay());
      return Array.from({ length: 7 }, (_, i) => {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          return d;
      });
  };

  const isToday = (d: Date) => {
      const now = new Date();
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };

  const isSameDay = (d1: Date, d2: Date) => {
      return d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  };

  const renderMonthView = () => {
    const { days, firstDay } = getDaysInMonth(currentDate);
    const dayCells = [];
    for (let i = 0; i < firstDay; i++) dayCells.push(<div key={`empty-${i}`} className="bg-white min-h-[100px] border-b border-r border-gray-100 opacity-50"></div>);
    for (let d = 1; d <= days; d++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
        const dayEvents = events.filter(e => isSameDay(new Date(e.execucao), date));
        dayCells.push(
            <div key={d} className={`bg-white min-h-[100px] p-2 border-b border-r border-gray-100 hover:bg-gray-50 transition-colors ${isToday(date) ? 'bg-blue-50/30' : ''}`}>
                <span className={`text-xs font-bold ${isToday(date) ? 'bg-ios-blue text-white w-6 h-6 flex items-center justify-center rounded-full shadow-sm' : 'text-gray-900'}`}>{d}</span>
                <div className="mt-1 space-y-1">
                    {dayEvents.map(ev => (
                        <button key={ev.id} onClick={() => handleEventClick(ev)} className={`w-full text-left px-1.5 py-0.5 rounded border text-[9px] font-black truncate uppercase ${getStatusColor(ev.chaveData?.status)}`}>{ev.geral?.nome}</button>
                    ))}
                </div>
            </div>
        );
    }
    return <div className="grid grid-cols-7 border-l border-t border-gray-100 rounded-2xl overflow-hidden shadow-vitrified">{dayCells}</div>;
  };

  const renderWeekView = () => {
      const weekDays = getDaysInWeek(currentDate);
      return (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
              {weekDays.map((date, i) => {
                  const dayEvents = events.filter(e => isSameDay(new Date(e.execucao), date));
                  return (
                      <div key={i} className={`bg-white rounded-[1.8rem] p-4 shadow-sm border border-gray-100 flex flex-col min-h-[300px] ${isToday(date) ? 'ring-2 ring-ios-blue border-transparent' : ''}`}>
                          <div className="text-center border-b border-gray-50 pb-3 mb-3">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][date.getDay()]}</p>
                              <p className={`text-xl font-black mt-0.5 ${isToday(date) ? 'text-ios-blue' : 'text-gray-900'}`}>{date.getDate()}</p>
                          </div>
                          <div className="flex-1 space-y-2">
                              {dayEvents.length > 0 ? dayEvents.map(ev => (
                                  <div key={ev.id} onClick={() => handleEventClick(ev)} className={`p-3 rounded-2xl border cursor-pointer hover:scale-[1.02] transition-transform ${getStatusColor(ev.chaveData?.status)}`}>
                                      <p className="text-[10px] font-black uppercase truncate">{ev.geral?.nome}</p>
                                      <p className="text-[9px] font-bold opacity-70 flex items-center mt-1"><Clock size={10} className="mr-1" /> {new Date(ev.execucao).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</p>
                                  </div>
                              )) : <p className="text-[10px] text-gray-300 font-bold text-center mt-10 uppercase tracking-tighter">Sem tarefas</p>}
                          </div>
                      </div>
                  );
              })}
          </div>
      );
  };

  const renderDayView = () => {
      const dayEvents = events.filter(e => isSameDay(new Date(e.execucao), currentDate));
      return (
          <div className="max-w-3xl mx-auto space-y-4">
              <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm text-center">
                  <p className="text-xs font-black text-ios-blue uppercase tracking-[0.2em] mb-1">{['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][currentDate.getDay()]}</p>
                  <h2 className="text-3xl font-black text-gray-900">{currentDate.getDate()} {currentDate.toLocaleDateString('pt-BR', {month:'long'})}</h2>
              </div>
              {dayEvents.length > 0 ? dayEvents.map(ev => (
                  <div key={ev.id} onClick={() => handleEventClick(ev)} className={`bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]`}>
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${getStatusColor(ev.chaveData?.status)}`}>
                          <Clock size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 text-lg leading-tight truncate">{ev.geral?.nome}</h3>
                          <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-xs font-bold text-gray-500 flex items-center"><Clock size={14} className="mr-1" /> {new Date(ev.execucao).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
                                <span className="text-xs font-bold text-gray-500 flex items-center capitalize"><User size={14} className="mr-1" /> {isProfessional ? ev.clienteData?.nome : ev.profissionalData?.nome}</span>
                          </div>
                      </div>
                      <ChevronRight className="text-gray-300" />
                  </div>
              )) : (
                  <div className="bg-white/50 border-2 border-dashed border-gray-200 rounded-[2.5rem] p-20 text-center">
                      <CalendarIcon size={48} className="mx-auto text-gray-200 mb-4" />
                      <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Nenhum compromisso para hoje</p>
                  </div>
              )}
          </div>
      );
  };

  const getHeaderText = () => {
      if (view === 'month') return currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      if (view === 'week') {
          const week = getDaysInWeek(currentDate);
          return `${week[0].getDate()} - ${week[6].getDate()} de ${currentDate.toLocaleDateString('pt-BR', {month:'short'})}`;
      }
      return currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  };

  return (
    <div className="min-h-screen bg-ios-bg pb-20">
       <div className="bg-white/80 backdrop-blur-md px-5 pt-12 pb-4 sticky top-0 z-20 border-b border-gray-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <div className="flex gap-1">
                    <button onClick={() => handleNavigate('prev')} className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 active:scale-90 transition-all"><ChevronLeft size={20}/></button>
                    <button onClick={() => handleNavigate('next')} className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 active:scale-90 transition-all"><ChevronRight size={20}/></button>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight capitalize truncate">{getHeaderText()}</h1>
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Minha Agenda</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="bg-gray-100 p-1 rounded-2xl flex shadow-inner">
                    <button onClick={() => setView('month')} className={`px-4 py-2 rounded-xl transition-all font-bold text-xs ${view === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Mês</button>
                    <button onClick={() => setView('week')} className={`px-4 py-2 rounded-xl transition-all font-bold text-xs ${view === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Semana</button>
                    <button onClick={() => setView('day')} className={`px-4 py-2 rounded-xl transition-all font-bold text-xs ${view === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Dia</button>
                </div>
                <button onClick={() => setCurrentDate(new Date())} className="text-[10px] font-black text-ios-blue uppercase tracking-widest px-3 py-2 bg-blue-50 rounded-xl">Hoje</button>
            </div>
      </div>

      <div className="p-5 max-w-7xl mx-auto space-y-6">
           {isProfessional && pendingAcceptance.length > 0 && (
               <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-2 px-1">
                        <AlertCircle size={18} className="text-cyan-600" />
                        <h2 className="text-sm font-black text-cyan-900 uppercase tracking-widest">Confirmações Pendentes ({pendingAcceptance.length})</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pendingAcceptance.map(item => (
                            <div key={item.id} className="bg-white border border-cyan-100 rounded-[2.2rem] p-5 shadow-vitrified flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-cyan-50 rounded-2xl flex items-center justify-center overflow-hidden">
                                            {item.geral?.imagem ? <img src={item.geral.imagem} className="w-full h-full object-cover"/> : <Package size={24} className="text-cyan-400" />}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 text-sm leading-tight">{item.geral?.nome}</h3>
                                            <p className="text-[10px] font-black text-gray-400 uppercase mt-0.5">#{item.chaveData?.chaveunica}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-cyan-600 uppercase">Data Proposta</p>
                                        <p className="text-xs font-bold text-gray-900">{new Date(item.execucao).toLocaleDateString('pt-BR', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button disabled={processingId === item.id} onClick={() => handleDecision(item, true)} className="flex-1 bg-black text-white py-3.5 rounded-2xl font-black text-[10px] shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">{processingId === item.id ? <Loader2 size={14} className="animate-spin"/> : <><Check size={16}/> ACEITAR</>}</button>
                                    <button disabled={processingId === item.id} onClick={() => handleDecision(item, false)} className="flex-1 bg-gray-50 text-red-500 py-3.5 rounded-2xl font-black text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all"><Ban size={16}/> RECUSAR</button>
                                </div>
                            </div>
                        ))}
                    </div>
               </div>
           )}

           {loading ? (
               <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ios-blue" size={40}/></div>
           ) : (
               <div className="animate-in fade-in duration-500">
                    {view === 'month' && (
                        <>
                            <div className="grid grid-cols-7 mb-2">
                                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (<div key={day} className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest py-2">{day}</div>))}
                            </div>
                            {renderMonthView()}
                        </>
                    )}
                    {view === 'week' && renderWeekView()}
                    {view === 'day' && renderDayView()}
               </div>
           )}
      </div>

      {isModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                             <h3 className="font-bold text-gray-900 text-lg leading-tight">{selectedEvent.geral?.nome}</h3>
                             {!isProfessional && <span className="bg-gray-100 text-gray-900 px-2 py-0.5 rounded-full text-[10px] font-black uppercase flex items-center"><Eye size={10} className="mr-1"/> Visualização</span>}
                        </div>
                        <p className="text-xs text-gray-400 font-mono font-bold mt-0.5">#{selectedEvent.chaveData?.chaveunica}</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 transition-colors"><X size={20} /></button>
                </div>

                <div className="flex border-b border-gray-100 bg-white">
                    {(['geral', 'recursos', 'fotos', 'obs'] as ModalTab[]).map((tab) => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === tab ? 'text-ios-blue' : 'text-gray-400'}`}>{tab}{activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}</button>
                    ))}
                </div>

                <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white no-scrollbar">
                    {activeTab === 'geral' && (
                        <div className="space-y-4">
                            <div className="bg-gray-50 p-5 rounded-[2rem] flex items-center justify-between border border-gray-100 shadow-sm">
                                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-white overflow-hidden shadow-sm border border-white"><img src={selectedEvent.clienteData?.fotoperfil || `https://ui-avatars.com/api/?name=${selectedEvent.clienteData?.nome}`} className="w-full h-full object-cover"/></div><div><p className="text-[10px] font-bold text-gray-400 uppercase">Cliente</p><p className="font-bold text-sm text-gray-900 leading-tight">{selectedEvent.clienteData?.nome}</p></div></div>
                                <div className="flex items-center gap-3 text-right"><div><p className="text-[10px] font-bold text-gray-400 uppercase">Profissional</p><p className="font-bold text-sm text-gray-900 leading-tight">{selectedEvent.profissionalData?.nome}</p></div><div className="w-10 h-10 rounded-full bg-white overflow-hidden shadow-sm border border-white"><img src={selectedEvent.profissionalData?.fotoperfil || `https://ui-avatars.com/api/?name=${selectedEvent.profissionalData?.nome}`} className="w-full h-full object-cover"/></div></div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Status do Pedido</label>
                                <select 
                                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm font-black text-gray-900 outline-none disabled:opacity-100 appearance-none" 
                                    value={formData.status} 
                                    disabled={!isProfessional || selectedEvent.chaveData?.status?.toLowerCase() === 'concluido'} 
                                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                                >
                                    <option value="pendente">Pendente</option>
                                    <option value="aprovado">Aprovado</option>
                                    <option value="executando">Executando</option>
                                    <option value="concluido">Concluído</option>
                                    <option value="cancelado">Cancelado</option>
                                </select>
                                {selectedEvent.chaveData?.status?.toLowerCase() === 'concluido' && <p className="text-[9px] font-bold text-gray-400 uppercase text-center mt-1">Status travado (Serviço Concluído)</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Descrição Técnica</label>
                                <div className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-5 text-sm font-bold text-gray-900 min-h-[80px]">{formData.planDescricao || "Sem descrição registrada."}</div>
                            </div>
                        </div>
                    )}
                    {/* ... abas recursos, fotos e obs continuam as mesmas ... */}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 mt-auto flex gap-3">
                    <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-white border border-gray-200 text-gray-900 py-4 rounded-2xl font-bold shadow-sm active:scale-95 transition-all">Fechar</button>
                    {isProfessional && selectedEvent.chaveData?.status?.toLowerCase() !== 'concluido' && <button onClick={handleSave} disabled={saving} className="flex-[2] bg-black text-white py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex justify-center items-center gap-2">{saving ? <Loader2 className="animate-spin" size={20}/> : <><Save size={18}/><span>Salvar Dados</span></>}</button>}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Execution;
