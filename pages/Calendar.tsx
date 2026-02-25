
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import ConsumerOrderModal from '../components/modals/ConsumerOrderModal';
import ProfessionalOrderModal from '../components/modals/ProfessionalOrderModal';
import { Chave, Geral, User, Planejamento, Orcamento, Agenda, Avaliacao } from '../types';
import {
    Loader2, ChevronLeft, ChevronRight, X, Clock, User as UserIcon,
    Calendar as CalendarIcon, MapPin, Banknote,
    Image as ImageIcon, AlertTriangle, Hash, Map, Navigation, ShieldCheck, RefreshCcw, Info, UserCheck, Briefcase, HelpCircle,
    ClipboardList, Camera, CheckCircle2, PlayCircle
} from 'lucide-react';


interface EventExtended extends Chave {
    geralData?: Geral;
    planejamentoData?: Planejamento;
    orcamentoData?: Orcamento;
    agendaData?: Agenda;
    clienteData?: User;
    profissionalData?: User;
    avaliacao?: Avaliacao;
    calendarDate: Date; // A data calculada para exibição
}

type CalendarView = 'month' | 'week' | 'day';
type ModalTab = 'geral' | 'profissional';

const CalendarPage: React.FC = () => {
    const [events, setEvents] = useState<EventExtended[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<CalendarView>('month');
    const [userType, setUserType] = useState<string>('');
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);

    const [selectedEvent, setSelectedEvent] = useState<EventExtended | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<ModalTab>('geral');

    // Função para limpar a descrição removendo metadados técnicos
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
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                setLoading(false);
                return;
            }

            const user = session.user;
            setCurrentUserId(user.id);
            const { data: userData } = await supabase.from('users').select('tipo').eq('uuid', user.id).maybeSingle();
            const role = (userData?.tipo || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            setUserType(role);

            let chavesQuery = supabase.from('chaves').select('*').order('created_at', { ascending: false });

            if (role === 'consumidor') {
                chavesQuery = chavesQuery.eq('cliente', user.id);
            } else if (role === 'profissional') {
                chavesQuery = chavesQuery.eq('profissional', user.id);
            }

            const { data: chavesData, error: chavesError } = await chavesQuery;
            if (chavesError) throw chavesError;
            if (!chavesData || chavesData.length === 0) {
                setEvents([]);
                setLoading(false);
                return;
            }

            const ids = chavesData.map(c => c.id);
            const userUuids = new Set<string>();
            chavesData.forEach(c => {
                if (c.cliente) userUuids.add(c.cliente);
                if (c.profissional) userUuids.add(c.profissional);
            });

            const [geralRes, planRes, orcRes, agendaRes, usersRes, reviewsRes] = await Promise.all([
                supabase.from('geral').select('*').eq('ativa', true),
                supabase.from('planejamento').select('*').in('chave', ids),
                supabase.from('orcamentos').select('*').in('chave', ids),
                supabase.from('agenda').select('*').in('chave', ids),
                supabase.from('users').select('*').in('uuid', Array.from(userUuids)),
                supabase.from('avaliacoes').select('*').in('chave', ids)
            ]);

            const geralMap = Object.fromEntries(geralRes.data?.map(g => [g.id, g]) || []);
            const planMap = Object.fromEntries(planRes.data?.map(p => [p.chave, p]) || []);
            const orcMap = Object.fromEntries(orcRes.data?.map(o => [o.chave, o]) || []);
            const agendaMap = Object.fromEntries(agendaRes.data?.map(a => [a.chave, a]) || []);
            const usersMap = Object.fromEntries(usersRes.data?.map(u => [u.uuid, u]) || []);
            const reviewsMap = Object.fromEntries(reviewsRes.data?.map(r => [r.chave, r]) || []);

            const normalized: EventExtended[] = chavesData.map(item => {
                const plan = planMap[item.id];
                const agenda = agendaMap[item.id];
                let calendarDateStr = item.created_at;
                if (agenda?.execucao) calendarDateStr = agenda.execucao;
                else if (plan?.execucao) calendarDateStr = plan.execucao;

                return {
                    ...item,
                    geralData: geralMap[item.atividade],
                    planejamentoData: plan,
                    orcamentoData: orcMap[item.id],
                    agendaData: agenda,
                    clienteData: usersMap[item.cliente],
                    profissionalData: usersMap[item.profissional],
                    avaliacao: reviewsMap[item.id],
                    calendarDate: new Date(calendarDateStr)
                };
            });

            setEvents(normalized);
        } catch (error) {
            console.error("Erro crítico na agenda:", error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusLabel = (s: string | undefined) => {
        switch (s?.toLowerCase()) {
            case 'pendente': return 'Aguardando Agendamento';
            case 'analise': return 'Aguardando Orçamento';
            case 'aguardando_profissional': return 'Aguardando Profissional';
            case 'aguardando_aprovacao': return 'Orçamento Pronto';
            case 'aprovado': return 'Serviço Agendado';
            case 'executando': return 'Em Execução';
            case 'concluido': return 'Serviço Concluído';
            case 'cancelado': return 'Serviço Cancelado';
            case 'reprovado': return 'Orçamento Recusado';
            default: return s || 'Status Desconhecido';
        }
    };

    const getStatusColor = (s: string | undefined) => {
        switch (s?.toLowerCase()) {
            case 'pendente': return 'bg-yellow-100 text-yellow-900 border-yellow-200';
            case 'analise': return 'bg-blue-100 text-blue-900 border-blue-200';
            case 'aguardando_profissional': return 'bg-cyan-100 text-cyan-900 border-cyan-200';
            case 'aguardando_aprovacao': return 'bg-orange-100 text-orange-900 border-orange-200';
            case 'aprovado': return 'bg-green-100 text-green-900 border-green-200';
            case 'executando': return 'bg-purple-100 text-purple-900 border-purple-200';
            case 'concluido': return 'bg-gray-100 text-gray-900 border-gray-200';
            case 'cancelado': return 'bg-red-100 text-red-900 border-red-200';
            case 'reprovado': return 'bg-red-50 text-red-700 border-red-100';
            default: return 'bg-gray-50 text-gray-400 border-gray-100';
        }
    };

    const handleNavigate = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentDate);
        if (view === 'month') newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        else if (view === 'week') newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        else newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
        setCurrentDate(newDate);
    };

    const isSameDay = (d1: Date, d2: Date) => d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
    const isToday = (d: Date) => isSameDay(d, new Date());

    // Aplicação do filtro de status
    const filteredEvents = events.filter(ev => !statusFilter || ev.status?.toLowerCase() === statusFilter);

    const renderMonthView = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();

        const dayCells = [];
        for (let i = 0; i < firstDay; i++) dayCells.push(<div key={`empty-${i}`} className="bg-white min-h-[110px] border-b border-r border-gray-100 opacity-30"></div>);

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const dayEvents = filteredEvents.filter(e => isSameDay(e.calendarDate, date));

            dayCells.push(
                <div key={d} className={`bg-white min-h-[110px] p-2 border-b border-r border-gray-100 hover:bg-gray-50 transition-colors ${isToday(date) ? 'bg-blue-50/20' : ''}`}>
                    <span className={`text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full mb-2 ${isToday(date) ? 'bg-ios-blue text-white shadow-sm' : 'text-gray-400'}`}>{d}</span>
                    <div className="space-y-1">
                        {dayEvents.map(ev => {
                            const isUnplanned = !ev.agendaData && !ev.planejamentoData;
                            return (
                                <button
                                    key={ev.id}
                                    onClick={() => { setSelectedEvent(ev); setActiveTab('geral'); setIsModalOpen(true); }}
                                    className={`w-full text-left px-2 py-1 rounded-lg border text-[8px] font-black truncate uppercase shadow-sm active:scale-95 transition-transform ${getStatusColor(ev.status)} ${isUnplanned ? 'opacity-70 border-dashed border-2' : ''}`}
                                >
                                    {isUnplanned && '⏳ '}{ev.geralData?.nome || 'Serviço'}
                                </button>
                            );
                        })}
                    </div>
                </div>
            );
        }
        return <div className="grid grid-cols-7 border-l border-t border-gray-100 rounded-[2rem] overflow-hidden shadow-glass bg-white">{dayCells}</div>;
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
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                {weekDays.map((date, i) => {
                    const dayEvents = filteredEvents.filter(e => isSameDay(e.calendarDate, date));
                    return (
                        <div key={i} className={`bg-white rounded-[2rem] p-4 shadow-sm border border-gray-100 flex flex-col min-h-[300px] ${isToday(date) ? 'ring-2 ring-ios-blue border-transparent' : ''}`}>
                            <div className="text-center border-b border-gray-50 pb-3 mb-4">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][date.getDay()]}</p>
                                <p className={`text-2xl font-black mt-1 ${isToday(date) ? 'text-ios-blue' : 'text-gray-900'}`}>{date.getDate()}</p>
                            </div>
                            <div className="flex-1 space-y-3">
                                {dayEvents.map(ev => {
                                    const isUnplanned = !ev.agendaData && !ev.planejamentoData;
                                    return (
                                        <div
                                            key={ev.id}
                                            onClick={() => { setSelectedEvent(ev); setActiveTab('geral'); setIsModalOpen(true); }}
                                            className={`p-3 rounded-2xl border cursor-pointer hover:shadow-md active:scale-95 transition-all ${getStatusColor(ev.status)} ${isUnplanned ? 'border-dashed border-2' : ''}`}
                                        >
                                            <p className="text-[10px] font-black uppercase truncate leading-tight">{ev.geralData?.nome || 'Serviço'}</p>
                                            <div className="flex items-center mt-2 opacity-70">
                                                <Clock size={10} className="mr-1" />
                                                <p className="text-[9px] font-bold">{ev.calendarDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                            {isUnplanned && (
                                                <div className="mt-2 bg-white/40 px-2 py-0.5 rounded text-[7px] font-black text-center text-black/60 uppercase">Aguardando Planejamento</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderDayView = () => {
        const dayEvents = filteredEvents.filter(e => isSameDay(e.calendarDate, currentDate));
        return (
            <div className="max-w-2xl mx-auto space-y-4">
                {dayEvents.length > 0 ? dayEvents.map(ev => {
                    const isUnplanned = !ev.agendaData && !ev.planejamentoData;
                    return (
                        <div key={ev.id} onClick={() => { setSelectedEvent(ev); setActiveTab('geral'); setIsModalOpen(true); }} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center gap-5 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]">
                            <div className={`w-16 h-16 rounded-[1.5rem] flex flex-col items-center justify-center flex-shrink-0 shadow-inner ${getStatusColor(ev.status)}`}>
                                <Clock size={24} />
                                <span className="text-[9px] font-black">{ev.calendarDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-bold text-gray-900 text-lg leading-tight truncate">{ev.geralData?.nome}</h3>
                                    <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${getStatusColor(ev.status)}`}>{getStatusLabel(ev.status)}</div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-ios-blue flex items-center uppercase tracking-wider"><UserIcon size={12} className="mr-1.5" /> {['gestor', 'planejista', 'orcamentista'].includes(userType) ? `Cli: ${ev.clienteData?.nome || '?'}` : (userType === 'profissional' ? ev.clienteData?.nome : (ev.profissionalData?.nome || 'Aguardando Profissional'))}</span>
                                    {isUnplanned && <span className="text-[10px] font-bold text-orange-500 flex items-center uppercase tracking-widest"><AlertTriangle size={12} className="mr-1.5" /> Data de Solicitação (Não planejado)</span>}
                                    <span className="text-[10px] font-medium text-gray-400 flex items-center truncate"><MapPin size={10} className="mr-1.5" /> {ev.clienteData?.rua}, {ev.clienteData?.numero}</span>
                                </div>
                            </div>
                            <ChevronRight className="text-gray-200" />
                        </div>
                    );
                }) : (
                    <div className="bg-white/50 border-2 border-dashed border-gray-200 rounded-[3rem] py-24 text-center">
                        <CalendarIcon size={48} className="mx-auto text-gray-200 mb-4" />
                        <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Nenhum compromisso para este dia</p>
                    </div>
                )}
            </div>
        );
    };

    const isAdminView = ['gestor', 'planejista', 'orcamentista'].includes(userType);

    const toggleFilter = (status: string) => {
        setStatusFilter(prev => prev === status ? null : status);
    };

    return (
        <div className="min-h-screen bg-ios-bg pb-20">
            <div className="bg-white/80 backdrop-blur-md px-6 pt-12 pb-6 sticky top-0 z-20 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
                <div className="flex items-center gap-5">
                    <div className="flex gap-2">
                        <button onClick={() => handleNavigate('prev')} className="p-3 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 active:scale-90 transition-all shadow-sm"><ChevronLeft size={24} /></button>
                        <button onClick={() => handleNavigate('next')} className="p-3 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 active:scale-90 transition-all shadow-sm"><ChevronRight size={24} /></button>
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tighter capitalize truncate">
                            {view === 'month' ? currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) :
                                view === 'day' ? currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }) : 'Visão Semanal'}
                        </h1>
                        <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.25em] mt-1">{isAdminView ? 'VISÃO ADMINISTRATIVA' : 'MEUS COMPROMISSOS'}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={fetchData} className="p-3 bg-white border border-gray-200 rounded-full text-gray-400 hover:text-ios-blue transition-colors shadow-sm active:rotate-180 duration-500"><RefreshCcw size={20} /></button>
                    <div className="bg-gray-100/80 p-1.5 rounded-2xl flex shadow-inner border border-gray-200">
                        <button onClick={() => setView('month')} className={`px-5 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest ${view === 'month' ? 'bg-white text-gray-900 shadow-md scale-105' : 'text-gray-400 hover:text-gray-600'}`}>Mês</button>
                        <button onClick={() => setView('week')} className={`px-5 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest ${view === 'week' ? 'bg-white text-gray-900 shadow-md scale-105' : 'text-gray-400 hover:text-gray-600'}`}>Semana</button>
                        <button onClick={() => setView('day')} className={`px-5 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest ${view === 'day' ? 'bg-white text-gray-900 shadow-md scale-105' : 'text-gray-400 hover:text-gray-600'}`}>Dia</button>
                    </div>
                </div>
            </div>

            <div className="p-6 max-w-7xl mx-auto space-y-8">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <Loader2 className="animate-spin text-ios-blue" size={48} />
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Sincronizando Agenda...</p>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">

                        {/* LEGENDA DE CORES - AGORA NO TOPO */}
                        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-[2.5rem] shadow-sm border border-white flex flex-col gap-5 mb-8 animate-in slide-in-from-top-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-ios-blue/10 rounded-xl text-ios-blue">
                                        <HelpCircle size={18} />
                                    </div>
                                    <h2 className="text-xs font-black uppercase tracking-widest text-gray-900">Filtrar Agenda</h2>
                                </div>
                                <button onClick={() => setStatusFilter(null)} className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg transition-all ${!statusFilter ? 'bg-gray-100 text-gray-400 cursor-default' : 'bg-ios-blue text-white shadow-sm'}`}>Limpar Filtro</button>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={() => toggleFilter('pendente')}
                                    className={`flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded-full border shadow-sm transition-all active:scale-95 ${statusFilter === 'pendente' ? 'border-yellow-500 ring-2 ring-yellow-100 scale-105' : 'border-yellow-100 opacity-60 hover:opacity-100'}`}
                                >
                                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                                    <span className="text-[9px] font-black uppercase text-yellow-800 tracking-tight">Pendente</span>
                                </button>
                                <button
                                    onClick={() => toggleFilter('analise')}
                                    className={`flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full border shadow-sm transition-all active:scale-95 ${statusFilter === 'analise' ? 'border-blue-500 ring-2 ring-blue-100 scale-105' : 'border-blue-100 opacity-60 hover:opacity-100'}`}
                                >
                                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                                    <span className="text-[9px] font-black uppercase text-blue-800 tracking-tight">Em Orçamento</span>
                                </button>
                                <button
                                    onClick={() => toggleFilter('aguardando_aprovacao')}
                                    className={`flex items-center gap-2 bg-orange-50 px-3 py-1.5 rounded-full border shadow-sm transition-all active:scale-95 ${statusFilter === 'aguardando_aprovacao' ? 'border-orange-500 ring-2 ring-orange-100 scale-105' : 'border-orange-100 opacity-60 hover:opacity-100'}`}
                                >
                                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                                    <span className="text-[9px] font-black uppercase text-orange-800 tracking-tight">Orçamento Pronto</span>
                                </button>
                                <button
                                    onClick={() => toggleFilter('aguardando_profissional')}
                                    className={`flex items-center gap-2 bg-cyan-50 px-3 py-1.5 rounded-full border shadow-sm transition-all active:scale-95 ${statusFilter === 'aguardando_profissional' ? 'border-cyan-500 ring-2 ring-cyan-100 scale-105' : 'border-cyan-100 opacity-60 hover:opacity-100'}`}
                                >
                                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400"></div>
                                    <span className="text-[9px] font-black uppercase text-cyan-800 tracking-tight">Aguardando Profissional</span>
                                </button>
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
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-2xl border border-dashed border-gray-300">
                                    <AlertTriangle size={14} className="text-orange-500" />
                                    <p className="text-[9px] font-bold text-gray-600 leading-tight uppercase tracking-tight">
                                        BORDAS PONTILHADAS: Itens sem planejamento técnico. Exibidos pela data da solicitação original.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* SEÇÃO DA AGENDA */}
                        <div className="mb-8">
                            {events.length === 0 ? (
                                <div className="bg-white/50 border-2 border-dashed border-gray-200 rounded-[3rem] py-32 text-center">
                                    <AlertTriangle size={64} className="mx-auto text-yellow-400 mb-6" />
                                    <h2 className="text-xl font-black text-gray-900 uppercase mb-2">Sem registros na agenda</h2>
                                    <p className="text-gray-500 max-w-md mx-auto text-sm">
                                        Não encontramos nenhum compromisso agendado para o período selecionado.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {view === 'month' && (
                                        <>
                                            <div className="grid grid-cols-7 mb-3 px-2">
                                                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (<div key={day} className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest py-2">{day}</div>))}
                                            </div>
                                            {renderMonthView()}
                                        </>
                                    )}
                                    {view === 'week' && renderWeekView()}
                                    {view === 'day' && renderDayView()}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {isModalOpen && selectedEvent && (
                userType === 'consumidor' ? (
                    <ConsumerOrderModal
                        order={{
                            ...selectedEvent,
                            geral: selectedEvent.geralData,
                            planejamento: selectedEvent.planejamentoData ? [selectedEvent.planejamentoData] : [],
                            orcamentos: selectedEvent.orcamentoData ? [selectedEvent.orcamentoData] : [],
                            agenda: selectedEvent.agendaData ? [selectedEvent.agendaData] : [],
                            avaliacao: selectedEvent.avaliacao
                        }}
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        onUpdate={fetchData}
                        userUuid={currentUserId}
                    />
                ) : (
                    <ProfessionalOrderModal
                        order={{
                            ...selectedEvent,
                            geral: selectedEvent.geralData,
                            planejamento: selectedEvent.planejamentoData ? [selectedEvent.planejamentoData] : [],
                            orcamentos: selectedEvent.orcamentoData ? [selectedEvent.orcamentoData] : [],
                            agenda: selectedEvent.agendaData ? [selectedEvent.agendaData] : [],
                            clienteData: selectedEvent.clienteData,
                            profissionalData: selectedEvent.profissionalData,
                            avaliacao: selectedEvent.avaliacao
                        }}
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        onUpdate={fetchData}
                        userRole={userType}
                        userUuid={currentUserId}
                    />
                )
            )}
        </div>
    );
};

export default CalendarPage;
