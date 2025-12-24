
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Agenda, Geral } from '../types';
import { Loader2, ChevronLeft, ChevronRight, X, Clock, User, Wrench, Save, FileText, Calendar as CalendarIcon, MapPin, ExternalLink, Grid, Columns, List, Hash, Camera, Image as ImageIcon, Trash2, MessageSquare, AlertCircle, PlayCircle, CheckCircle2, Lock, Eye } from 'lucide-react';

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
  const [userType, setUserType] = useState<string>('');
  
  const [selectedEvent, setSelectedEvent] = useState<AgendaExtended | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>('geral');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  
  const [formData, setFormData] = useState({
      status: '',
      datainicio: '',
      datafim: '',
      observacoes: '',
      fotoantes: [] as string[],
      fotodepois: [] as string[]
  });

  useEffect(() => {
    fetchUserType();
    fetchAgenda();
  }, [currentDate, view]);

  const fetchUserType = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
          const { data } = await supabase.from('users').select('tipo').eq('uuid', user.id).single();
          if (data) setUserType(data.tipo || '');
      }
  };

  const isProfessional = userType.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 'profissional';

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
        
        setCurrentUserId(user.id);

        const { data: userData } = await supabase.from('users').select('tipo').eq('uuid', user.id).single();
        const type = userData?.tipo?.toLowerCase() || '';
        const normType = type.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const isInternal = ['gestor', 'planejista', 'orcamentista'].includes(normType);

        let query = supabase.from('agenda').select('*');
        if (!isInternal) query = query.or(`cliente.eq.${user.id},profissional.eq.${user.id}`);

        const { data: agendaData, error: agendaError } = await query;
        if (agendaError) throw agendaError;
        if (!agendaData || agendaData.length === 0) { setEvents([]); return; }

        const chaveIds = agendaData.map((a: any) => a.chave).filter((id: any) => id);
        const userIds = new Set<string>();
        agendaData.forEach((a: any) => { if (a.cliente) userIds.add(a.cliente); if (a.profissional) userIds.add(a.profissional); });

        const [chavesRes, osRes, usersRes, estadosRes] = await Promise.all([
            chaveIds.length > 0 ? supabase.from('chaves').select('*').in('id', chaveIds) : { data: [] },
            chaveIds.length > 0 ? supabase.from('ordemservico').select('*').in('chave', chaveIds) : { data: [] },
            userIds.size > 0 ? supabase.from('users').select('uuid, nome, fotoperfil, rua, numero, complemento, bairro, cidade').in('uuid', Array.from(userIds)) : { data: [] },
            supabase.from('estados').select('*')
        ]);

        const cityIds = new Set<number>();
        usersRes.data?.forEach((u: any) => { if (u.cidade) cityIds.add(u.cidade); });
        const { data: citiesData } = await supabase.from('cidades').select('*').in('id', Array.from(cityIds));

        const serviceIds = new Set<number>();
        chavesRes.data?.forEach((c: any) => { if (c.atividade) serviceIds.add(c.atividade); });
        const { data: servicesData } = await supabase.from('geral').select('*').in('id', Array.from(serviceIds));
        
        const statesMap: Record<number, string> = {};
        estadosRes.data?.forEach((e: any) => statesMap[e.id] = e.uf);
        const citiesMap: Record<number, string> = {};
        citiesData?.forEach((c: any) => { const uf = statesMap[c.uf] || ''; citiesMap[c.id] = uf ? `${c.cidade}, ${uf}` : c.cidade; });
        const chavesMap: Record<number, any> = {};
        chavesRes.data?.forEach((c: any) => chavesMap[c.id] = c);
        const osMap: Record<number, any> = {};
        osRes.data?.forEach((os: any) => osMap[os.chave] = os);
        const usersMap: Record<string, any> = {};
        usersRes.data?.forEach((u: any) => { usersMap[u.uuid] = { ...u, fullCity: u.cidade ? citiesMap[u.cidade] : 'N/A' }; });
        const servicesMap: Record<number, any> = {};
        servicesData?.forEach((s: any) => servicesMap[s.id] = s);

        const formattedEvents = agendaData.map((item: any) => {
            const chave = chavesMap[item.chave];
            return {
                ...item,
                geral: chave ? servicesMap[chave.atividade] : null,
                chaveData: chave,
                chaveStatus: chave?.status,
                chaveUnica: chave?.chaveunica,
                ordemServico: osMap[item.chave],
                profissionalData: usersMap[item.profissional],
                clienteData: usersMap[item.cliente]
            };
        });
        setEvents(formattedEvents);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleNavigate = (offset: number) => {
      const newDate = new Date(currentDate);
      if (view === 'month') newDate.setMonth(newDate.getMonth() + offset);
      else if (view === 'week') newDate.setDate(newDate.getDate() + (offset * 7));
      else newDate.setDate(newDate.getDate() + offset);
      setCurrentDate(newDate);
  };

  const getHeaderText = () => currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const getEventsForDate = (date: Date) => events.filter(e => { const eDate = new Date(e.execucao); return eDate.getDate() === date.getDate() && eDate.getMonth() === date.getMonth() && eDate.getFullYear() === date.getFullYear(); });

  const handleEventClick = (event: AgendaExtended) => {
      setSelectedEvent(event);
      setFormData({
          status: event.chaveData?.status || 'pendente',
          datainicio: event.ordemServico?.datainicio ? toLocalISOString(event.ordemServico.datainicio) : toLocalISOString(event.execucao),
          datafim: event.ordemServico?.datafim ? toLocalISOString(event.ordemServico.datafim) : '',
          observacoes: event.observacoes || '',
          fotoantes: event.chaveData?.fotoantes || [],
          fotodepois: event.chaveData?.fotodepois || []
      });
      setActiveTab('geral');
      setIsModalOpen(true);
  };

  const handleDeleteImage = (e: React.MouseEvent, indexToRemove: number, type: 'antes' | 'depois') => {
      e.stopPropagation();
      if (!isProfessional) return;
      if (!window.confirm("Remover imagem?")) return;
      setFormData(prev => ({ ...prev, [type === 'antes' ? 'fotoantes' : 'fotodepois']: prev[type === 'antes' ? 'fotoantes' : 'fotodepois'].filter((_, i) => i !== indexToRemove) }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'antes' | 'depois') => {
      if (!isProfessional || !e.target.files?.length) return;
      setUploading(true);
      try {
          const file = e.target.files[0];
          const path = `imagens/${selectedEvent?.chaveData?.chaveunica || 'ag'}_${type}_${Date.now()}.${file.name.split('.').pop()}`;
          const { error } = await supabase.storage.from('imagens').upload(path, file);
          if (error) throw error;
          const { data } = supabase.storage.from('imagens').getPublicUrl(path);
          setFormData(prev => ({ ...prev, [type === 'antes' ? 'fotoantes' : 'fotodepois']: [...prev[type === 'antes' ? 'fotoantes' : 'fotodepois'], data.publicUrl] }));
      } catch (error: any) { alert(error.message); } finally { setUploading(false); }
  };

  const handleSave = async () => {
      if (!selectedEvent || !isProfessional) return;
      setSaving(true);
      
      if (formData.status === 'executando' && !formData.fotoantes.length) { alert("Fotos do 'Antes' obrigatórias."); setActiveTab('fotos'); setSaving(false); return; }
      if (formData.status === 'concluido' && !formData.fotodepois.length) { alert("Fotos do 'Depois' obrigatórias."); setActiveTab('fotos'); setSaving(false); return; }

      try {
          if (selectedEvent.chave) await supabase.from('chaves').update({ status: formData.status, fotoantes: formData.fotoantes, fotodepois: formData.fotodepois }).eq('id', selectedEvent.chave);
          await supabase.from('agenda').update({ observacoes: formData.observacoes }).eq('id', selectedEvent.id);
          const osPayload = { status: formData.status, datainicio: formData.datainicio ? new Date(formData.datainicio).toISOString() : null, datafim: formData.status === 'concluido' ? (formData.datafim ? new Date(formData.datafim).toISOString() : new Date().toISOString()) : null };
          if (selectedEvent.ordemServico) await supabase.from('ordemservico').update(osPayload).eq('id', selectedEvent.ordemServico.id);
          else if (selectedEvent.chave) await supabase.from('ordemservico').insert({ chave: selectedEvent.chave, ...osPayload });
          
          await fetchAgenda();
          setIsModalOpen(false);
          alert('Atualizado!');
      } catch (error: any) { alert(error.message); } finally { setSaving(false); }
  };

  const getStatusColor = (s: string | undefined) => {
      switch (s?.toLowerCase()) {
          case 'concluido': return 'bg-green-100 text-green-900 border-green-200';
          case 'executando': return 'bg-purple-100 text-purple-900 border-purple-200';
          case 'cancelado': return 'bg-red-100 text-red-900 border-red-200';
          default: return 'bg-blue-100 text-blue-900 border-blue-200';
      }
  };

  return (
    <div className="min-h-screen bg-ios-bg pb-20">
       <div className="bg-white/80 backdrop-blur-md px-4 pt-4 pb-2 sticky top-0 z-20 border-b border-gray-200 flex flex-col gap-2">
            <div className="flex items-start justify-between">
                <div><h1 className="text-2xl font-bold text-gray-900 tracking-tight capitalize">{getHeaderText()}</h1></div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <div className="bg-gray-100 p-1 rounded-xl flex shadow-inner">
                        <button onClick={() => setView('month')} className={`p-1.5 rounded-lg text-sm font-bold ${view === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}><Grid size={16} /></button>
                        <button onClick={() => setView('week')} className={`p-1.5 rounded-lg text-sm font-bold ${view === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}><Columns size={16} /></button>
                        <button onClick={() => setView('day')} className={`p-1.5 rounded-lg text-sm font-bold ${view === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}><List size={16} /></button>
                    </div>
                    <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                        <button onClick={() => handleNavigate(-1)} className="p-1.5 hover:bg-gray-100"><ChevronLeft size={20} /></button>
                        <button onClick={() => handleNavigate(1)} className="p-1.5 hover:bg-gray-100"><ChevronRight size={20} /></button>
                    </div>
                </div>
            </div>
      </div>

      <div className="p-2 md:p-5 max-w-7xl mx-auto">
        <div className="bg-white rounded-[2rem] shadow-vitrified overflow-hidden border border-gray-100">
            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (<div key={day} className="py-2 text-center text-[10px] font-bold text-gray-400 uppercase">{day}</div>))}
            </div>
            <div className="grid grid-cols-7 auto-rows-fr bg-gray-100 gap-[1px]">
                {Array.from({ length: getFirstDayOfMonth(currentDate) }).map((_, i) => <div key={`e-${i}`} className="bg-white min-h-[85px]"></div>)}
                {Array.from({ length: getDaysInMonth(currentDate) }, (_, i) => i + 1).map(day => {
                    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                    const dayEvents = getEventsForDate(date);
                    return (
                        <div key={day} className="bg-white min-h-[85px] p-1 relative">
                            <span className="text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full text-gray-700">{day}</span>
                            <div className="space-y-1 mt-1 overflow-hidden">
                                {dayEvents.map(e => (
                                    <button key={e.id} onClick={() => handleEventClick(e)} className={`w-full text-left px-1 py-0.5 rounded border text-[9px] font-bold truncate ${getStatusColor(e.chaveStatus)}`}>
                                        {e.geral?.nome}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>

      {isModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                             <h3 className="font-bold text-gray-900 text-lg">{selectedEvent.geral?.nome}</h3>
                             {!isProfessional && <span className="bg-gray-100 text-gray-900 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center"><Eye size={10} className="mr-1"/> Leitura</span>}
                        </div>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">#{selectedEvent.chaveUnica}</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 transition-colors"><X size={20} /></button>
                </div>

                <div className="flex border-b border-gray-100">
                    <button onClick={() => setActiveTab('geral')} className={`flex-1 py-3 text-sm font-bold border-b-2 ${activeTab === 'geral' ? 'border-ios-blue text-ios-blue' : 'border-transparent text-gray-500'}`}>Geral</button>
                    <button onClick={() => setActiveTab('fotos')} className={`flex-1 py-3 text-sm font-bold border-b-2 ${activeTab === 'fotos' ? 'border-ios-blue text-ios-blue' : 'border-transparent text-gray-500'}`}>Fotos</button>
                    <button onClick={() => setActiveTab('obs')} className={`flex-1 py-3 text-sm font-bold border-b-2 ${activeTab === 'obs' ? 'border-ios-blue text-ios-blue' : 'border-transparent text-gray-500'}`}>Notas</button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    {!isProfessional && <div className="bg-blue-50 text-blue-900 p-3 rounded-2xl text-[10px] font-black flex items-center"><Lock size={12} className="mr-2"/> Bloqueado para edição (somente profissionais).</div>}
                    
                    {activeTab === 'geral' && (
                        <div className="space-y-4">
                            <div className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between border border-gray-100">
                                <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-white overflow-hidden shadow-sm"><img src={selectedEvent.clienteData?.fotoperfil || `https://ui-avatars.com/api/?name=${selectedEvent.clienteData?.nome}`} className="w-full h-full object-cover"/></div><div><p className="text-[10px] font-bold text-gray-400 uppercase">Cliente</p><p className="font-bold text-xs text-gray-900">{selectedEvent.clienteData?.nome}</p></div></div>
                                <div className="flex items-center gap-2 text-right"><div><p className="text-[10px] font-bold text-gray-400 uppercase">Pro</p><p className="font-bold text-xs text-gray-900">{selectedEvent.profissionalData?.nome}</p></div><div className="w-8 h-8 rounded-full bg-white overflow-hidden shadow-sm"><img src={selectedEvent.profissionalData?.fotoperfil || `https://ui-avatars.com/api/?name=${selectedEvent.profissionalData?.nome}`} className="w-full h-full object-cover"/></div></div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Status</label>
                                <select disabled={!isProfessional} className="w-full bg-white border border-gray-200 rounded-2xl p-4 text-sm font-black text-gray-900 outline-none disabled:bg-gray-50 disabled:opacity-100" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                                    <option value="pendente">Pendente</option>
                                    <option value="executando">Executando</option>
                                    <option value="concluido">Concluído</option>
                                    <option value="cancelado">Cancelado</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Início</label><input disabled={!isProfessional} type="datetime-local" className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold text-gray-900 disabled:opacity-100" value={formData.datainicio} onChange={e => setFormData({...formData, datainicio: e.target.value})}/></div>
                                <div className="space-y-2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Fim</label><input disabled={!isProfessional} type="datetime-local" className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold text-gray-900 disabled:opacity-100" value={formData.datafim} onChange={e => setFormData({...formData, datafim: e.target.value})}/></div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'fotos' && (
                        <div className="space-y-6">
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Antes</h4>
                                <div className="grid grid-cols-3 gap-2">
                                    {formData.fotoantes.map((url, i) => (<div key={i} className="aspect-square bg-gray-100 rounded-xl overflow-hidden relative group"><img src={url} className="w-full h-full object-cover"/>{isProfessional && <button onClick={e => handleDeleteImage(e, i, 'antes')} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full"><Trash2 size={10} /></button>}</div>))}
                                    {isProfessional && <label className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center cursor-pointer hover:border-ios-blue">{uploading ? <Loader2 className="animate-spin text-blue-500"/> : <Camera size={20} className="text-gray-300"/>}<input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, 'antes')}/></label>}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Depois</h4>
                                <div className="grid grid-cols-3 gap-2">
                                    {formData.fotodepois.map((url, i) => (<div key={i} className="aspect-square bg-gray-100 rounded-xl overflow-hidden relative group"><img src={url} className="w-full h-full object-cover"/>{isProfessional && <button onClick={e => handleDeleteImage(e, i, 'depois')} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full"><Trash2 size={10} /></button>}</div>))}
                                    {isProfessional && <label className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center cursor-pointer hover:border-ios-blue">{uploading ? <Loader2 className="animate-spin text-blue-500"/> : <Camera size={20} className="text-gray-300"/>}<input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, 'depois')}/></label>}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'obs' && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Notas do Serviço</label>
                            <textarea disabled={!isProfessional} className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm font-black text-gray-900 min-h-[150px] disabled:opacity-100" value={formData.observacoes} onChange={e => setFormData({...formData, observacoes: e.target.value})} placeholder="Sem anotações."/>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 mt-auto flex gap-2">
                    <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-white border border-gray-200 text-gray-900 py-3.5 rounded-2xl font-bold">Fechar</button>
                    {isProfessional && <button onClick={handleSave} disabled={saving} className="flex-[2] bg-black text-white py-3.5 rounded-2xl font-bold shadow-xl flex justify-center items-center gap-2">{saving ? <Loader2 className="animate-spin" size={18}/> : <><Save size={16}/> Salvar</>}</button>}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
