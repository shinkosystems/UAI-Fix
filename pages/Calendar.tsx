
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Agenda, Geral } from '../types';
import { Loader2, ChevronLeft, ChevronRight, X, Clock, User, Wrench, Save, FileText, Calendar as CalendarIcon, MapPin, ExternalLink, Grid, Columns, List, Hash, Camera, Image as ImageIcon, Trash2, MessageSquare, AlertCircle } from 'lucide-react';

interface AgendaExtended extends Agenda {
    geral?: Geral;
    profissionalData?: { nome: string; fotoperfil: string; bairro?: string; fullCity?: string };
    clienteData?: { 
        nome: string; 
        fotoperfil: string; 
        rua?: string;
        numero?: string;
        complemento?: string;
        bairro?: string; 
        fullCity?: string 
    };
    ordemServico?: {
        id: number;
        status: string;
        datainicio: string;
        datafim?: string;
        pdf: string;
    };
    chaveData?: {
        id: number;
        status: string;
        chaveunica: string;
        fotoantes: string[];
        fotodepois: string[];
        atividade: number;
    };
    chaveStatus?: string;
    chaveUnica?: string;
}

type CalendarView = 'month' | 'week' | 'day';
type ModalTab = 'geral' | 'fotos' | 'obs';

const CalendarPage: React.FC = () => {
  const [events, setEvents] = useState<AgendaExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');
  
  const [selectedEvent, setSelectedEvent] = useState<AgendaExtended | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>('geral');
  
  const [formData, setFormData] = useState({
      status: '',
      datainicio: '',
      datafim: '',
      observacoes: '',
      fotoantes: [] as string[],
      fotodepois: [] as string[]
  });

  useEffect(() => {
    fetchAgenda();
  }, [currentDate, view]);

  const toLocalISOString = (dateStr: string) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      const offset = date.getTimezoneOffset() * 60000;
      const localDate = new Date(date.getTime() - offset);
      return localDate.toISOString().slice(0, 16);
  };

  const fetchAgenda = async () => {
    try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; 

        // 1. Verificar Tipo de Usuário
        const { data: userData } = await supabase
            .from('users')
            .select('tipo')
            .eq('uuid', user.id)
            .single();

        const userType = userData?.tipo?.toLowerCase() || '';
        const normalizedType = userType.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // Cargos internos veem tudo
        const isInternal = ['gestor', 'planejista', 'orcamentista'].includes(normalizedType);

        // 2. Construir Query
        let query = supabase.from('agenda').select('*');

        if (!isInternal) {
            // Se for Profissional ou Cliente, filtra apenas os seus
            query = query.or(`cliente.eq.${user.id},profissional.eq.${user.id}`);
        }

        const { data: agendaData, error: agendaError } = await query;

        if (agendaError) throw agendaError;
        
        if (!agendaData || agendaData.length === 0) {
            setEvents([]);
            return;
        }

        const chaveIds = agendaData.map((a: any) => a.chave).filter((id: any) => id);
        const userIds = new Set<string>();

        agendaData.forEach((a: any) => {
            if (a.cliente) userIds.add(a.cliente);
            if (a.profissional) userIds.add(a.profissional);
        });

        const [chavesRes, osRes, usersRes, estadosRes] = await Promise.all([
            chaveIds.length > 0 ? supabase.from('chaves').select('*').in('id', chaveIds) : { data: [] },
            chaveIds.length > 0 ? supabase.from('ordemservico').select('*').in('chave', chaveIds) : { data: [] },
            userIds.size > 0 ? supabase.from('users').select('uuid, nome, fotoperfil, rua, numero, complemento, bairro, cidade').in('uuid', Array.from(userIds)) : { data: [] },
            supabase.from('estados').select('*')
        ]);

        const chavesData = chavesRes.data || [];
        const osData = osRes.data || [];
        const usersData = usersRes.data || [];
        const estadosData = estadosRes.data || [];

        const cityIds = new Set<number>();
        usersData.forEach((u: any) => {
            if (u.cidade) cityIds.add(u.cidade);
        });

        const { data: citiesData } = await supabase
            .from('cidades')
            .select('*')
            .in('id', Array.from(cityIds));

        const serviceIds = new Set<number>();
        chavesData.forEach((c: any) => {
            if (c.atividade) serviceIds.add(c.atividade);
        });

        const { data: servicesData } = await supabase
            .from('geral')
            .select('*')
            .in('id', Array.from(serviceIds));
        
        const statesMap: Record<number, string> = {};
        estadosData.forEach((e: any) => statesMap[e.id] = e.uf);

        const citiesMap: Record<number, string> = {};
        citiesData?.forEach((c: any) => {
            const uf = statesMap[c.uf] || '';
            citiesMap[c.id] = uf ? `${c.cidade}, ${uf}` : c.cidade;
        });

        const chavesMap: Record<number, any> = {};
        chavesData.forEach((c: any) => chavesMap[c.id] = c);

        const osMap: Record<number, any> = {};
        osData.forEach((os: any) => osMap[os.chave] = os);

        const usersMap: Record<string, any> = {};
        usersData.forEach((u: any) => {
            usersMap[u.uuid] = {
                ...u,
                fullCity: u.cidade ? citiesMap[u.cidade] : 'Cidade não inf.'
            };
        });

        const servicesMap: Record<number, any> = {};
        servicesData?.forEach((s: any) => servicesMap[s.id] = s);

        const formattedEvents = agendaData.map((item: any) => {
            const chave = chavesMap[item.chave];
            const os = osMap[item.chave];
            const service = chave ? servicesMap[chave.atividade] : null;

            return {
                ...item,
                geral: service,
                chaveData: chave,
                chaveStatus: chave?.status,
                chaveUnica: chave?.chaveunica,
                ordemServico: os,
                profissionalData: usersMap[item.profissional],
                clienteData: usersMap[item.cliente]
            };
        });

        setEvents(formattedEvents);

    } catch (error) {
        console.error("Error fetching agenda:", error);
    } finally {
        setLoading(false);
    }
  };

  const handleNavigate = (offset: number) => {
      const newDate = new Date(currentDate);
      if (view === 'month') {
          newDate.setMonth(newDate.getMonth() + offset);
      } else if (view === 'week') {
          newDate.setDate(newDate.getDate() + (offset * 7));
      } else if (view === 'day') {
          newDate.setDate(newDate.getDate() + offset);
      }
      setCurrentDate(newDate);
  };

  const getHeaderText = () => {
      // Always return Month and Year as requested by user
      const month = currentDate.toLocaleDateString('pt-BR', { month: 'long' });
      const year = currentDate.getFullYear();
      // Capitalize first letter
      return `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
  };

  const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      return new Date(year, month, 1).getDay();
  };

  const getStartOfWeek = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day; 
      return new Date(d.setDate(diff));
  };

  const getEventsForDate = (date: Date) => {
      return events.filter(e => {
          const eDate = new Date(e.execucao);
          return eDate.getDate() === date.getDate() && 
                 eDate.getMonth() === date.getMonth() && 
                 eDate.getFullYear() === date.getFullYear();
      });
  };

  const handleEventClick = (event: AgendaExtended) => {
      setSelectedEvent(event);
      setFormData({
          status: event.chaveData?.status || 'pendente',
          datainicio: event.ordemServico?.datainicio 
            ? toLocalISOString(event.ordemServico.datainicio) 
            : toLocalISOString(event.execucao),
          datafim: event.ordemServico?.datafim 
            ? toLocalISOString(event.ordemServico.datafim) 
            : '',
          observacoes: event.observacoes || '',
          fotoantes: event.chaveData?.fotoantes || [],
          fotodepois: event.chaveData?.fotodepois || []
      });
      setActiveTab('geral');
      setIsModalOpen(true);
  };

  const handleDeleteImage = (indexToRemove: number, type: 'antes' | 'depois') => {
      if (!window.confirm("Deseja remover esta imagem?")) return;
      
      setFormData(prev => {
          const list = type === 'antes' ? prev.fotoantes : prev.fotodepois;
          const newList = list.filter((_, i) => i !== indexToRemove);
          return {
              ...prev,
              [type === 'antes' ? 'fotoantes' : 'fotodepois']: newList
          };
      });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'antes' | 'depois') => {
      if (!e.target.files || e.target.files.length === 0) return;
      setUploading(true);
      try {
          const file = e.target.files[0];
          const fileExt = file.name.split('.').pop();
          const fileName = `${selectedEvent?.chaveData?.chaveunica || 'agenda'}_${type}_${Date.now()}.${fileExt}`;
          const filePath = `imagens/${fileName}`;

          const { error: uploadError } = await supabase.storage.from('imagens').upload(filePath, file);
          if (uploadError) throw uploadError;

          const { data } = supabase.storage.from('imagens').getPublicUrl(filePath);
          
          if (type === 'antes') {
              setFormData(prev => ({ ...prev, fotoantes: [...prev.fotoantes, data.publicUrl] }));
          } else {
              setFormData(prev => ({ ...prev, fotodepois: [...prev.fotodepois, data.publicUrl] }));
          }
      } catch (error: any) {
          alert("Erro no upload: " + error.message);
      } finally {
          setUploading(false);
      }
  };

  const handleSave = async () => {
      if (!selectedEvent) return;
      setSaving(true);

      if (formData.status === 'executando' && (!formData.fotoantes || formData.fotoantes.length === 0)) {
          alert("REGRA DE EXECUÇÃO:\n\nPara alterar o status para 'Executando', é obrigatório registrar fotos do 'Antes'.\n\nPor favor, acesse a aba 'Fotos' e faça o upload.");
          setActiveTab('fotos');
          setSaving(false);
          return;
      }

      if (formData.status === 'concluido' && (!formData.fotodepois || formData.fotodepois.length === 0)) {
          alert("REGRA DE CONCLUSÃO:\n\nPara alterar o status para 'Concluído', é obrigatório registrar fotos do 'Depois' (Conclusão).\n\nPor favor, acesse a aba 'Fotos' e faça o upload.");
          setActiveTab('fotos');
          setSaving(false);
          return;
      }

      let finalDataFim = null;
      if (formData.status === 'concluido') {
          finalDataFim = formData.datafim ? new Date(formData.datafim).toISOString() : new Date().toISOString();
      } else {
          finalDataFim = null;
      }

      try {
          if (selectedEvent.chave) {
               const { error: chavesError } = await supabase.from('chaves').update({
                   status: formData.status,
                   fotoantes: formData.fotoantes,
                   fotodepois: formData.fotodepois
               }).eq('id', selectedEvent.chave);
               if (chavesError) throw chavesError;
          }

          const { error: agendaError } = await supabase.from('agenda').update({
              observacoes: formData.observacoes
          }).eq('id', selectedEvent.id);
          if (agendaError) throw agendaError;

          let osId = selectedEvent.ordemServico?.id;
          const osPayload = {
              status: formData.status,
              datainicio: formData.datainicio ? new Date(formData.datainicio).toISOString() : null,
              datafim: finalDataFim
          };

          if (osId) {
              await supabase.from('ordemservico').update(osPayload).eq('id', osId);
          } else if (selectedEvent.chave) {
              await supabase.from('ordemservico').insert({
                  chave: selectedEvent.chave,
                  ...osPayload
              });
          }

          await fetchAgenda();
          setIsModalOpen(false);
          alert('Dados atualizados com sucesso!');

      } catch (error: any) {
          console.error(error);
          alert('Erro ao salvar: ' + (error.message || JSON.stringify(error)));
      } finally {
          setSaving(false);
      }
  };

  const getStatusColor = (status: string | undefined) => {
      switch (status?.toLowerCase()) {
          case 'concluido': return 'bg-green-100 text-green-700 border-green-200';
          case 'executando': return 'bg-purple-100 text-purple-700 border-purple-200';
          case 'pendente': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
          case 'cancelado': return 'bg-red-100 text-red-700 border-red-200';
          default: return 'bg-blue-100 text-blue-700 border-blue-200';
      }
  };

  const renderMonthView = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

    return (
        <div className="bg-white rounded-[2rem] shadow-vitrified overflow-hidden border border-gray-100">
            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                    <div key={day} className="py-2 md:py-3 text-center text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">{day}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 auto-rows-fr bg-gray-100 gap-[1px]">
                {emptyDays.map(i => <div key={`empty-${i}`} className="bg-white min-h-[85px] p-2 bg-gray-50/30"></div>)}
                {daysArray.map(day => {
                    const currentDayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                    const dayEvents = getEventsForDate(currentDayDate);
                    const isToday = day === new Date().getDate() && 
                                    currentDate.getMonth() === new Date().getMonth() &&
                                    currentDate.getFullYear() === new Date().getFullYear();

                    return (
                        <div key={day} className={`bg-white min-h-[85px] p-1 transition-colors hover:bg-blue-50/30 relative group ${isToday ? 'bg-blue-50/10' : ''}`}>
                            <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-ios-blue text-white shadow-md' : 'text-gray-700'}`}>
                                {day}
                            </span>
                            <div className="space-y-1 overflow-y-auto max-h-[60px] no-scrollbar">
                                {dayEvents.map(event => (
                                    <button 
                                      key={event.id}
                                      onClick={() => handleEventClick(event)}
                                      className={`w-full text-left px-1.5 py-1 rounded-lg border text-[10px] font-medium truncate transition-transform hover:scale-[1.02] shadow-sm flex items-center gap-1 ${getStatusColor(event.chaveStatus)}`}
                                    >
                                        <div className={`w-1 h-1 rounded-full ${event.chaveStatus === 'concluido' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                        <span className="truncate flex-1">{event.geral?.nome}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  const renderWeekView = () => {
    const startOfWeek = getStartOfWeek(currentDate);
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return d;
    });

    return (
        <div className="bg-white rounded-[2rem] shadow-vitrified overflow-hidden border border-gray-100 h-[600px] flex flex-col">
            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
                {weekDays.map(date => {
                    const isToday = date.getDate() === new Date().getDate() && date.getMonth() === new Date().getMonth();
                    return (
                        <div key={date.toString()} className={`py-4 text-center border-r border-gray-100 last:border-0 ${isToday ? 'bg-blue-50/50' : ''}`}>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{date.toLocaleDateString('pt-BR', { weekday: 'short' })}</div>
                            <div className={`text-lg font-bold mt-1 ${isToday ? 'text-ios-blue' : 'text-gray-900'}`}>{date.getDate()}</div>
                        </div>
                    );
                })}
            </div>
            <div className="grid grid-cols-7 flex-1 bg-gray-50/20 divide-x divide-gray-100 overflow-y-auto">
                {weekDays.map(date => {
                    const dayEvents = getEventsForDate(date);
                    return (
                        <div key={date.toString()} className="min-h-full p-2 space-y-2">
                            {dayEvents.map(event => (
                                <button 
                                  key={event.id}
                                  onClick={() => handleEventClick(event)}
                                  className={`w-full text-left p-3 rounded-xl border text-xs font-medium shadow-sm flex flex-col gap-1 transition-all hover:shadow-md ${getStatusColor(event.chaveStatus)}`}
                                >
                                    <div className="flex justify-between items-center w-full">
                                        <span className="font-bold opacity-80">{new Date(event.execucao).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
                                        <div className={`w-2 h-2 rounded-full ${event.chaveStatus === 'concluido' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                    </div>
                                    <span className="font-bold truncate w-full">{event.geral?.nome}</span>
                                    <span className="truncate opacity-70">{event.clienteData?.nome || event.profissionalData?.nome}</span>
                                </button>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  const renderDayView = () => {
      const hours = Array.from({ length: 17 }, (_, i) => i + 6);
      const dayEvents = getEventsForDate(currentDate);
      return (
          <div className="bg-white rounded-[2rem] shadow-vitrified overflow-hidden border border-gray-100">
              <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex justify-center">
                  <div className="flex flex-col items-center">
                      <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">{currentDate.toLocaleDateString('pt-BR', { weekday: 'long' })}</span>
                      <span className="text-3xl font-bold text-gray-900">{currentDate.getDate()}</span>
                  </div>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                  {hours.map(hour => {
                      const hourEvents = dayEvents.filter(e => {
                          const h = new Date(e.execucao).getHours();
                          return h === hour;
                      });
                      return (
                          <div key={hour} className="flex border-b border-gray-50 min-h-[80px] group hover:bg-gray-50/30 transition-colors">
                              <div className="w-20 py-4 pr-4 text-right border-r border-gray-100 text-xs font-bold text-gray-400 flex-shrink-0">{hour}:00</div>
                              <div className="flex-1 p-2 relative">
                                  {hourEvents.map(event => (
                                      <button 
                                        key={event.id}
                                        onClick={() => handleEventClick(event)}
                                        className={`absolute left-2 right-2 top-1 bottom-1 p-3 rounded-xl border text-sm font-medium shadow-sm flex items-center justify-between transition-all hover:scale-[1.01] hover:z-10 ${getStatusColor(event.chaveStatus)}`}
                                      >
                                          <div className="flex items-center gap-3">
                                               <div className={`w-1.5 h-8 rounded-full ${event.chaveStatus === 'concluido' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                               <div className="flex flex-col text-left">
                                                   <span className="font-bold">{event.geral?.nome}</span>
                                                   <span className="text-xs opacity-70 flex items-center"><User size={10} className="mr-1"/>{event.clienteData?.nome || event.profissionalData?.nome}</span>
                                               </div>
                                          </div>
                                          <div className="flex flex-col items-end text-xs opacity-70">
                                              <span>{new Date(event.execucao).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
                                              <span className="uppercase font-bold text-[10px] border border-current px-1 rounded">{event.chaveStatus}</span>
                                          </div>
                                      </button>
                                  ))}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  if (loading && events.length === 0) {
      return (
          <div className="min-h-screen bg-ios-bg flex items-center justify-center">
              <Loader2 className="animate-spin text-ios-blue" size={32} />
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-ios-bg pb-20">
       <div className="bg-white/80 backdrop-blur-md px-4 pt-4 pb-2 sticky top-0 z-20 border-b border-gray-200 flex flex-col justify-between gap-2">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{getHeaderText()}</h1>
                    <div className="flex items-center mt-1">
                        <p className="text-gray-500 text-sm mt-3 hidden md:block">Gerencie seus agendamentos.</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <div className="bg-gray-100 p-1 rounded-xl flex shadow-inner">
                        <button onClick={() => setView('month')} className={`p-1.5 rounded-lg transition-all flex items-center gap-2 text-sm font-bold ${view === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Grid size={16} /><span className="hidden md:inline">Mês</span></button>
                        <button onClick={() => setView('week')} className={`p-1.5 rounded-lg transition-all flex items-center gap-2 text-sm font-bold ${view === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Columns size={16} /><span className="hidden md:inline">Semana</span></button>
                        <button onClick={() => setView('day')} className={`p-1.5 rounded-lg transition-all flex items-center gap-2 text-sm font-bold ${view === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><List size={16} /><span className="hidden md:inline">Dia</span></button>
                    </div>
                    <div className="flex items-center space-x-2 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                        <button onClick={() => handleNavigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft size={20} /></button>
                        <button onClick={() => setCurrentDate(new Date())} className="text-xs font-bold uppercase px-3 py-1.5 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200">Hoje</button>
                        <button onClick={() => handleNavigate(1)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><ChevronRight size={20} /></button>
                    </div>
                </div>
            </div>
            <p className="text-gray-500 text-xs md:hidden mt-3">Gerencie seus agendamentos.</p>
      </div>

      <div className="p-2 md:p-5 max-w-7xl mx-auto">
          {view === 'month' && renderMonthView()}
          {view === 'week' && renderWeekView()}
          {view === 'day' && renderDayView()}
      </div>

      {isModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg">Detalhes do Serviço</h3>
                        <div className="flex items-center mt-1">
                             <div className="bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200 flex items-center">
                                 <Hash size={12} className="text-gray-400 mr-1"/>
                                 <span className="text-sm font-black font-mono text-gray-700">{selectedEvent.chaveUnica || 'N/A'}</span>
                             </div>
                        </div>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex border-b border-gray-100">
                    <button onClick={() => setActiveTab('geral')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'geral' ? 'border-ios-blue text-ios-blue' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Geral</button>
                    <button onClick={() => setActiveTab('fotos')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'fotos' ? 'border-ios-blue text-ios-blue' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Fotos</button>
                    <button onClick={() => setActiveTab('obs')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'obs' ? 'border-ios-blue text-ios-blue' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Anotações</button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    {activeTab === 'geral' && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 flex items-center space-x-3">
                                     <div className="w-10 h-10 rounded-full bg-white flex-shrink-0 overflow-hidden border border-gray-200">
                                         <img src={selectedEvent.clienteData?.fotoperfil || `https://ui-avatars.com/api/?name=${selectedEvent.clienteData?.nome || 'C'}`} className="w-full h-full object-cover"/>
                                     </div>
                                     <div className="overflow-hidden">
                                         <p className="text-[10px] font-bold text-gray-400 uppercase">Cliente</p>
                                         <p className="text-sm font-bold text-gray-900 truncate">{selectedEvent.clienteData?.nome}</p>
                                     </div>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 flex items-center space-x-3">
                                     <div className="w-10 h-10 rounded-full bg-white flex-shrink-0 overflow-hidden border border-gray-200">
                                         <img src={selectedEvent.profissionalData?.fotoperfil || `https://ui-avatars.com/api/?name=${selectedEvent.profissionalData?.nome || 'P'}`} className="w-full h-full object-cover"/>
                                     </div>
                                     <div className="overflow-hidden">
                                         <p className="text-[10px] font-bold text-gray-400 uppercase">Profissional</p>
                                         <p className="text-sm font-bold text-gray-900 truncate">{selectedEvent.profissionalData?.nome}</p>
                                     </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-2 border-t border-gray-100">
                                <div className="flex items-center space-x-2 text-gray-900 font-bold">
                                    <Wrench size={18} />
                                    <span>Status e Datas</span>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Status</label>
                                    <select 
                                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-medium outline-none appearance-none capitalize"
                                        value={formData.status}
                                        onChange={(e) => setFormData({...formData, status: e.target.value})}
                                    >
                                        <option value="pendente">Pendente</option>
                                        <option value="executando">Executando</option>
                                        <option value="concluido">Concluído</option>
                                        <option value="cancelado">Cancelado</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Início Real</label>
                                        <input 
                                            type="datetime-local"
                                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-3 text-xs font-medium outline-none focus:ring-2 focus:ring-ios-blue/30"
                                            value={formData.datainicio}
                                            onChange={(e) => setFormData({...formData, datainicio: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Fim (Previsão/Real)</label>
                                        <input 
                                            type="datetime-local"
                                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-3 text-xs font-medium outline-none focus:ring-2 focus:ring-ios-blue/30"
                                            value={formData.datafim}
                                            onChange={(e) => setFormData({...formData, datafim: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'fotos' && (
                        <div className="space-y-6">
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Fotos Antes (Obrigatório para iniciar)</h4>
                                <div className="grid grid-cols-3 gap-2">
                                    {formData.fotoantes.map((url, i) => (
                                        <div key={i} className="aspect-square bg-gray-100 rounded-xl overflow-hidden relative group">
                                            <img src={url} className="w-full h-full object-cover"/>
                                            <button 
                                                onClick={() => handleDeleteImage(i, 'antes')}
                                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-md"
                                                title="Excluir imagem"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    <label className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                                        {uploading ? <Loader2 className="animate-spin text-blue-500"/> : <><Camera size={24} className="text-gray-400"/><span className="text-[10px] text-gray-400 mt-1">Adicionar</span></>}
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'antes')} disabled={uploading}/>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Fotos Depois (Obrigatório para concluir)</h4>
                                <div className="grid grid-cols-3 gap-2">
                                    {formData.fotodepois.map((url, i) => (
                                        <div key={i} className="aspect-square bg-gray-100 rounded-xl overflow-hidden relative group">
                                            <img src={url} className="w-full h-full object-cover"/>
                                            <button 
                                                onClick={() => handleDeleteImage(i, 'depois')}
                                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-md"
                                                title="Excluir imagem"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    <label className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                                        {uploading ? <Loader2 className="animate-spin text-blue-500"/> : <><Camera size={24} className="text-gray-400"/><span className="text-[10px] text-gray-400 mt-1">Adicionar</span></>}
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'depois')} disabled={uploading}/>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'obs' && (
                        <div className="space-y-4">
                            <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-2xl flex items-start space-x-3">
                                <MessageSquare size={20} className="text-yellow-500 mt-1" />
                                <div>
                                    <h4 className="font-bold text-yellow-800 text-sm">Anotações da Agenda</h4>
                                    <p className="text-xs text-yellow-700 mt-1">Use este espaço para registrar observações sobre a execução, imprevistos ou detalhes importantes.</p>
                                </div>
                            </div>
                            <textarea 
                                className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm font-medium outline-none resize-none min-h-[200px] focus:ring-2 focus:ring-yellow-200"
                                placeholder="Digite suas observações aqui..."
                                value={formData.observacoes}
                                onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                            />
                        </div>
                    )}

                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 mt-auto">
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full bg-black text-white py-4 rounded-2xl font-bold shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex justify-center items-center disabled:opacity-70 disabled:scale-100 space-x-2"
                    >
                        {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18} /><span>Salvar Alterações</span></>}
                    </button>
                </div>

            </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
