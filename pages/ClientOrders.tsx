
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { User, Geral, Chave, Orcamento, Planejamento, Avaliacao, Agenda, OrdemServico } from '../types';
import {
    Loader2, X, Star, Calendar, Clock, ChevronRight, Send, Plus, Check, Ban,
    AlertCircle, Camera, Save, Trash2, ThumbsUp, ThumbsDown, Lock, Banknote,
    MapPin, UserCheck, Play, CreditCard, Smartphone, MessageSquare, Sparkles, Tag,
    Filter, ListChecks, CalendarCheck, Activity, History
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import ConsumerTab from '../components/modals/ConsumerTab';
import ConsumerOrderModal from '../components/modals/ConsumerOrderModal';

interface OrderExtended extends Chave {
    geral: Geral;
    profissional: User | null;
    orcamentos: Orcamento[];
    planejamento: Planejamento[];
    avaliacao?: Avaliacao;
    agenda?: Agenda[];
    ordemServico?: OrdemServico[];
}

type ModalTab = 'geral' | 'consumidor' | 'fotos' | 'obs' | 'avaliacao';
type FilterType = 'todos' | 'aberto' | 'agendados' | 'execucao' | 'reprovados' | 'finalizados';

const ClientOrders: React.FC = () => {
    const [orders, setOrders] = useState<OrderExtended[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<OrderExtended | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<ModalTab>('geral');
    const [activeFilter, setActiveFilter] = useState<FilterType>('todos');
    const [userType, setUserType] = useState<string>('');
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [processingAction, setProcessingAction] = useState(false);

    const [submittingRating, setSubmittingRating] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();

    const isMediaVideo = (url: string) => {
        if (!url) return false;
        const cleanPath = url.split('?')[0].toLowerCase();
        const videoExtensions = ['.mp4', '.mov', '.webm', '.quicktime', '.m4v', '.3gp', '.mkv'];
        return videoExtensions.some(ext => cleanPath.endsWith(ext)) || url.toLowerCase().includes('video');
    };

    const extractOriginalDesc = (desc: string | undefined | null) => {
        if (!desc) return "";
        const firstMarkerIndex = desc.indexOf('\n\n[');
        if (firstMarkerIndex !== -1) {
            return desc.substring(0, firstMarkerIndex).trim();
        }
        return desc.trim();
    };

    useEffect(() => { fetchOrders(); }, []);

    useEffect(() => {
        if (!loading && location.state?.ratingOrderId && orders.length > 0) {
            const order = orders.find(o => o.id === location.state.ratingOrderId);
            if (order) {
                handleOpenDetails(order);
            }
        }
    }, [loading, location.state, orders]);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUserId(user.id);
                const { data } = await supabase.from('users').select('tipo').eq('uuid', user.id).single();
                const role = data?.tipo || '';
                setUserType(role);

                const normRole = role.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                if (normRole !== 'consumidor' && normRole !== 'gestor') {
                    navigate('/home');
                    return;
                }

                await loadData(user.id);
            }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const loadData = async (uuid: string) => {
        let query = supabase.from('chaves').select('*').eq('cliente', uuid).order('id', { ascending: false });

        const { data: chavesData } = await query;
        if (!chavesData?.length) { setOrders([]); return; }

        const ids = chavesData.map(c => c.id);
        const [services, users, budgets, plans, reviews, agenda, os] = await Promise.all([
            supabase.from('geral').select('*'),
            supabase.from('users').select('*'),
            supabase.from('orcamentos').select('*').in('chave', ids),
            supabase.from('planejamento').select('*').in('chave', ids),
            supabase.from('avaliacoes').select('*').in('chave', ids),
            supabase.from('agenda').select('*').in('chave', ids),
            supabase.from('ordemservico').select('*').in('chave', ids)
        ]);

        const sMap = Object.fromEntries(services.data?.map(s => [s.id, s]) || []);
        const uMap = Object.fromEntries(users.data?.map(u => [u.uuid, u]) || []);

        setOrders(chavesData.map(c => {
            const proUuid = typeof c.profissional === 'string' ? c.profissional : (c.profissional as any)?.uuid;

            return {
                ...c,
                geral: sMap[c.atividade],
                profissional: uMap[proUuid] || null,
                orcamentos: budgets.data?.filter(b => b.chave === c.id) || [],
                planejamento: plans.data?.filter(p => p.chave === c.id) || [],
                avaliacao: reviews.data?.find(r => r.chave === c.id),
                agenda: agenda.data?.filter(a => a.chave === c.id) || [],
                ordemServico: os.data?.filter(o => o.chave === c.id) || []
            };
        }));
    };

    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            if (activeFilter === 'todos') return true;
            const status = order.status.toLowerCase();
            if (activeFilter === 'aberto') return ['pendente', 'analise', 'aguardando_aprovacao', 'aguardando_profissional'].includes(status);
            if (activeFilter === 'agendados') return status === 'aprovado';
            if (activeFilter === 'execucao') return status === 'executando';
            if (activeFilter === 'reprovados') return status === 'reprovado';
            if (activeFilter === 'finalizados') return status === 'concluido' || status === 'cancelado';
            return true;
        });
    }, [orders, activeFilter]);

    const filterCounts = useMemo(() => {
        return {
            todos: orders.length,
            aberto: orders.filter(o => ['pendente', 'analise', 'aguardando_aprovacao', 'aguardando_profissional'].includes(o.status.toLowerCase())).length,
            agendados: orders.filter(o => o.status.toLowerCase() === 'aprovado').length,
            execucao: orders.filter(o => o.status.toLowerCase() === 'executando').length,
            reprovados: orders.filter(o => o.status.toLowerCase() === 'reprovado').length,
            finalizados: orders.filter(o => ['concluido', 'cancelado'].includes(o.status.toLowerCase())).length
        };
    }, [orders]);

    const handleOpenDetails = (order: OrderExtended) => {
        setSelectedOrder(order);
        setIsModalOpen(true);
    };

    const handleSubmitRating = async () => {
        // Obsoleto, lógica movida para o modal
    };

    const getStatusColor = (s: string | undefined) => {
        switch (s?.toLowerCase()) {
            case 'concluido': return 'bg-green-100 text-green-900 border-green-200';
            case 'executando': return 'bg-purple-100 text-purple-900 border-purple-200';
            case 'aguardando_aprovacao': return 'bg-orange-100 text-orange-900 border-orange-200';
            case 'aguardando_profissional': return 'bg-cyan-100 text-cyan-900 border-cyan-200';
            case 'cancelado': return 'bg-red-100 text-red-900 border-red-200';
            case 'aprovado': return 'bg-green-50 text-green-700 border-green-100';
            case 'reprovado': return 'bg-red-50 text-red-700 border-red-100';
            default: return 'bg-blue-100 text-blue-900 border-blue-200';
        }
    };

    const getStatusLabel = (s: string) => {
        switch (s?.toLowerCase()) {
            case 'aguardando_aprovacao': return 'Proposta Recebida';
            case 'aguardando_profissional': return 'Aguardando Profissional';
            case 'aprovado': return 'Agendado';
            case 'reprovado': return 'Proposta Negada';
            default: return s.replace('_', ' ');
        }
    }

    const filterButtons = [
        { id: 'todos', label: 'Tudo', icon: Filter },
        { id: 'aberto', label: 'Em Análise', icon: ListChecks },
        { id: 'agendados', label: 'Agendados', icon: CalendarCheck },
        { id: 'execucao', label: 'Em Execução', icon: Activity },
        { id: 'reprovados', label: 'Reprovados', icon: Ban },
        { id: 'finalizados', label: 'Histórico', icon: History },
    ];

    return (
        <div className="min-h-screen bg-ios-bg pb-20">
            <div className="bg-white/80 backdrop-blur-md px-5 pt-12 pb-4 sticky top-0 z-20 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Meus Pedidos</h1>
                    <button onClick={() => navigate('/search')} className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all"><Plus size={16} /><span>Novo Pedido</span></button>
                </div>

                {/* FILTRO DE STATUS (ESTILO CHIPS iOS 26) */}
                <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-1">
                    {filterButtons.map((btn) => (
                        <button
                            key={btn.id}
                            onClick={() => setActiveFilter(btn.id as FilterType)}
                            className={`flex items-center px-4 py-2 rounded-full text-xs font-bold border transition-all whitespace-nowrap gap-2 ${activeFilter === btn.id
                                ? 'bg-black text-white border-black shadow-md scale-105'
                                : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50 active:scale-95'
                                }`}
                        >
                            <btn.icon size={14} />
                            <span>{btn.label}</span>
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeFilter === btn.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                {filterCounts[btn.id as keyof typeof filterCounts]}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-5 space-y-6 max-w-4xl mx-auto">
                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ios-blue" /></div>
                ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-[2.5rem] border-dashed border-2 border-gray-100 text-gray-400 space-y-4 animate-in fade-in zoom-in duration-500">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-200">
                            <ListChecks size={40} />
                        </div>
                        <div className="space-y-1">
                            <p className="font-black uppercase tracking-widest text-xs">Vazio por aqui</p>
                            <p className="text-[10px] font-bold text-gray-300">Nenhum pedido encontrado nesta categoria.</p>
                        </div>
                        {activeFilter !== 'todos' && (
                            <button onClick={() => setActiveFilter('todos')} className="text-ios-blue text-[10px] font-black uppercase tracking-widest hover:underline">Ver todos os pedidos</button>
                        )}
                    </div>
                ) : (
                    filteredOrders.map(order => (
                        <div key={order.id} onClick={() => handleOpenDetails(order)} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 transition-all cursor-pointer hover:shadow-md active:scale-[0.98] relative overflow-hidden group animate-in slide-in-from-bottom-2 duration-300">
                            <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl text-[10px] font-black uppercase tracking-wider border-l border-b transition-colors ${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</div>
                            <div className="flex items-center space-x-4 mt-2 mb-4">
                                <div className="w-14 h-14 bg-gray-100 rounded-2xl overflow-hidden shadow-inner flex-shrink-0">{order.geral?.imagem ? <img src={order.geral.imagem} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><Calendar size={24} /></div>}</div>
                                <div className="min-w-0 flex-1"><h3 className="font-bold text-gray-900 text-lg leading-tight truncate group-hover:text-ios-blue transition-colors">{order.geral?.nome}</h3><p className="text-[10px] font-mono font-black text-gray-400 uppercase mt-0.5 tracking-widest">ID: {order.chaveunica}</p></div>
                            </div>
                            <div className="flex justify-between items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                                <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 rounded-full bg-white border border-gray-200 overflow-hidden"><img src={order.profissional?.fotoperfil || `https://ui-avatars.com/api/?name=${order.profissional?.nome || 'U'}`} className="w-full h-full object-cover" /></div>
                                    <div className="min-w-0"><p className="text-[9px] font-black text-gray-400 uppercase leading-none mb-1">Profissional</p><p className="text-xs font-bold text-gray-900 truncate">{order.profissional?.nome || 'Não definido'}</p></div>
                                </div>
                                <div className="text-right">
                                    {order.orcamentos?.length > 0 && order.status.toLowerCase() !== 'aguardando_profissional' ? (
                                        <span className="text-base font-black text-gray-900">R$ {order.orcamentos[0].preco.toFixed(2)}</span>
                                    ) : (
                                        <span className="text-[10px] font-black text-gray-400 uppercase">
                                            {order.status.toLowerCase() === 'aguardando_profissional' ? 'Aguardando Profissional' : 'Aguardando Orçamento'}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {order.status === 'aguardando_aprovacao' && (
                                <div className="mt-4 pt-3 border-t border-orange-100 flex items-center justify-between">
                                    <p className="text-[10px] font-black text-orange-600 uppercase flex items-center gap-1"><AlertCircle size={12} /> Orçamento pronto!</p>
                                    <div className="bg-orange-500 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg animate-pulse">Decidir Agora</div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {isModalOpen && selectedOrder && (
                <ConsumerOrderModal
                    order={selectedOrder}
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onUpdate={fetchOrders}
                    userUuid={currentUserId}
                />
            )}
        </div>
    );
};

export default ClientOrders;
