
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import ProfessionalOrderModal from '../components/modals/ProfessionalOrderModal';
import { Agenda, Geral } from '../types';
import {
    Loader2, ChevronLeft, ChevronRight, X, Clock, User, Save,
    Calendar as CalendarIcon, Grid, Columns, List,
    Camera, Package, Trash2, Check, Ban, Eye, AlertCircle, Banknote, MapPin, Image as ImageIcon, Play, AlertTriangle, HelpCircle, Star
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
        imagem_pedido?: string | null;
    };
    orcamentoData?: {
        preco: number;
        hh: number;
    };
    avaliacao?: {
        nota: number;
        comentario: string;
    } | null;
}

type CalendarView = 'month' | 'week' | 'day';
type ModalTab = 'geral' | 'fotos' | 'obs';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const Execution: React.FC = () => {
    const [events, setEvents] = useState<AgendaExtended[]>([]);
    const [pendingAcceptance, setPendingAcceptance] = useState<AgendaExtended[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<CalendarView>('month');
    const [userType, setUserType] = useState<string>('');
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);

    const [selectedEvent, setSelectedEvent] = useState<AgendaExtended | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<ModalTab>('geral');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [processingId, setProcessingId] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        status: '',
        observacoes: '',
        fotoantes: [] as string[],
        fotodepois: [] as string[]
    });

    const extractOriginalDesc = (desc: string | undefined | null) => {
        if (!desc) return "";
        const marker = '\n\n[';
        const index = desc.indexOf(marker);
        return index !== -1 ? desc.substring(0, index).trim() : desc.trim();
    };

    const isMediaVideo = (url: string) => {
        if (!url) return false;
        const cleanPath = url.split('?')[0].toLowerCase();
        const videoExtensions = ['.mp4', '.mov', '.webm', '.quicktime', '.m4v', '.3gp', '.mkv'];
        return videoExtensions.some(ext => cleanPath.endsWith(ext)) || url.toLowerCase().includes('video');
    };

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
            setCurrentUserId(user.id);

            const { data: agendaData, error: agendaError } = await supabase
                .from('agenda')
                .select('*')
                .or(`cliente.eq.${user.id},profissional.eq.${user.id}`);

            if (agendaError) throw agendaError;
            if (!agendaData) return;

            const dreamChaveIds = agendaData.map((a: any) => a.chave).filter((id: any) => id);
            const userIds = new Set<string>();
            agendaData.forEach((a: any) => { if (a.cliente) userIds.add(a.cliente); if (a.profissional) userIds.add(a.profissional); });

            const [chavesRes, planRes, usersRes, servicesRes, orcRes, reviewsRes] = await Promise.all([
                dreamChaveIds.length > 0 ? supabase.from('chaves').select('*').in('id', dreamChaveIds) : { data: [] },
                dreamChaveIds.length > 0 ? supabase.from('planejamento').select('*').in('chave', dreamChaveIds) : { data: [] },
                userIds.size > 0 ? supabase.from('users').select('uuid, nome, fotoperfil, rua, numero, bairro, complemento').in('uuid', Array.from(userIds)) : { data: [] },
                supabase.from('geral').select('*'),
                dreamChaveIds.length > 0 ? supabase.from('orcamentos').select('chave, preco, hh').in('chave', dreamChaveIds) : { data: [] },
                dreamChaveIds.length > 0 ? supabase.from('avaliacoes').select('*').in('chave', dreamChaveIds) : { data: [] }
            ]);

            const chavesMap = Object.fromEntries(chavesRes.data?.map(c => [c.id, c]) || []);
            const planMap = Object.fromEntries(planRes.data?.map(p => [p.chave, p]) || []);
            const usersMap = Object.fromEntries(usersRes.data?.map(u => [u.uuid, u]) || []);
            const servicesMap = Object.fromEntries(servicesRes.data?.map(s => [s.id, s]) || []);
            const orcMap = Object.fromEntries(orcRes.data?.map(o => [o.chave, o]) || []);
            const reviewsMap = Object.fromEntries(reviewsRes.data?.map(r => [r.chave, r]) || []);

            const enriched = agendaData.map((item: any) => {
                const chave = chavesMap[item.chave];
                return {
                    ...item,
                    geral: chave ? servicesMap[chave.atividade] : null,
                    chaveData: chave,
                    planejamentoData: planMap[item.chave],
                    profissionalData: usersMap[item.profissional],
                    clienteData: usersMap[item.cliente],
                    orcamentoData: orcMap[item.chave],
                    avaliacao: reviewsMap[item.chave]
                };
            });

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
        setUploadError(null);
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

    // Aplicação do filtro de status nos eventos exibidos
    const filteredEvents = events.filter(ev => !statusFilter || ev.chaveData?.status?.toLowerCase() === statusFilter);

    const renderMonthView = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();

        const dayCells = [];
        for (let i = 0; i < firstDay; i++) dayCells.push(<div key={`empty-${i}`} className="bg-white min-h-[100px] border-b border-r border-gray-100 opacity-30"></div>);

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const dayEvents = filteredEvents.filter(e => isSameDay(new Date(e.execucao), date));
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
        return <div className="grid grid-cols-7 border-l border-t border-gray-100 rounded-3xl overflow-hidden shadow-sm bg-white">{dayCells}</div>;
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
                    const dayEvents = filteredEvents.filter(e => isSameDay(new Date(e.execucao), date));
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
                                        <p className="text-[8px] font-bold opacity-60 flex items-center mt-1"><Clock size={10} className="mr-1" /> {new Date(ev.execucao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
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
        const dayEvents = filteredEvents.filter(e => isSameDay(new Date(e.execucao), currentDate));
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
                                <span className="text-[10px] font-black text-gray-400 flex items-center uppercase tracking-wider"><Clock size={12} className="mr-1" /> {new Date(ev.execucao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
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

    const toggleFilter = (status: string) => {
        setStatusFilter(prev => prev === status ? null : status);
    };

    return (
        <div className="min-h-screen bg-ios-bg pb-20">
            <div className="bg-white/80 backdrop-blur-md px-5 pt-12 pb-4 sticky top-0 z-20 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex gap-1">
                        <button onClick={() => handleNavigate('prev')} className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 active:scale-90 transition-all"><ChevronLeft size={20} /></button>
                        <button onClick={() => handleNavigate('next')} className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 active:scale-90 transition-all"><ChevronRight size={20} /></button>
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
                                                {item.geral?.imagem ? <img src={item.geral.imagem} className="w-full h-full object-cover" /> : <Package size={20} className="text-cyan-400" />}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 text-xs leading-tight">{item.geral?.nome}</h3>
                                                <p className="text-[8px] font-black text-gray-400 uppercase">ID: {item.chaveData?.chaveunica}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[8px] font-black text-cyan-600 uppercase">Data</p>
                                            <p className="text-[10px] font-bold text-gray-900">{new Date(item.execucao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p>
                                        </div>
                                    </div>

                                    <div className="bg-cyan-50/50 p-3 rounded-2xl border border-cyan-100/50 space-y-2">
                                        <div className="flex items-center text-gray-700">
                                            <Banknote size={14} className="mr-2 text-cyan-600" />
                                            <span className="text-[10px] font-black uppercase mr-1 text-gray-400">Ganhos:</span>
                                            <span className="text-xs font-black text-gray-900">R$ {item.orcamentoData?.hh.toFixed(2) || '0.00'}</span>
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
                                        <button disabled={processingId === item.id} onClick={() => handleDecision(item, true)} className="flex-[2] bg-black text-white py-2.5 rounded-xl font-black text-[9px] shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">{processingId === item.id ? <Loader2 size={12} className="animate-spin" /> : 'ACEITAR'}</button>
                                        <button disabled={processingId === item.id} onClick={() => handleDecision(item, false)} className="flex-1 bg-gray-50 text-red-500 py-2.5 rounded-xl font-black text-[9px] flex items-center justify-center active:scale-95 transition-all">RECUSAR</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ios-blue" size={40} /></div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">

                        {/* FILTRO DE STATUS NO TOPO */}
                        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-[2.5rem] shadow-sm border border-white flex flex-col gap-5 mb-8 animate-in slide-in-from-top-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-ios-blue/10 rounded-xl text-ios-blue">
                                        <HelpCircle size={18} />
                                    </div>
                                    <h2 className="text-xs font-black uppercase tracking-widest text-gray-900">Filtrar por Status</h2>
                                </div>
                                <button onClick={() => setStatusFilter(null)} className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg transition-all ${!statusFilter ? 'bg-gray-100 text-gray-400 cursor-default' : 'bg-ios-blue text-white shadow-sm'}`}>Limpar Filtro</button>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={() => toggleFilter('aprovado')}
                                    className={`flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full border shadow-sm transition-all active:scale-95 ${statusFilter === 'aprovado' ? 'border-green-500 ring-2 ring-green-100 scale-105' : 'border-green-100 opacity-60 hover:opacity-100'}`}
                                >
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                                    <span className="text-[9px] font-black uppercase text-green-800 tracking-tight">Serviço Agendado</span>
                                </button>
                                <button
                                    onClick={() => toggleFilter('executando')}
                                    className={`flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-full border shadow-sm transition-all active:scale-95 ${statusFilter === 'executando' ? 'border-purple-500 ring-2 ring-purple-100 scale-105' : 'border-purple-100 opacity-60 hover:opacity-100'}`}
                                >
                                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div>
                                    <span className="text-[9px] font-black uppercase text-purple-800 tracking-tight">Em Execução</span>
                                </button>
                                <button
                                    onClick={() => toggleFilter('concluido')}
                                    className={`flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border shadow-sm transition-all active:scale-95 ${statusFilter === 'concluido' ? 'border-gray-500 ring-2 ring-gray-200 scale-105' : 'border-gray-100 opacity-60 hover:opacity-100'}`}
                                >
                                    <div className="w-2.5 h-2.5 rounded-full bg-gray-400"></div>
                                    <span className="text-[9px] font-black uppercase text-gray-800 tracking-tight">Concluído</span>
                                </button>
                                <button
                                    onClick={() => toggleFilter('pendente')}
                                    className={`flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full border shadow-sm transition-all active:scale-95 ${statusFilter === 'pendente' ? 'border-blue-500 ring-2 ring-blue-100 scale-105' : 'border-blue-100 opacity-60 hover:opacity-100'}`}
                                >
                                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                                    <span className="text-[9px] font-black uppercase text-blue-800 tracking-tight">Pendente / Outros</span>
                                </button>
                            </div>

                            {isProfessional && (
                                <div className="pt-4 border-t border-gray-100">
                                    <div className="flex items-center gap-2 bg-cyan-50 px-4 py-2 rounded-2xl border border-cyan-100">
                                        <AlertTriangle size={14} className="text-cyan-500" />
                                        <p className="text-[9px] font-bold text-cyan-700 leading-tight uppercase tracking-tight">
                                            PROFISSIONAL: Serviços com status "Aguardando Profissional" aparecem no topo para seu aceite.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mb-8">
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
                    </div>
                )}
            </div>

            <ProfessionalOrderModal
                order={selectedEvent}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onUpdate={fetchAgenda}
                userRole={userType}
                userUuid={currentUserId}
            />
        </div>
    );
};

export default Execution;
