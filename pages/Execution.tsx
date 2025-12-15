
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Agenda, Geral } from '../types';
import { Loader2, ChevronLeft, ChevronRight, X, Clock, User, Save, Calendar as CalendarIcon, MapPin, Grid, Columns, List, Camera, Plus, Trash2, CheckCircle, AlertTriangle, FileText, Package } from 'lucide-react';

interface AgendaExtended extends Agenda {
    geral?: Geral;
    profissionalData?: { nome: string; fotoperfil: string };
    clienteData?: { nome: string; fotoperfil: string; fullCity?: string };
    // Dados completos para edição
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
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');
  
  // Modal State
  const [selectedEvent, setSelectedEvent] = useState<AgendaExtended | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>('geral');
  const [uploading, setUploading] = useState(false);
  
  // Edit Form State
  const [formData, setFormData] = useState({
      status: '',
      descricao: '', // Agenda Obs
      planDescricao: '', // Planning Desc
      recursos: [] as string[],
      fotoantes: [] as string[],
      fotodepois: [] as string[],
      newResource: ''
  });

  useEffect(() => {
    fetchAgenda();
  }, [currentDate, view]);

  const fetchAgenda = async () => {
    try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; 

        // 1. Fetch Agenda items
        const { data: agendaData, error: agendaError } = await supabase
            .from('agenda')
            .select('*')
            .or(`cliente.eq.${user.id},profissional.eq.${user.id}`);

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

        const formattedEvents = agendaData.map((item: any) => {
            const chave = chavesMap[item.chave];
            const os = osMap[item.chave];
            const plan = planMap[item.chave];
            const service = chave ? servicesMap[chave.atividade] : null;

            return {
                ...item,
                geral: service,
                chaveData: chave,
                ordemServico: os,
                planejamentoData: plan,
                profissionalData: usersMap[item.profissional],
                clienteData: usersMap[item.cliente]
            };
        });

        setEvents(formattedEvents);

    } catch (error) {
        console.error("Error fetching execution data:", error);
    } finally {
        setLoading(false);
    }
  };

  const handleEventClick = (event: AgendaExtended) => {
      setSelectedEvent(event);
      // Initialize Form Data with current values
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

  const handleAddResource = () => {
      if (formData.newResource.trim()) {
          setFormData(prev => ({
              ...prev,
              recursos: [...prev.recursos, prev.newResource.trim()],
              newResource: ''
          }));
      }
  };

  const handleRemoveResource = (idx: number) => {
      setFormData(prev => ({
          ...prev,
          recursos: prev.recursos.filter((_, i) => i !== idx)
      }));
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
          const fileName = `${selectedEvent?.chaveData?.chaveunica || 'exec'}_${type}_${Date.now()}.${fileExt}`;
          
          // Alterado para salvar na pasta 'imagens'
          const filePath = `imagens/${fileName}`;

          // Alterado para usar o bucket 'imagens'
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

      // --- VALIDAÇÃO DE REGRAS DE NEGÓCIO ---
      
      // 1. Obrigatório fotos antes para mudar para Executando
      if (formData.status === 'executando' && (!formData.fotoantes || formData.fotoantes.length === 0)) {
          alert("REGRA DE EXECUÇÃO:\n\nPara alterar o status para 'Executando', é obrigatório registrar fotos do 'Antes'.\n\nPor favor, acesse a aba 'Fotos' e faça o upload.");
          setActiveTab('fotos');
          setSaving(false);
          return;
      }

      // 2. Obrigatório fotos depois para mudar para Concluído
      if (formData.status === 'concluido' && (!formData.fotodepois || formData.fotodepois.length === 0)) {
          alert("REGRA DE CONCLUSÃO:\n\nPara alterar o status para 'Concluído', é obrigatório registrar fotos do 'Depois' (Conclusão).\n\nPor favor, acesse a aba 'Fotos' e faça o upload.");
          setActiveTab('fotos');
          setSaving(false);
          return;
      }

      // 3. Obrigatório motivo para Cancelado
      if (formData.status === 'cancelado') {
          const motivo = formData.descricao?.trim();
          if (!motivo || motivo.length < 10) {
              alert("REGRA DE CANCELAMENTO:\n\nPara cancelar o serviço, é obrigatório informar o motivo detalhado no campo 'Anotações'.\n\nPor favor, digite uma justificativa com pelo menos 10 caracteres.");
              setActiveTab('obs');
              setSaving(false);
              return;
          }
      }

      try {
          // 1. Update Chaves (Status, Photos)
          if (selectedEvent.chaveData) {
              await supabase.from('chaves').update({
                  status: formData.status,
                  fotoantes: formData.fotoantes,
                  fotodepois: formData.fotodepois
              }).eq('id', selectedEvent.chaveData.id);
          }

          // 2. Update Agenda (Observations/Notes)
          // Registra as anotações (que incluem o motivo em caso de cancelamento)
          await supabase.from('agenda').update({
              observacoes: formData.descricao
          }).eq('id', selectedEvent.id);

          // 3. Update Planejamento (Resources, Description)
          if (selectedEvent.planejamentoData) {
              await supabase.from('planejamento').update({
                  descricao: formData.planDescricao,
                  recursos: formData.recursos
              }).eq('id', selectedEvent.planejamentoData.id);
          }

          // 4. Update OrdemServico Status sync
          if (selectedEvent.ordemServico) {
               await supabase.from('ordemservico').update({
                   status: formData.status
               }).eq('id', selectedEvent.ordemServico.id);
          }

          await fetchAgenda();
          setIsModalOpen(false);
          alert("Dados e status atualizados com sucesso!");
      } catch (error: any) {
          console.error(error);
          alert("Erro ao salvar: " + error.message);
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

  const handleNavigate = (offset: number) => {
      const newDate = new Date(currentDate);
      if (view === 'month') newDate.setMonth(newDate.getMonth() + offset);
      else if (view === 'week') newDate.setDate(newDate.getDate() + (offset * 7));
      else newDate.setDate(newDate.getDate() + offset);
      setCurrentDate(newDate);
  };

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const getEventsForDate = (date: Date) => events.filter(e => {
      const eDate = new Date(e.execucao);
      return eDate.getDate() === date.getDate() && eDate.getMonth() === date.getMonth() && eDate.getFullYear() === date.getFullYear();
  });

  const getStartOfWeek = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day; // adjust when day is sunday
      return new Date(d.setDate(diff));
  };

  const getHeaderText = () => {
      if (view === 'day') {
          return currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
      }
      if (view === 'week') {
          const start = getStartOfWeek(currentDate);
          const end = new Date(start);
          end.setDate(end.getDate() + 6);
          const startStr = start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
          const endStr = end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
          return `${startStr} - ${endStr}`;
      }
      // Month
      return currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  if (loading && events.length === 0) {
      return ( <div className="min-h-screen bg-ios-bg flex items-center justify-center"><Loader2 className="animate-spin text-ios-blue" size={32} /></div> );
  }

  return (
    <div className="min-h-screen bg-ios-bg pb-20">
       {/* Header Controls */}
       <div className="bg-white/80 backdrop-blur-md px-5 pt-12 pb-4 sticky top-0 z-20 border-b border-gray-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight capitalize truncate">{getHeaderText()}</h1>
                <p className="text-gray-500 text-sm mt-1">Gerencie seus agendamentos.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
                <div className="bg-gray-100 p-1 rounded-xl flex shadow-inner">
                    <button onClick={() => setView('month')} className={`p-2 rounded-lg transition-all flex items-center gap-2 text-sm font-bold ${view === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Grid size={16} /><span className="hidden md:inline">Mês</span></button>
                    <button onClick={() => setView('week')} className={`p-2 rounded-lg transition-all flex items-center gap-2 text-sm font-bold ${view === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Columns size={16} /><span className="hidden md:inline">Semana</span></button>
                    <button onClick={() => setView('day')} className={`p-2 rounded-lg transition-all flex items-center gap-2 text-sm font-bold ${view === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><List size={16} /><span className="hidden md:inline">Dia</span></button>
                </div>
                <div className="flex items-center space-x-2 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                    <button onClick={() => handleNavigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft size={20} /></button>
                    <button onClick={() => setCurrentDate(new Date())} className="text-xs font-bold uppercase px-3 py-1.5 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200">Hoje</button>
                    <button onClick={() => handleNavigate(1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight size={20} /></button>
                </div>
            </div>
      </div>

      <div className="p-5 max-w-7xl mx-auto">
          {/* Reuse basic calendar grid logic from CalendarPage but simplified for brevity in this response */}
           <div className="bg-white rounded-[2rem] shadow-vitrified overflow-hidden border border-gray-100">
            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                    <div key={day} className="py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">{day}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 auto-rows-fr bg-gray-100 gap-[1px]">
                {Array.from({ length: getFirstDayOfMonth(currentDate) }).map((_, i) => <div key={`e-${i}`} className="bg-white min-h-[100px]"></div>)}
                {Array.from({ length: getDaysInMonth(currentDate) }, (_, i) => i + 1).map(day => {
                     const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                     const dayEvents = getEventsForDate(date);
                     return (
                         <div key={day} className="bg-white min-h-[100px] p-2 hover:bg-blue-50/30">
                             <span className="text-sm font-semibold text-gray-700">{day}</span>
                             <div className="space-y-1 mt-1">
                                 {dayEvents.map(ev => (
                                     <button key={ev.id} onClick={() => handleEventClick(ev)} className={`w-full text-left px-2 py-1 rounded-md text-[10px] font-bold truncate border ${getStatusColor(ev.chaveData?.status)}`}>
                                         {ev.geral?.nome}
                                     </button>
                                 ))}
                             </div>
                         </div>
                     )
                })}
            </div>
          </div>
      </div>

      {/* --- EXECUTION SUPER MODAL --- */}
      {isModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                            {selectedEvent.geral?.nome}
                            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase border ${getStatusColor(formData.status)}`}>{formData.status}</span>
                        </h3>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">Chave: {selectedEvent.chaveData?.chaveunica}</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100">
                    <button onClick={() => setActiveTab('geral')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'geral' ? 'border-ios-blue text-ios-blue' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Geral</button>
                    <button onClick={() => setActiveTab('recursos')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'recursos' ? 'border-ios-blue text-ios-blue' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Recursos</button>
                    <button onClick={() => setActiveTab('fotos')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'fotos' ? 'border-ios-blue text-ios-blue' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Fotos</button>
                    <button onClick={() => setActiveTab('obs')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'obs' ? 'border-ios-blue text-ios-blue' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Anotações</button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    
                    {activeTab === 'geral' && (
                        <div className="space-y-4">
                            <div className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white overflow-hidden"><img src={selectedEvent.clienteData?.fotoperfil} className="w-full h-full object-cover"/></div>
                                    <div><p className="text-xs font-bold text-gray-400 uppercase">Cliente</p><p className="font-bold">{selectedEvent.clienteData?.nome}</p></div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white overflow-hidden"><img src={selectedEvent.profissionalData?.fotoperfil} className="w-full h-full object-cover"/></div>
                                    <div className="text-right"><p className="text-xs font-bold text-gray-400 uppercase">Profissional</p><p className="font-bold">{selectedEvent.profissionalData?.nome}</p></div>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Alterar Status</label>
                                <select 
                                    className="w-full bg-white border border-gray-200 rounded-2xl p-4 text-sm font-bold outline-none appearance-none text-black"
                                    value={formData.status}
                                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                                >
                                    <option value="pendente">Pendente</option>
                                    <option value="executando">Executando</option>
                                    <option value="concluido">Concluído</option>
                                    <option value="cancelado">Cancelado</option>
                                </select>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Descrição do Serviço</label>
                                <textarea 
                                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-medium outline-none resize-none min-h-[100px] text-black"
                                    value={formData.planDescricao}
                                    onChange={(e) => setFormData({...formData, planDescricao: e.target.value})}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'recursos' && (
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <input 
                                    className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl p-3 text-sm outline-none text-black"
                                    placeholder="Novo recurso/material..."
                                    value={formData.newResource}
                                    onChange={(e) => setFormData({...formData, newResource: e.target.value})}
                                />
                                <button onClick={handleAddResource} className="bg-black text-white p-3 rounded-2xl"><Plus size={20}/></button>
                            </div>
                            <div className="space-y-2">
                                {formData.recursos.map((res, i) => (
                                    <div key={i} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <span className="text-sm font-medium">{res}</span>
                                        <button onClick={() => handleRemoveResource(i)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                                {formData.recursos.length === 0 && <p className="text-center text-gray-400 text-sm py-4">Nenhum recurso listado.</p>}
                            </div>
                        </div>
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
                                    <label className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400">
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
                                    <label className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400">
                                        {uploading ? <Loader2 className="animate-spin text-blue-500"/> : <><Camera size={24} className="text-gray-400"/><span className="text-[10px] text-gray-400 mt-1">Adicionar</span></>}
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'depois')} disabled={uploading}/>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'obs' && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Observações da Agenda / Motivo do Cancelamento</label>
                            <textarea 
                                className="w-full bg-yellow-50 border border-yellow-100 rounded-2xl p-4 text-sm font-medium outline-none resize-none min-h-[200px] text-black"
                                placeholder="Anotações gerais ou justificativa de cancelamento..."
                                value={formData.descricao}
                                onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 mt-auto">
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full bg-black text-white py-4 rounded-2xl font-bold shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex justify-center items-center disabled:opacity-70 disabled:scale-100 space-x-2"
                    >
                        {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18} /><span>Salvar Tudo</span></>}
                    </button>
                </div>

            </div>
        </div>
      )}
    </div>
  );
};

export default Execution;
