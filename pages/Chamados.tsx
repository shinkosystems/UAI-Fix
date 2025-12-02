
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Chave, Geral, User, Orcamento, Planejamento } from '../types';
import { 
    Loader2, Search, Filter, Plus, X, Save, Send, FileText, 
    User as UserIcon, Calendar, DollarSign, CheckCircle, 
    AlertTriangle, ChevronRight, Ban, Clock, Briefcase, MapPin,
    Wallet, CreditCard, LayoutGrid, List, Package, Trash2, Hash
} from 'lucide-react';

interface ChamadoExtended extends Chave {
    geral?: Geral;
    clienteData?: User;
    profissionalData?: User;
    orcamentos?: Orcamento[];
    planejamento?: Planejamento[];
}

const Chamados: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'novos' | 'orcamentos' | 'execucao' | 'historico'>('novos');
    const [tickets, setTickets] = useState<ChamadoExtended[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');

    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ChamadoExtended | null>(null);
    const [saving, setSaving] = useState(false);

    // UI Control
    const [showBudgetForm, setShowBudgetForm] = useState(false);

    // Local State for Resource Input
    const [newResource, setNewResource] = useState('');

    // Form Data
    const [formData, setFormData] = useState({
        profissionalUuid: '',
        status: '',
        orcamentoPreco: 0,
        orcamentoCusto: 0,
        orcamentoLucro: 0,
        orcamentoTipoPgto: 'Dinheiro',
        orcamentoParcelas: 1,
        orcamentoObs: '',
        planejamentoDesc: '',
        planejamentoData: '',
        // Novos campos para exibir todos os dados do planejamento
        planejamentoRecursos: [] as string[],
        planejamentoPagamento: '',
        planejamentoVisita: ''
    });

    // Lists for selectors
    const [professionals, setProfessionals] = useState<User[]>([]);

    useEffect(() => {
        fetchData();
        fetchProfessionals();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Chaves
            const { data: chavesData, error: chavesError } = await supabase
                .from('chaves')
                .select('*')
                .order('created_at', { ascending: false });

            if (chavesError) throw chavesError;
            if (!chavesData) { setTickets([]); return; }

            const chaveIds = chavesData.map(c => c.id);
            const userIds = new Set<string>();
            const serviceIds = new Set<number>();
            
            chavesData.forEach(c => {
                if(c.cliente) userIds.add(c.cliente);
                if(c.profissional) userIds.add(c.profissional);
                if(c.atividade) serviceIds.add(c.atividade);
            });

            // Parallel Fetches
            const [usersRes, servicesRes, orcRes, planRes] = await Promise.all([
                userIds.size > 0 ? supabase.from('users').select('*').in('uuid', Array.from(userIds)) : { data: [] },
                serviceIds.size > 0 ? supabase.from('geral').select('*').in('id', Array.from(serviceIds)) : { data: [] },
                chaveIds.length > 0 ? supabase.from('orcamentos').select('*').in('chave', chaveIds) : { data: [] },
                chaveIds.length > 0 ? supabase.from('planejamento').select('*').in('chave', chaveIds) : { data: [] }
            ]);

            const usersMap: Record<string, User> = {};
            usersRes.data?.forEach((u: any) => usersMap[u.uuid] = u);

            const servicesMap: Record<number, Geral> = {};
            servicesRes.data?.forEach((s: any) => servicesMap[s.id] = s);

            const orcMap: Record<number, Orcamento[]> = {};
            orcRes.data?.forEach((o: any) => {
                if(!orcMap[o.chave]) orcMap[o.chave] = [];
                orcMap[o.chave].push(o);
            });

            const planMap: Record<number, Planejamento[]> = {};
            planRes.data?.forEach((p: any) => {
                if(!planMap[p.chave]) planMap[p.chave] = [];
                planMap[p.chave].push(p);
            });

            const enriched = chavesData.map(c => ({
                ...c,
                clienteData: usersMap[c.cliente],
                profissionalData: usersMap[c.profissional],
                geral: servicesMap[c.atividade],
                orcamentos: orcMap[c.id] || [],
                planejamento: planMap[c.id] || []
            }));

            setTickets(enriched);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchProfessionals = async () => {
        const { data } = await supabase.from('users').select('*').ilike('tipo', 'profissional').eq('ativo', true);
        if(data) setProfessionals(data);
    };

    const getFilteredTickets = () => {
        let filtered = tickets;
        
        // Tab Filter
        if (activeTab === 'novos') {
            filtered = filtered.filter(t => t.status === 'pendente');
        } else if (activeTab === 'orcamentos') {
            filtered = filtered.filter(t => t.status === 'analise' || t.status === 'aguardando_aprovacao' || t.status === 'reprovado');
        } else if (activeTab === 'execucao') {
            filtered = filtered.filter(t => t.status === 'aprovado' || t.status === 'executando');
        } else if (activeTab === 'historico') {
            filtered = filtered.filter(t => t.status === 'concluido' || t.status === 'cancelado');
        }

        // Search Filter
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(t => 
                t.chaveunica?.toLowerCase().includes(lower) ||
                t.geral?.nome.toLowerCase().includes(lower) ||
                t.clienteData?.nome.toLowerCase().includes(lower)
            );
        }

        return filtered;
    };

    const handleEdit = (ticket: ChamadoExtended) => {
        setEditingItem(ticket);
        setNewResource('');
        
        const hasBudget = ticket.orcamentos && ticket.orcamentos.length > 0;
        const budget = hasBudget ? ticket.orcamentos[0] : null;
        const plan = ticket.planejamento && ticket.planejamento.length > 0 ? ticket.planejamento[0] : null;

        // Logic 3: Hide budget data if not exists
        setShowBudgetForm(hasBudget);

        // Logic 2: Fix date display - Robust Timezone handling for datetime-local
        let formattedDate = '';
        let formattedVisita = '';

        if (plan?.execucao) {
            const d = new Date(plan.execucao);
            const offset = d.getTimezoneOffset() * 60000;
            formattedDate = new Date(d.getTime() - offset).toISOString().slice(0, 16);
        }

        if (plan?.visita) {
            const d = new Date(plan.visita);
            const offset = d.getTimezoneOffset() * 60000;
            formattedVisita = new Date(d.getTime() - offset).toISOString().slice(0, 16);
        }

        setFormData({
            profissionalUuid: ticket.profissional || '',
            status: (ticket.status || 'pendente').toLowerCase(), // Force lowercase for Select matching
            orcamentoPreco: budget?.preco || 0,
            orcamentoCusto: budget?.custofixo || 0,
            orcamentoLucro: budget?.lucro || 0,
            orcamentoTipoPgto: budget?.tipopagmto || 'Dinheiro',
            orcamentoParcelas: budget?.parcelas || 1,
            orcamentoObs: budget?.observacaocliente || '',
            planejamentoDesc: plan?.descricao || '',
            planejamentoData: formattedDate,
            // New fields population
            planejamentoRecursos: plan?.recursos || [],
            planejamentoPagamento: plan?.pagamento || 'hora',
            planejamentoVisita: formattedVisita
        });

        setIsModalOpen(true);
    };

    const handleCreateBudget = () => {
        setShowBudgetForm(true);
        setFormData(prev => ({
            ...prev,
            orcamentoPreco: 0,
            orcamentoCusto: 0,
            orcamentoLucro: 0,
            orcamentoTipoPgto: 'Dinheiro',
            orcamentoParcelas: 1,
            orcamentoObs: ''
        }));
    };

    const handleAddResource = () => {
        if (newResource.trim()) {
            setFormData(prev => ({
                ...prev,
                planejamentoRecursos: [...prev.planejamentoRecursos, newResource.trim()]
            }));
            setNewResource('');
        }
    };

    const handleRemoveResource = (index: number) => {
        setFormData(prev => ({
            ...prev,
            planejamentoRecursos: prev.planejamentoRecursos.filter((_, i) => i !== index)
        }));
    };

    const handleSave = async () => {
        if (!editingItem) return;
        setSaving(true);
        try {
            // 1. Update Chave (Status & Profissional)
            const { error: chaveError } = await supabase.from('chaves').update({
                profissional: formData.profissionalUuid || null,
                status: formData.status
            }).eq('id', editingItem.id);
            
            if (chaveError) throw chaveError;

            // 2. Upsert Budget (ONLY if form is visible)
            if (showBudgetForm) {
                const budgetPayload = {
                    chave: editingItem.id,
                    preco: parseFloat(formData.orcamentoPreco.toString()),
                    custofixo: parseFloat(formData.orcamentoCusto.toString()),
                    lucro: parseFloat(formData.orcamentoLucro.toString()),
                    tipopagmto: formData.orcamentoTipoPgto,
                    parcelas: parseInt(formData.orcamentoParcelas.toString()),
                    observacaocliente: formData.orcamentoObs,
                    ativo: true
                };
                
                if (editingItem.orcamentos && editingItem.orcamentos.length > 0) {
                     await supabase.from('orcamentos').update(budgetPayload).eq('id', editingItem.orcamentos[0].id);
                } else {
                     await supabase.from('orcamentos').insert(budgetPayload);
                }
            }

            // 3. Update Planning Description/Date/Resources/Payment/Visit
            if (editingItem.planejamento && editingItem.planejamento.length > 0) {
                const planUpdate: any = { 
                    descricao: formData.planejamentoDesc,
                    recursos: formData.planejamentoRecursos,
                    pagamento: formData.planejamentoPagamento
                };
                
                if (formData.planejamentoData) {
                    planUpdate.execucao = new Date(formData.planejamentoData).toISOString();
                }
                
                if (formData.planejamentoVisita) {
                    planUpdate.visita = new Date(formData.planejamentoVisita).toISOString();
                } else {
                    planUpdate.visita = null;
                }

                await supabase.from('planejamento').update(planUpdate).eq('id', editingItem.planejamento[0].id);
            }

            // Refresh
            await fetchData();
            setIsModalOpen(false);
            alert('Dados salvos com sucesso.');
        } catch (error: any) {
            console.error(error);
            alert('Erro ao salvar: ' + (error.message || JSON.stringify(error)));
        } finally {
            setSaving(false);
        }
    };

    const handleSendProposal = async () => {
        if (!editingItem) return;
        setSaving(true);
        try {
             const { error: chaveError } = await supabase.from('chaves').update({
                status: 'aguardando_aprovacao'
            }).eq('id', editingItem.id);
            if (chaveError) throw chaveError;

            if (showBudgetForm) {
                const budgetPayload = {
                    chave: editingItem.id,
                    preco: parseFloat(formData.orcamentoPreco.toString()),
                    custofixo: parseFloat(formData.orcamentoCusto.toString()),
                    lucro: parseFloat(formData.orcamentoLucro.toString()),
                    tipopagmto: formData.orcamentoTipoPgto,
                    parcelas: parseInt(formData.orcamentoParcelas.toString()),
                    observacaocliente: formData.orcamentoObs,
                    ativo: true
                };
                
                if (editingItem.orcamentos && editingItem.orcamentos.length > 0) {
                     await supabase.from('orcamentos').update(budgetPayload).eq('id', editingItem.orcamentos[0].id);
                } else {
                     await supabase.from('orcamentos').insert(budgetPayload);
                }
            }
            
            await fetchData();
            setIsModalOpen(false);
            alert('Proposta enviada ao cliente!');
        } catch (error: any) {
            alert('Erro ao enviar proposta: ' + (error.message || JSON.stringify(error)));
        } finally {
            setSaving(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'pendente': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'analise': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'aguardando_aprovacao': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'aprovado': return 'bg-green-100 text-green-800 border-green-200';
            case 'executando': return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'concluido': return 'bg-green-500 text-white border-green-600';
            case 'cancelado': return 'bg-red-100 text-red-800 border-red-200';
            case 'reprovado': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="min-h-screen bg-ios-bg pb-20">
             {/* Header */}
            <div className="bg-white/80 backdrop-blur-md px-5 pt-12 pb-4 sticky top-0 z-20 border-b border-gray-200">
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Chamados</h1>
                <p className="text-gray-500 text-sm mt-1">Gestão de serviços e orçamentos.</p>
            </div>

            <div className="p-5 max-w-7xl mx-auto space-y-6">
                
                {/* Tabs */}
                <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-1">
                    {[
                        { id: 'novos', label: 'Novos / Pendentes', icon: AlertTriangle },
                        { id: 'orcamentos', label: 'Orçamentos', icon: DollarSign },
                        { id: 'execucao', label: 'Em Execução', icon: Clock },
                        { id: 'historico', label: 'Histórico', icon: FileText }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center px-4 py-2.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${
                                activeTab === tab.id 
                                ? 'bg-black text-white border-black shadow-md' 
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            <tab.icon size={14} className="mr-2" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Filter */}
                <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                        type="text"
                        placeholder="Buscar por ID, Cliente ou Serviço..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-2xl py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-ios-blue/30"
                    />
                </div>

                {/* List */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {loading ? (
                         <div className="col-span-full flex justify-center py-10"><Loader2 className="animate-spin text-ios-blue"/></div>
                    ) : getFilteredTickets().length > 0 ? (
                        getFilteredTickets().map(ticket => (
                            <div 
                                key={ticket.id} 
                                onClick={() => handleEdit(ticket)}
                                className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer relative overflow-hidden group"
                            >
                                <div className={`absolute top-0 right-0 px-3 py-1.5 rounded-bl-2xl text-[10px] font-bold uppercase tracking-wide border-b border-l ${getStatusColor(ticket.status)}`}>
                                    {ticket.status.replace('_',' ')}
                                </div>

                                <div className="flex items-center space-x-3 mb-4">
                                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex-shrink-0 overflow-hidden">
                                        {ticket.geral?.imagem ? <img src={ticket.geral.imagem} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-gray-300"><FileText size={20}/></div>}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 leading-tight group-hover:text-ios-blue transition-colors">{ticket.geral?.nome}</h3>
                                        <div className="inline-flex items-center mt-1 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                            <Hash size={10} className="text-gray-400 mr-1" />
                                            <span className="text-[10px] font-black text-gray-700 font-mono tracking-wider">{ticket.chaveunica}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-50 p-3 rounded-xl flex items-center space-x-2 mb-3">
                                    <div className="w-8 h-8 rounded-full bg-white overflow-hidden border border-gray-100">
                                        <img src={ticket.clienteData?.fotoperfil || `https://ui-avatars.com/api/?name=${ticket.clienteData?.nome || 'U'}`} className="w-full h-full object-cover"/>
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">Cliente</p>
                                        <p className="text-xs font-bold text-gray-900 truncate">{ticket.clienteData?.nome}</p>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center text-xs text-gray-500">
                                    <div className="flex items-center">
                                        <Calendar size={12} className="mr-1"/>
                                        {new Date(ticket.created_at).toLocaleDateString()}
                                    </div>
                                    {ticket.orcamentos && ticket.orcamentos.length > 0 ? (
                                        <div className="flex items-center font-bold text-green-600">
                                            <DollarSign size={12} className="mr-1"/>
                                            R$ {ticket.orcamentos[0].preco.toFixed(2)}
                                        </div>
                                    ) : (
                                        <div className="text-orange-400 font-bold flex items-center">
                                            <AlertTriangle size={12} className="mr-1"/> Sem Orçamento
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full text-center py-12 text-gray-400">
                            Nenhum chamado encontrado.
                        </div>
                    )}
                </div>
            </div>

            {/* --- DETAILS MODAL --- */}
            {isModalOpen && editingItem && (
                 <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                        
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg">{editingItem.geral?.nome}</h3>
                                <div className="flex items-center mt-1">
                                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-xs font-black font-mono tracking-wider flex items-center border border-gray-200">
                                        <Hash size={10} className="mr-1 opacity-50"/> {editingItem.chaveunica}
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6">
                            
                            {/* Status and Assignment */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Status do Pedido</label>
                                    <div className="relative">
                                        <select 
                                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-3 text-xs font-bold outline-none capitalize focus:ring-2 focus:ring-black/10"
                                            value={formData.status}
                                            onChange={(e) => setFormData({...formData, status: e.target.value})}
                                        >
                                            <option value="pendente">Pendente</option>
                                            <option value="analise">Em Análise</option>
                                            <option value="aguardando_aprovacao">Aguardando Aprovação</option>
                                            <option value="aprovado">Aprovado</option>
                                            <option value="executando">Executando</option>
                                            <option value="concluido">Concluído</option>
                                            <option value="cancelado">Cancelado</option>
                                            <option value="reprovado">Reprovado</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Profissional</label>
                                    <select 
                                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-3 text-xs font-bold outline-none"
                                        value={formData.profissionalUuid}
                                        onChange={(e) => setFormData({...formData, profissionalUuid: e.target.value})}
                                    >
                                        <option value="">Selecione...</option>
                                        {professionals.map(p => (
                                            <option key={p.uuid} value={p.uuid}>{p.nome}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Planning Info (Full Editing) */}
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center">
                                    <FileText size={12} className="mr-1"/> Detalhes do Planejamento
                                </h4>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 ml-1">Execução (Data Desejada)</label>
                                        <input 
                                            type="datetime-local" 
                                            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-medium text-gray-900 outline-none focus:ring-2 focus:ring-blue-100"
                                            value={formData.planejamentoData}
                                            onChange={(e) => setFormData({...formData, planejamentoData: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 ml-1">Visita Técnica</label>
                                        <input 
                                            type="datetime-local" 
                                            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-medium text-gray-900 outline-none focus:ring-2 focus:ring-blue-100"
                                            value={formData.planejamentoVisita}
                                            onChange={(e) => setFormData({...formData, planejamentoVisita: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 ml-1">Tipo de Pagamento</label>
                                    <select 
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-medium text-gray-900 outline-none"
                                        value={formData.planejamentoPagamento}
                                        onChange={(e) => setFormData({...formData, planejamentoPagamento: e.target.value})}
                                    >
                                        <option value="">Selecione...</option>
                                        <option value="hora">Por Hora</option>
                                        <option value="empreitada">Por Empreitada</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 ml-1">Descrição do Problema</label>
                                    <textarea 
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs resize-none text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
                                        rows={3}
                                        value={formData.planejamentoDesc}
                                        onChange={(e) => setFormData({...formData, planejamentoDesc: e.target.value})}
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                     <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center"><Package size={10} className="mr-1"/>Recursos / Materiais</label>
                                     <div className="flex gap-2 mb-2">
                                         <input 
                                             type="text"
                                             placeholder="Adicionar recurso..."
                                             className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-xs outline-none"
                                             value={newResource}
                                             onChange={(e) => setNewResource(e.target.value)}
                                             onKeyDown={(e) => e.key === 'Enter' && handleAddResource()}
                                         />
                                         <button onClick={handleAddResource} className="bg-gray-200 hover:bg-gray-300 text-gray-700 p-2 rounded-lg">
                                             <Plus size={14} />
                                         </button>
                                     </div>
                                     {formData.planejamentoRecursos.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {formData.planejamentoRecursos.map((r, i) => (
                                                <div key={i} className="flex items-center text-[10px] bg-white border border-gray-200 px-2 py-1 rounded-lg text-gray-600 font-medium">
                                                    <span>{r}</span>
                                                    <button onClick={() => handleRemoveResource(i)} className="ml-1 text-red-400 hover:text-red-600">
                                                        <Trash2 size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                     ) : (
                                        <p className="text-xs font-medium text-gray-300 mt-0.5 italic">Nenhum recurso listado</p>
                                     )}
                                </div>
                            </div>

                            {/* Budget Section */}
                            {!showBudgetForm ? (
                                <div className="bg-blue-50/50 p-6 rounded-2xl border border-dashed border-blue-200 text-center">
                                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-blue-500">
                                        <DollarSign size={20} />
                                    </div>
                                    <h4 className="font-bold text-gray-900 text-sm">Nenhum orçamento criado</h4>
                                    <p className="text-xs text-gray-500 mb-4 mt-1">Este pedido ainda não possui valores definidos.</p>
                                    <button 
                                        onClick={handleCreateBudget}
                                        className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
                                    >
                                        Gerar Orçamento
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                                    <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center justify-between">
                                        <span className="flex items-center"><DollarSign size={12} className="mr-1"/> Dados do Orçamento</span>
                                        <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">Editando</span>
                                    </h4>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-blue-500 ml-1">Preço Final (R$)</label>
                                            <input 
                                                type="number"
                                                className="w-full bg-white border border-blue-200 rounded-xl p-2 text-sm font-bold text-blue-900 focus:ring-2 focus:ring-blue-300 outline-none"
                                                value={formData.orcamentoPreco}
                                                onChange={(e) => setFormData({...formData, orcamentoPreco: parseFloat(e.target.value)})}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-blue-500 ml-1">Custo Estimado (R$)</label>
                                            <input 
                                                type="number"
                                                className="w-full bg-white border border-blue-200 rounded-xl p-2 text-xs"
                                                value={formData.orcamentoCusto}
                                                onChange={(e) => setFormData({...formData, orcamentoCusto: parseFloat(e.target.value)})}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-blue-500 ml-1">Tipo Pagamento</label>
                                            <select 
                                                className="w-full bg-white border border-blue-200 rounded-xl p-2 text-xs"
                                                value={formData.orcamentoTipoPgto}
                                                onChange={(e) => setFormData({...formData, orcamentoTipoPgto: e.target.value})}
                                            >
                                                <option value="Dinheiro">Dinheiro</option>
                                                <option value="PIX">PIX</option>
                                                <option value="Cartão">Cartão</option>
                                                <option value="Boleto">Boleto</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-blue-500 ml-1">Parcelas</label>
                                            <input 
                                                type="number"
                                                min="1"
                                                className="w-full bg-white border border-blue-200 rounded-xl p-2 text-xs"
                                                value={formData.orcamentoParcelas}
                                                onChange={(e) => setFormData({...formData, orcamentoParcelas: parseInt(e.target.value)})}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-blue-500 ml-1">Obs. para Cliente</label>
                                        <textarea 
                                            className="w-full bg-white border border-blue-200 rounded-xl p-3 text-xs resize-none"
                                            rows={2}
                                            value={formData.orcamentoObs}
                                            onChange={(e) => setFormData({...formData, orcamentoObs: e.target.value})}
                                            placeholder="Detalhes sobre a proposta..."
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-6 border-t border-gray-100 bg-gray-50 mt-auto space-y-3">
                            
                            {/* Send Proposal Button (Only in Budget Tab and if status permits) */}
                            {showBudgetForm && 
                             editingItem?.status !== 'aguardando_aprovacao' && 
                             editingItem?.status !== 'aprovado' && 
                             editingItem?.status !== 'executando' && 
                             editingItem?.status !== 'concluido' && (
                                <button 
                                    onClick={handleSendProposal}
                                    disabled={saving}
                                    className="w-full bg-blue-600 text-white hover:bg-blue-700 py-3.5 rounded-2xl font-bold shadow-lg shadow-blue-200 active:scale-[0.98] transition-all flex justify-center items-center space-x-2"
                                >
                                    <Send size={18} />
                                    <span>Enviar Proposta ao Cliente</span>
                                </button>
                            )}
                            
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

export default Chamados;
