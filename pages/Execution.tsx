
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Agenda, Geral } from '../types';
import { Loader2, ChevronLeft, ChevronRight, X, Clock, User, Save, Calendar as CalendarIcon, MapPin, Grid, Columns, List, Camera, Plus, Trash2, CheckCircle, AlertTriangle, FileText, Package, Lock, Eye } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [userType, setUserType] = useState<string>('');
  
  const [selectedEvent, setSelectedEvent] = useState<AgendaExtended | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>('geral');
  const [uploading, setUploading] = useState(false);
  
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
  }, [currentDate, view]);

  const fetchUserType = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
          const { data } = await supabase.from('users').select('tipo').eq('uuid', user.id).single();
          if (data) setUserType(data.tipo || '');
      }
  };

  const isProfessional = userType.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 'profissional';

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
        if (!agendaData || agendaData.length === 0) { setEvents([]); return; }

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

        const formattedEvents = agendaData.map((item: any) => {
            const chave = chavesMap[item.chave];
            const os = osMap[item.chave];
            const plan = planMap[item.chave];
            const service = chave ? servicesMap[chave.atividade] : null;
            return { ...item, geral: service, chaveData: chave, ordemServico: os, planejamentoData: plan, profissionalData: usersMap[item.profissional], clienteData: usersMap[item.cliente] };
        });
        setEvents(formattedEvents);
    } catch (error) { console.error(error); } finally { setLoading(false); }
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

  const handleAddResource = () => {
      if (!isProfessional) return;
      if (formData.newResource.trim()) {
          setFormData(prev => ({ ...prev, recursos: [...prev.recursos, prev.newResource.trim()], newResource: '' }));
      }
  };

  const handleRemoveResource = (idx: number) => {
      if (!isProfessional) return;
      setFormData(prev => ({ ...prev, recursos: prev.recursos.filter((_, i) => i !== idx) }));
  };

  const handleDeleteImage = (e: React.MouseEvent, indexToRemove: number, type: 'antes' | 'depois') => {
      e.stopPropagation();
      if (!isProfessional) return;
      if (!window.confirm("Remover foto?")) return;
      setFormData(prev => {
          const list = type === 'antes' ? prev.fotoantes : prev.fotodepois;
          const newList = list.filter((_, i) => i !== indexToRemove);
          return { ...prev, [type === 'antes' ? 'fotoantes' : 'fotodepois']: newList };
      });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'antes' | 'depois') => {
      if (!isProfessional) return;
      if (!e.target.files?.length) return;
      setUploading(true);
      try {
          const file = e.target.files[0];
          const path = `imagens/${selectedEvent?.chaveData?.chaveunica || 'ex'}_${type}_${Date.now()}.${file.name.split('.').pop()}`;
          const { error: uploadError } = await supabase.storage.from('imagens').upload(path, file);
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('imagens').getPublicUrl(path);
          setFormData(prev => ({ ...prev, [type === 'antes' ? 'fotoantes' : 'fotodepois']: [...(type === 'antes' ? prev.fotoantes : prev.fotodepois), data.publicUrl] }));
      } catch (error: any) { alert(error.message); } finally { setUploading(false); }
  };

  const handleSave = async () => {
      if (!selectedEvent || !isProfessional) return;
      setSaving(true);
      if (formData.status === 'executando' && !formData.fotoantes?.length) { alert("Fotos do 'Antes' obrigatórias."); setActiveTab('fotos'); setSaving(false); return; }
      if (formData.status === 'concluido' && !formData.fotodepois?.length) { alert("Fotos do 'Depois' obrigatórias."); setActiveTab('fotos'); setSaving(false); return; }
      if (formData.status === 'cancelado' && (!formData.descricao || formData.descricao.length < 10)) { alert("Justificativa obrigatória (min. 10 letras)."); setActiveTab('obs'); setSaving(false); return; }

      try {
          if (selectedEvent.chaveData) await supabase.from('chaves').update({ status: formData.status, fotoantes: formData.fotoantes, fotodepois: formData.fotodepois }).eq('id', selectedEvent.chaveData.id);
          await supabase.from('agenda').update({ observacoes: formData.descricao }).eq('id', selectedEvent.id);
          if (selectedEvent.planejamentoData) await supabase.from('planejamento').update({ descricao: formData.planDescricao, recursos: formData.recursos }).eq('id', selectedEvent.planejamentoData.id);
          if (selectedEvent.ordemServico) await supabase.from('ordemservico').update({ status: formData.status }).eq('id', selectedEvent.ordemServico.id);
          await fetchAgenda(); setIsModalOpen(false); alert("Atualizado!");
      } catch (error: any) { alert(error.message); } finally { setSaving(false); }
  };

  const getStatusColor = (status: string | undefined) => {
      switch (status?.toLowerCase()) {
          case 'concluido': return 'bg-green-100 text-green-900 border-green-200';
          case 'executando': return 'bg-purple-100 text-purple-900 border-purple-200';
          case 'pendente': return 'bg-yellow-100 text-yellow-900 border-yellow-200';
          case 'cancelado': return 'bg-red-100 text-red-900 border-red-200';
          default: return 'bg-blue-100 text-blue-900 border-blue-200';
      }
  };

  const getHeaderText = () => currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-ios-bg pb-20">
       <div className="bg-white/80 backdrop-blur-md px-5 pt-12 pb-4 sticky top-0 z-20 border-b border-gray-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight capitalize truncate">{getHeaderText()}</h1>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Agenda de Execução</p>
            </div>
            <div className="flex items-center gap-3">
                <div className="bg-gray-100 p-1 rounded-xl flex shadow-inner">
                    <button onClick={() => setView('month')} className={`p-2 rounded-lg transition-all font-bold text-xs ${view === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Mês</button>
                    <button onClick={() => setView('week')} className={`p-2 rounded-lg transition-all font-bold text-xs ${view === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Semana</button>
                    <button onClick={() => setView('day')} className={`p-2 rounded-lg transition-all font-bold text-xs ${view === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Dia</button>
                </div>
            </div>
      </div>

      <div className="p-5 max-w-7xl mx-auto">
           <div className="bg-white rounded-[2rem] shadow-vitrified overflow-hidden border border-gray-100">
            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (<div key={day} className="py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">{day}</div>))}
            </div>
            <div className="grid grid-cols-7 auto-rows-fr bg-gray-100 gap-[1px]">
                {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() }).map((_, i) => <div key={`e-${i}`} className="bg-white min-h-[100px]"></div>)}
                {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => {
                     const dayEvents = events.filter(e => { const d = new Date(e.execucao); return d.getDate() === day && d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear(); });
                     return (
                         <div key={day} className="bg-white min-h-[100px] p-2 hover:bg-gray-50 transition-colors">
                             <span className="text-xs font-bold text-gray-900">{day}</span>
                             <div className="space-y-1 mt-1 overflow-hidden">
                                 {dayEvents.map(ev => (<button key={ev.id} onClick={() => handleEventClick(ev)} className={`w-full text-left px-1.5 py-0.5 rounded border text-[9px] font-black truncate uppercase ${getStatusColor(ev.chaveData?.status)}`}>{ev.geral?.nome}</button>))}
                             </div>
                         </div>
                     )
                })}
            </div>
          </div>
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
                    <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-50 rounded-full text-gray-400"><X size={20} /></button>
                </div>

                <div className="flex border-b border-gray-100 bg-white">
                    {['geral', 'recursos', 'fotos', 'obs'].map((tab) => (
                        <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 py-3 text-xs font-black uppercase transition-all ${activeTab === tab ? 'border-b-2 border-ios-blue text-ios-blue' : 'text-gray-400'}`}>{tab}</button>
                    ))}
                </div>

                <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
                    {!isProfessional && <div className="bg-blue-50 text-blue-900 p-3 rounded-2xl text-[10px] font-black uppercase flex items-center"><Lock size={14} className="mr-2" /> Bloqueado para edição (somente profissionais).</div>}
                    
                    {activeTab === 'geral' && (
                        <div className="space-y-4">
                            <div className="bg-gray-50 p-5 rounded-[2rem] flex items-center justify-between border border-gray-100 shadow-sm">
                                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-white overflow-hidden shadow-sm border border-white"><img src={selectedEvent.clienteData?.fotoperfil || `https://ui-avatars.com/api/?name=${selectedEvent.clienteData?.nome}`} className="w-full h-full object-cover"/></div><div><p className="text-[10px] font-bold text-gray-400 uppercase">Cliente</p><p className="font-bold text-sm text-gray-900 leading-tight">{selectedEvent.clienteData?.nome}</p></div></div>
                                <div className="flex items-center gap-3 text-right"><div><p className="text-[10px] font-bold text-gray-400 uppercase">Profissional</p><p className="font-bold text-sm text-gray-900 leading-tight">{selectedEvent.profissionalData?.nome}</p></div><div className="w-10 h-10 rounded-full bg-white overflow-hidden shadow-sm border border-white"><img src={selectedEvent.profissionalData?.fotoperfil || `https://ui-avatars.com/api/?name=${selectedEvent.profissionalData?.nome}`} className="w-full h-full object-cover"/></div></div>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Status do Pedido</label>
                                <select className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm font-black text-gray-900 outline-none disabled:opacity-100" value={formData.status} disabled={!isProfessional} onChange={(e) => setFormData({...formData, status: e.target.value})}><option value="pendente">Pendente</option><option value="executando">Executando</option><option value="concluido">Concluído</option><option value="cancelado">Cancelado</option></select>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Descrição do Escopo</label>
                                <textarea className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-5 text-sm font-bold text-gray-900 outline-none resize-none min-h-[100px] disabled:opacity-100" value={formData.planDescricao} disabled={!isProfessional} onChange={(e) => setFormData({...formData, planDescricao: e.target.value})} placeholder="Sem descrição."/>
                            </div>
                        </div>
                    )}

                    {activeTab === 'recursos' && (
                        <div className="space-y-4">
                            {isProfessional && <div className="flex gap-2"><input className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold text-gray-900 outline-none" placeholder="Novo material..." value={formData.newResource} onChange={(e) => setFormData({...formData, newResource: e.target.value})}/><button onClick={handleAddResource} className="bg-black text-white px-5 rounded-2xl"><Plus size={20}/></button></div>}
                            <div className="space-y-2">
                                {formData.recursos.map((res, i) => (<div key={i} className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100"><span className="text-sm font-bold text-gray-900">{res}</span>{isProfessional && <button onClick={() => handleRemoveResource(i)} className="text-red-500"><Trash2 size={16}/></button>}</div>))}
                                {formData.recursos.length === 0 && <p className="text-center text-gray-400 text-xs py-10 border-2 border-dashed border-gray-100 rounded-2xl">Vazio.</p>}
                            </div>
                        </div>
                    )}

                    {activeTab === 'fotos' && (
                        <div className="space-y-8">
                            {['Antes', 'Depois'].map((sectionName) => {
                                const uploadTag = sectionName.toLowerCase() === 'antes' ? 'antes' : 'depois';
                                const photoList = uploadTag === 'antes' ? formData.fotoantes : formData.fotodepois;
                                return (
                                    <div key={sectionName}>
                                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 ml-1">Fotos do {sectionName}</h4>
                                        <div className="grid grid-cols-3 gap-3">
                                            {photoList.map((url, i) => (
                                                <div key={i} className="aspect-square bg-gray-100 rounded-2xl overflow-hidden relative group border border-gray-100">
                                                    <img src={url} className="w-full h-full object-cover"/>
                                                    {isProfessional && (
                                                        <button onClick={(e) => handleDeleteImage(e, i, uploadTag)} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full">
                                                            <Trash2 size={12}/>
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            {isProfessional && (
                                                <label className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center cursor-pointer">
                                                    {uploading ? <Loader2 className="animate-spin text-ios-blue"/> : <Camera size={24} className="text-gray-300"/>}
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, uploadTag)} />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {activeTab === 'obs' && (
                        <div className="space-y-4">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Observações da Agenda</label>
                            <textarea className="w-full bg-yellow-50 border border-yellow-100 rounded-2xl p-5 text-sm font-bold text-gray-900 outline-none resize-none min-h-[200px] disabled:opacity-100" placeholder="Suas anotações..." value={formData.descricao} disabled={!isProfessional} onChange={(e) => setFormData({...formData, descricao: e.target.value})}/>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 mt-auto flex gap-3">
                    <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-white border border-gray-200 text-gray-900 py-4 rounded-2xl font-bold shadow-sm active:scale-95 transition-all">Fechar</button>
                    {isProfessional && <button onClick={handleSave} disabled={saving} className="flex-[2] bg-black text-white py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex justify-center items-center gap-2">{saving ? <Loader2 className="animate-spin" size={20}/> : <><Save size={18}/><span>Salvar Dados</span></>}</button>}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Execution;
