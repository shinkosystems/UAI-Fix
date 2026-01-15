
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Agenda, Geral } from '../types';
import { 
    Loader2, ChevronLeft, ChevronRight, X, Clock, User, Save, 
    Calendar as CalendarIcon, Grid, Columns, List, 
    Camera, Package, Trash2, Check, Ban, Eye, AlertCircle, Banknote, MapPin
} from 'lucide-react';

interface AgendaExtended extends Agenda {
    geral?: Geral;
    profissionalData?: { nome: string; fotoperfil: string };
    clienteData?: { 
        nome: string; 
        fotoperfil: string; 
        fullCity?: string;
        rua?: string;
        numero?: string;
        bairro?: string;
        complemento?: string;
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
    orcamentoData?: {
        preco: number;
    };
}

type CalendarView = 'month' | 'week' | 'day';
type ModalTab = 'geral' | 'fotos' | 'obs';

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
      observacoes: '',
      fotoantes: [] as string[],
      fotodepois: [] as string[]
  });

  useEffect(() => {
    fetchAgenda();
  }, []);

  const isProfessional = (userType || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 'profissional';

  const fetchAgenda = async () => {
    try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; 

        const { data: userData } = await supabase.from('users').select('tipo').eq('uuid', user.id).single();
        const role = userData?.tipo || '';
        setUserType(role);

        const { data: agendaData, error: agendaError } = await supabase
            .from('agenda')
            .select('*')
            .or(`cliente.eq.${user.id},profissional.eq.${user.id}`);

        if (agendaError) throw agendaError;
        if (!agendaData) return;

        const dreamChaveIds = agendaData.map((a: any) => a.chave).filter((id: any) => id);
        const userIds = new Set<string>();
        agendaData.forEach((a: any) => { if (a.cliente) userIds.add(a.cliente); if (a.profissional) userIds.add(a.profissional); });

        const [chavesRes, planRes, usersRes, servicesRes, orcRes] = await Promise.all([
            dreamChaveIds.length > 0 ? supabase.from('chaves').select('*').in('id', dreamChaveIds) : { data: [] },
            dreamChaveIds.length > 0 ? supabase.from('planejamento').select('*').in('chave', dreamChaveIds) : { data: [] },
            userIds.size > 0 ? supabase.from('users').select('uuid, nome, fotoperfil, rua, numero, bairro, complemento').in('uuid', Array.from(userIds)) : { data: [] },
            supabase.from('geral').select('*'),
            dreamChaveIds.length > 0 ? supabase.from('orcamentos').select('chave, preco').in('chave', dreamChaveIds) : { data: [] }
        ]);

        const chavesMap = Object.fromEntries(chavesRes.data?.map(c => [c.id, c]) || []);
        const planMap = Object.fromEntries(planRes.data?.map(p => [p.chave, p]) || []);
        const usersMap = Object.fromEntries(usersRes.data?.map(u => [u.uuid, u]) || []);
        const servicesMap = Object.fromEntries(servicesRes.data?.map(s => [s.id, s]) || []);
        const orcMap = Object.fromEntries(orcRes.data?.map(o => [o.chave, o]) || []);

        const enriched = agendaData.map((item: any) => {
            const chave = chavesMap[item.chave];
            return {
                ...item,
                geral: chave ? servicesMap[chave.atividade] : null,
                chaveData: chave,
                planejamentoData: planMap[item.chave],
                profissionalData: usersMap[item.profissional],
                clienteData: usersMap[item.cliente],
                orcamentoData: orcMap[item.chave]
            };
        });

        // REGRA DE OURO: Profissional só tem contato com o card no aceite ou execução.
        // ADICIONADO: 'aguardando_aprovacao' agora também oculta o pedido para o profissional.
        const visibleForPro = enriched.filter(ev => {
            if (!isProfessional) return true;
            const status = ev.chaveData?.status?.toLowerCase();
            return !['pendente', 'analise', 'aguardando_aprovacao'].includes(status || '');
        });

        const pending = visibleForPro.filter(ev => ev.chaveData?.status === 'aguardando_profissional' && ev.profissional === user.id);
        const filteredEvents = visibleForPro.filter(ev => ev.chaveData?.status !== 'aguardando_profissional');

        setEvents(filteredEvents);
        setPendingAcceptance(pending);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
      const newDate = new Date(currentDate);
      if (view === 'month') newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      else if (view === 'week') newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
      else newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
      setCurrentDate(newDate);
  };

  const handleEventClick = (event: AgendaExtended) => {
      setSelectedEvent(event);
      setFormData({
          status: event.chaveData?.status || 'pendente',
          observacoes: event.observacoes || '',
          fotoantes: event.chaveData?.fotoantes || [],
          fotodepois: event.chaveData?.fotodepois || []
      });
      setActiveTab('geral');
      setIsModalOpen(true);
  };

  const handleDecision = async (agendaItem: AgendaExtended, accept: boolean) => {
      setProcessingId(agendaItem.id);
      try {
          if (accept) {
              await supabase.from('chaves').update({ status: 'aprovado' }).eq('id', agendaItem.chave);
          } else {
              await supabase.from('chaves').update({ status: 'pendente', profissional: null }).eq('id', agendaItem.chave);
              await supabase.from('agenda').delete().eq('id', agendaItem.id);
          }
          await fetchAgenda();
      } catch (e: any) { alert(e.message); } finally { setProcessingId(null); }
  };

  const handleSave = async () => {
      if (!selectedEvent || !isProfessional) return;
      setSaving(true);
      try {
          if (selectedEvent.chaveData) {
              await supabase.from('chaves').update({ 
                  status: formData.status, 
                  fotoantes: formData.fotoantes, 
                  fotodepois: formData.fotodepois 
              }).eq('id', selectedEvent.chaveData.id);
          }
          await supabase.from('agenda').update({ observacoes: formData.observacoes }).eq('id', selectedEvent.id);
          await fetchAgenda();
          setIsModalOpen(false);
      } catch (error: any) { alert(error.message); } finally { setSaving(false); }
  };

  const getStatusColor = (s: string | undefined) => {
      switch (s?.toLowerCase()) {
          case 'concluido': return 'bg-green-100 text-green-900 border-green-200';
          case 'executando': return 'bg-purple-100 text-purple-900 border-purple-200';
          case 'aprovado': return 'bg-green-50 text-green-700 border-green-100';
          default: return 'bg-blue-100 text-blue-900 border-blue-200';
      }
  };

  const isSameDay = (d1: Date, d2: Date) => d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  const isToday = (d: Date) => isSameDay(d, new Date());

  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    
    const dayCells = [];
    for (let i = 0; i < firstDay; i++) dayCells.push(<div key={`empty-${i}`} className="bg-white min-h-[100px] border-b border-r border-gray-100 opacity-30"></div>);
    
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const dayEvents = events.filter(e => isSameDay(new Date(e.execucao), date));
        dayCells.push(
            <div key={d} className={`bg-white min-h-[100px] p-2 border-b border-r border-gray-100 hover:bg-gray-50 transition-colors ${isToday(date) ? 'bg-blue-50/20' : ''}`}>
                <span className={`text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full ${isToday(date) ? 'bg-ios-blue text-white shadow-sm' : 'text-gray-400'}`}>{d}</span>
                <div className="mt-1.5 space-y-1">
                    {dayEvents.map(ev => (
                        <button key={ev.id} onClick={() => handleEventClick(ev)} className={`w-full text-left px-1.5 py-0.5 rounded border text-[8px] font-black truncate uppercase ${getStatusColor(ev.chaveData?.status)}`}>{ev.geral?.nome}</button>
                    ))}
                </div>
            </div>
        );
    }
    return <div className="grid grid-cols-7 border-l border-t border-gray-100 rounded-3xl overflow-hidden shadow-sm">{dayCells}</div>;
  };

  const renderWeekView = () => {
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDate.getDay());
      const weekDays = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          return d;
      });

      return (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {weekDays.map((date, i) => {
                  const dayEvents = events.filter(e => isSameDay(new Date(e.execucao), date));
                  return (
                      <div key={i} className={`bg-white rounded-[1.8rem] p-4 shadow-sm border border-gray-100 flex flex-col min-h-[250px] ${isToday(date) ? 'ring-2 ring-ios-blue border-transparent' : ''}`}>
                          <div className="text-center border-b border-gray-50 pb-2 mb-3">
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][date.getDay()]}</p>
                              <p className={`text-xl font-black ${isToday(date) ? 'text-ios-blue' : 'text-gray-900'}`}>{date.getDate()}</p>
                          </div>
                          <div className="flex-1 space-y-2">
                              {dayEvents.map(ev => (
                                  <div key={ev.id} onClick={() => handleEventClick(ev)} className={`p-2.5 rounded-xl border cursor-pointer hover:scale-[1.02] transition-transform ${getStatusColor(ev.chaveData?.status)}`}>
                                      <p className="text-[9px] font-black uppercase truncate leading-tight">{ev.geral?.nome}</p>
                                      <p className="text-[8px] font-bold opacity-60 flex items-center mt-1"><Clock size={10} className="mr-1" /> {new Date(ev.execucao).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</p>
                                  </div>
                              ))}
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
          <div className="max-w-2xl mx-auto space-y-3">
              {dayEvents.length > 0 ? dayEvents.map(ev => (
                  <div key={ev.id} onClick={() => handleEventClick(ev)} className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${getStatusColor(ev.chaveData?.status)}`}>
                          <Clock size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 text-base leading-tight truncate">{ev.geral?.nome}</h3>
                          <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-[10px] font-black text-gray-400 flex items-center uppercase tracking-wider"><Clock size={12} className="mr-1" /> {new Date(ev.execucao).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
                                <span className="text-[10px] font-black text-ios-blue flex items-center uppercase tracking-wider"><User size={12} className="mr-1" /> {isProfessional ? ev.clienteData?.nome : ev.profissionalData?.nome}</span>
                          </div>
                      </div>
                      <ChevronRight className="text-gray-200" />
                  </div>
              )) : (
                  <div className="bg-white/50 border-2 border-dashed border-gray-200 rounded-[2.5rem] py-16 text-center">
                      <CalendarIcon size={40} className="mx-auto text-gray-200 mb-3" />
                      <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">Sem compromissos agendados</p>
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-ios-bg pb-20">
       <div className="bg-white/80 backdrop-blur-md px-5 pt-12 pb-4 sticky top-0 z-20 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <div className="flex gap-1">
                    <button onClick={() => handleNavigate('prev')} className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 active:scale-90 transition-all"><ChevronLeft size={20}/></button>
                    <button onClick={() => handleNavigate('next')} className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 active:scale-90 transition-all"><ChevronRight size={20}/></button>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight capitalize truncate">
                        {view === 'month' ? currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 
                         view === 'day' ? currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }) : 'Esta Semana'}
                    </h1>
                    <p className="text-gray-500 text-[9px] font-black uppercase tracking-[0.2em]">Minha Agenda</p>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                <div className="bg-gray-100 p-1 rounded-2xl flex shadow-inner">
                    <button onClick={() => setView('month')} className={`px-4 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest ${view === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>Mês</button>
                    <button onClick={() => setView('week')} className={`px-4 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest ${view === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>Semana</button>
                    <button onClick={() => setView('day')} className={`px-4 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest ${view === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>Dia</button>
                </div>
            </div>
      </div>

      <div className="p-5 max-w-7xl mx-auto space-y-6">
           {isProfessional && pendingAcceptance.length > 0 && (
               <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-2 px-1 text-cyan-700">
                        <AlertCircle size={16} />
                        <h2 className="text-[10px] font-black uppercase tracking-widest">Confirmações Pendentes ({pendingAcceptance.length})</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {pendingAcceptance.map(item => (
                            <div key={item.id} className="bg-white border border-cyan-100 rounded-[2rem] p-4 shadow-sm flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center overflow-hidden">
                                            {item.geral?.imagem ? <img src={item.geral.imagem} className="w-full h-full object-cover"/> : <Package size={20} className="text-cyan-400" />}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 text-xs leading-tight">{item.geral?.nome}</h3>
                                            <p className="text-[8px] font-black text-gray-400 uppercase">ID: {item.chaveData?.chaveunica}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-cyan-600 uppercase">Data</p>
                                        <p className="text-[10px] font-bold text-gray-900">{new Date(item.execucao).toLocaleDateString('pt-BR', {day:'2-digit', month:'short'})}</p>
                                    </div>
                                </div>
                                
                                <div className="bg-cyan-50/50 p-3 rounded-2xl border border-cyan-100/50 space-y-2">
                                    <div className="flex items-center text-gray-700">
                                        <Banknote size={14} className="mr-2 text-cyan-600" />
                                        <span className="text-[10px] font-black uppercase mr-1 text-gray-400">Ganhos:</span>
                                        <span className="text-xs font-black text-gray-900">R$ {item.orcamentoData?.preco.toFixed(2) || '0.00'}</span>
                                    </div>
                                    <div className="flex items-start text-gray-700">
                                        <MapPin size={14} className="mr-2 mt-0.5 text-cyan-600 flex-shrink-0" />
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-gray-400 block leading-none mb-1">Local do Serviço</span>
                                            <span className="text-[10px] font-bold text-gray-900 block leading-tight">{item.clienteData?.rua}, {item.clienteData?.numero}</span>
                                            <span className="text-[10px] text-gray-500">{item.clienteData?.bairro}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button disabled={processingId === item.id} onClick={() => handleDecision(item, true)} className="flex-[2] bg-black text-white py-2.5 rounded-xl font-black text-[9px] shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">{processingId === item.id ? <Loader2 size={12} className="animate-spin"/> : 'ACEITAR'}</button>
                                    <button disabled={processingId === item.id} onClick={() => handleDecision(item, false)} className="flex-1 bg-gray-50 text-red-500 py-2.5 rounded-xl font-black text-[9px] flex items-center justify-center active:scale-95 transition-all">RECUSAR</button>
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
                            <div className="grid grid-cols-7 mb-1">
                                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (<div key={day} className="text-center text-[9px] font-black text-gray-400 uppercase tracking-widest py-2">{day}</div>))}
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
            <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                             <h3 className="font-bold text-gray-900 text-lg leading-tight">{selectedEvent.geral?.nome}</h3>
                             {!isProfessional && <span className="bg-gray-100 text-gray-900 px-2 py-0.5 rounded-full text-[10px] font-black uppercase flex items-center"><Eye size={10} className="mr-1"/> Detalhes</span>}
                        </div>
                        <p className="text-xs text-gray-400 font-mono font-bold mt-0.5">#{selectedEvent.chaveData?.chaveunica}</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 transition-colors"><X size={20} /></button>
                </div>

                <div className="flex border-b border-gray-100 bg-white">
                    {(['geral', 'fotos', 'obs'] as ModalTab[]).map((tab) => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === tab ? 'text-ios-blue' : 'text-gray-400'}`}>{tab === 'geral' ? 'Informações' : tab === 'fotos' ? 'Execução' : 'Notas'}{activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}</button>
                    ))}
                </div>

                <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white no-scrollbar">
                    {activeTab === 'geral' && (
                        <div className="space-y-5">
                            <div className="bg-gray-50 p-5 rounded-[2rem] flex items-center justify-between border border-gray-100 shadow-sm">
                                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-white overflow-hidden shadow-sm border border-white"><img src={selectedEvent.clienteData?.fotoperfil || `https://ui-avatars.com/api/?name=${selectedEvent.clienteData?.nome}`} className="w-full h-full object-cover"/></div><div><p className="text-[10px] font-bold text-gray-400 uppercase">Cliente</p><p className="font-bold text-sm text-gray-900 leading-tight">{selectedEvent.clienteData?.nome}</p></div></div>
                                <div className="flex items-center gap-3 text-right"><div><p className="text-[10px] font-bold text-gray-400 uppercase">Profissional</p><p className="font-bold text-sm text-gray-900 leading-tight">{selectedEvent.profissionalData?.nome}</p></div><div className="w-10 h-10 rounded-full bg-white overflow-hidden shadow-sm border border-white"><img src={selectedEvent.profissionalData?.fotoperfil || `https://ui-avatars.com/api/?name=${selectedEvent.profissionalData?.nome}`} className="w-full h-full object-cover"/></div></div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Status do Pedido</label>
                                <select 
                                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm font-black text-gray-900 outline-none disabled:opacity-100 appearance-none shadow-sm" 
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
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Data e Hora</label>
                                <div className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <CalendarIcon size={16} className="text-ios-blue"/>
                                    {new Date(selectedEvent.execucao).toLocaleString('pt-BR')}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Descrição do Problema</label>
                                <div className="w-full bg-yellow-50/50 border border-yellow-100 rounded-2xl p-5 text-sm font-bold text-gray-800 leading-relaxed min-h-[80px]">{selectedEvent.planejamentoData?.descricao || "Sem detalhes adicionais."}</div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'fotos' && (
                        <div className="space-y-6">
                            <div>
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Fotos do 'Antes'</h4>
                                <div className="grid grid-cols-3 gap-2">
                                    {formData.fotoantes.map((url, i) => (
                                        <div key={i} className="aspect-square bg-gray-100 rounded-2xl overflow-hidden relative group">
                                            <img src={url} className="w-full h-full object-cover"/>
                                            {isProfessional && <button onClick={() => setFormData({...formData, fotoantes: formData.fotoantes.filter((_, idx) => idx !== i)})} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full shadow-lg"><Trash2 size={12} /></button>}
                                        </div>
                                    ))}
                                    {isProfessional && (
                                        <label className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors">
                                            <Camera size={20} className="text-gray-300"/>
                                            <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                                if (!e.target.files?.length) return;
                                                setUploading(true);
                                                const file = e.target.files[0];
                                                const path = `execucao/${selectedEvent.chaveData?.chaveunica}_depois_${Date.now()}.${file.name.split('.').pop()}`;
                                                await supabase.storage.from('imagens').upload(path, file);
                                                const { data } = supabase.storage.from('imagens').getPublicUrl(path);
                                                setFormData(prev => ({...prev, fotoantes: [...prev.fotoantes, data.publicUrl]}));
                                                setUploading(false);
                                            }} />
                                        </label>
                                    )}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Fotos da Conclusão</h4>
                                <div className="grid grid-cols-3 gap-2">
                                    {formData.fotodepois.map((url, i) => (
                                        <div key={i} className="aspect-square bg-gray-100 rounded-2xl overflow-hidden relative group">
                                            <img src={url} className="w-full h-full object-cover"/>
                                            {isProfessional && <button onClick={() => setFormData({...formData, fotodepois: formData.fotodepois.filter((_, idx) => idx !== i)})} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full shadow-lg"><Trash2 size={12} /></button>}
                                        </div>
                                    ))}
                                    {isProfessional && (
                                        <label className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors">
                                            <Camera size={20} className="text-gray-300"/>
                                            <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                                if (!e.target.files?.length) return;
                                                setUploading(true);
                                                const file = e.target.files[0];
                                                const path = `execucao/${selectedEvent.chaveData?.chaveunica}_depois_${Date.now()}.${file.name.split('.').pop()}`;
                                                await supabase.storage.from('imagens').upload(path, file);
                                                const { data } = supabase.storage.from('imagens').getPublicUrl(path);
                                                setFormData(prev => ({...prev, fotodepois: [...prev.fotodepois, data.publicUrl]}));
                                                setUploading(false);
                                            }} />
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'obs' && (
                        <div className="space-y-4">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Observações Internas</label>
                            {isProfessional ? (
                                <textarea 
                                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-5 text-sm font-bold text-gray-900 min-h-[150px] leading-relaxed outline-none focus:ring-2 focus:ring-ios-blue/30"
                                    value={formData.observacoes}
                                    onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                                    placeholder="Suas anotações sobre a execução deste serviço..."
                                />
                            ) : (
                                <div className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-5 text-sm font-bold text-gray-900 min-h-[150px] leading-relaxed">{formData.observacoes || "Nenhuma anotação registrada."}</div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 mt-auto flex gap-3">
                    <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-white border border-gray-200 text-gray-900 py-4 rounded-2xl font-bold shadow-sm active:scale-95 transition-all">Fechar</button>
                    {isProfessional && selectedEvent.chaveData?.status?.toLowerCase() !== 'concluido' && (
                        <button onClick={handleSave} disabled={saving} className="flex-[2] bg-black text-white py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex justify-center items-center gap-2">
                            {saving ? <Loader2 className="animate-spin" size={20}/> : 'SALVAR ALTERAÇÕES'}
                        </button>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Execution;
