
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Chave, Geral, User, Orcamento, Planejamento } from '../types';
import { 
    Loader2, Search, Filter, Plus, X, Save, Send, FileText, 
    User as UserIcon, Calendar, DollarSign, CheckCircle, 
    AlertTriangle, ChevronRight, Ban, Clock, Briefcase, MapPin,
    Wallet, CreditCard, LayoutGrid, List, Package, Trash2, Hash, Percent, Calculator, Lock, ArrowRightCircle, Bell
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ChamadoExtended extends Chave {
    geral?: Geral;
    clienteData?: User;
    profissionalData?: User;
    orcamentos?: Orcamento[];
    planejamento?: Planejamento[];
}

interface NotificationItem {
  id: number;
  title: string;
  description: string;
  date: string;
  type: 'agenda' | 'planning';
  read: boolean;
}

const Chamados: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'novos' | 'orcamentos' | 'execucao' | 'historico'>('novos');
    const [tickets, setTickets] = useState<ChamadoExtended[]>([]);
    const [loading, setLoading] = useState(true);
    
    // User Role State
    const [currentUserRole, setCurrentUserRole] = useState<string>('');
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const notificationRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

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
        
        // Dados de Orçamento Detalhado
        orcamentoPreco: 0,
        orcamentoCusto: 0, 
        orcamentoCustoVariavel: 0,
        orcamentoHH: 0, 
        orcamentoImposto: 0,
        orcamentoLucro: 0,

        orcamentoTipoPgto: 'Dinheiro',
        orcamentoParcelas: 1,
        orcamentoObs: '',
        orcamentoNotaFiscal: false,
        
        planejamentoDesc: '',
        planejamentoData: '',
        planejamentoRecursos: [] as string[],
        planejamentoPagamento: '',
        planejamentoVisita: ''
    });

    const [professionals, setProfessionals] = useState<User[]>([]);

    const allTabs = [
        { id: 'novos', label: 'Novos / Pendentes', icon: AlertTriangle },
        { id: 'orcamentos', label: 'Orçamentos', icon: DollarSign },
        { id: 'execucao', label: 'Em Execução', icon: Clock },
        { id: 'historico', label: 'Histórico', icon: FileText }
    ];

    const visibleTabs = allTabs.filter(tab => {
        if (currentUserRole === 'planejista') {
            return tab.id === 'novos' || tab.id === 'historico';
        }
        if (currentUserRole === 'orcamentista') {
            return tab.id === 'novos' || tab.id === 'orcamentos' || tab.id === 'execucao' || tab.id === 'historico';
        }
        if (currentUserRole === 'profissional') {
            return tab.id === 'execucao' || tab.id === 'historico';
        }
        return true;
    });

    useEffect(() => {
        fetchUserRole();
        fetchData();
        fetchProfessionals();

        const handleClickOutside = (event: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (currentUserRole === 'planejista' || currentUserRole === 'orcamentista') {
            setActiveTab('novos');
        } else if (currentUserRole === 'profissional') {
            setActiveTab('execucao');
        }
    }, [currentUserRole]);

    useEffect(() => {
        if (showBudgetForm) {
            const custoFixo = parseFloat(formData.orcamentoCusto.toString()) || 0;
            const custoVariavel = parseFloat(formData.orcamentoCustoVariavel.toString()) || 0;
            const hh = parseFloat(formData.orcamentoHH.toString()) || 0;
            const imposto = parseFloat(formData.orcamentoImposto.toString()) || 0;
            const lucro = parseFloat(formData.orcamentoLucro.toString()) || 0;

            const total = custoFixo + custoVariavel + hh + imposto + lucro;
            
            if (total !== formData.orcamentoPreco) {
                setFormData(prev => ({ ...prev, orcamentoPreco: total }));
            }
        }
    }, [
        formData.orcamentoCusto, 
        formData.orcamentoCustoVariavel, 
        formData.orcamentoHH, 
        formData.orcamentoImposto, 
        formData.orcamentoLucro
    ]);

    const fetchUserRole = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setCurrentUserId(user.id);
            const { data: userData } = await supabase.from('users').select('tipo').eq('uuid', user.id).single();
            if (userData) {
                // Normalize role to handle accents (e.g. Orçamentista -> orcamentista)
                const normalizedRole = userData.tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                setCurrentUserRole(normalizedRole);
                fetchNotifications(normalizedRole, user.id);
            }
        }
    };

    const fetchNotifications = async (role: string, uuid: string) => {
      // Role already normalized from fetchUserRole
      let notifs: NotificationItem[] = [];

      try {
          if (role === 'planejista' || role === 'orcamentista') {
              const { data } = await supabase
                  .from('planejamento')
                  .select(`id, created_at, descricao, chaves (chaveunica, geral (nome))`)
                  .eq('ativo', true)
                  .order('created_at', { ascending: false })
                  .limit(10);
              
              if (data) {
                  notifs = data.map((item: any) => ({
                      id: item.id,
                      title: 'Planejamento Ativo',
                      description: `Chave: ${item.chaves?.chaveunica} - ${item.chaves?.geral?.nome}`,
                      date: new Date(item.created_at).toLocaleDateString('pt-BR'),
                      type: 'planning',
                      read: false
                  }));
              }
          } 
          setNotifications(notifs);
      } catch (error) {
          console.error("Erro ao buscar notificações:", error);
      }
    };

    const handleNotificationClick = (notif: NotificationItem) => {
      setShowNotifications(false);
      navigate('/chamados');
    };

    const fetchData = async () => {
        setLoading(true);
        try {
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
        
        // Regra de segurança: Profissional só vê o que é dele
        if (currentUserRole === 'profissional') {
            filtered = filtered.filter(t => t.profissional === currentUserId);
        }

        if (activeTab === 'novos') {
            if (currentUserRole === 'planejista') {
                filtered = filtered.filter(t => t.status === 'pendente');
            } else if (currentUserRole === 'orcamentista') {
                filtered = filtered.filter(t => t.status === 'analise');
            } else {
                filtered = filtered.filter(t => t.status === 'pendente' || t.status === 'analise');
            }
        } else if (activeTab === 'orcamentos') {
            filtered = filtered.filter(t => t.status === 'aguardando_aprovacao' || t.status === 'reprovado');
        } else if (activeTab === 'execucao') {
            filtered = filtered.filter(t => t.status === 'aprovado' || t.status === 'executando');
        } else if (activeTab === 'historico') {
            filtered = filtered.filter(t => t.status === 'concluido' || t.status === 'cancelado');
        }

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

    const hasExistingBudget = () => {
        return editingItem?.orcamentos && editingItem.orcamentos.length > 0;
    };

    const isExecutingOrDone = () => {
        const s = formData.status?.toLowerCase();
        return s === 'executando' || s === 'concluido' || s === 'cancelado';
    };

    const canEditPlanning = () => {
        if (currentUserRole === 'gestor') return true;
        if (currentUserRole === 'planejista') {
            return !hasExistingBudget();
        }
        return false;
    };

    const canEditBudget = () => {
        if (currentUserRole === 'gestor') return true;
        if (currentUserRole === 'orcamentista') {
            return !isExecutingOrDone();
        }
        return false; 
    };

    const canEditStatus = () => {
        if (currentUserRole === 'gestor') return true;
        
        // Regra específica para Profissional:
        // Não pode alterar se o chamado JÁ estiver Concluído ou Cancelado
        if (currentUserRole === 'profissional') {
            const currentStatus = editingItem?.status?.toLowerCase();
            if (currentStatus === 'concluido' || currentStatus === 'cancelado') {
                return false;
            }
            return true;
        }

        if (currentUserRole === 'orcamentista') {
            return !isExecutingOrDone();
        }
        if (currentUserRole === 'planejista') {
            return !hasExistingBudget();
        }
        return false;
    };

    const handleEdit = (ticket: ChamadoExtended) => {
        setEditingItem(ticket);
        setNewResource('');
        
        const hasBudget = ticket.orcamentos && ticket.orcamentos.length > 0;
        const budget = hasBudget ? ticket.orcamentos[0] : null;
        const plan = ticket.planejamento && ticket.planejamento.length > 0 ? ticket.planejamento[0] : null;

        setShowBudgetForm(hasBudget);

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
            profissionalUuid: (ticket.profissional as string) || '',
            status: (ticket.status || 'pendente').toLowerCase(), 
            
            orcamentoPreco: budget?.preco || 0,
            orcamentoCusto: budget?.custofixo || 0,
            orcamentoCustoVariavel: budget?.custovariavel || 0,
            orcamentoHH: budget?.hh || 0,
            orcamentoImposto: budget?.imposto || 0,
            orcamentoLucro: budget?.lucro || 0,
            
            orcamentoTipoPgto: budget?.tipopagmto || 'Dinheiro',
            orcamentoParcelas: budget?.parcelas || 1,
            orcamentoObs: budget?.observacaocliente || '',
            orcamentoNotaFiscal: budget?.notafiscal || false,
            
            planejamentoDesc: plan?.descricao || '',
            planejamentoData: formattedDate,
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
            orcamentoCustoVariavel: 0,
            orcamentoHH: 0,
            orcamentoImposto: 0,
            orcamentoLucro: 0,
            orcamentoTipoPgto: 'Dinheiro',
            orcamentoParcelas: 1,
            orcamentoObs: '',
            orcamentoNotaFiscal: false
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

    const handleSendToBudget = async () => {
        if (!editingItem) return;
        setSaving(true);
        try {
            const { error: chaveError } = await supabase
                .from('chaves')
                .update({ status: 'analise' })
                .eq('id', editingItem.id);
            
            if (chaveError) throw chaveError;

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

            await fetchData();
            setIsModalOpen(false);
            alert('Enviado para o Orçamentista com sucesso!');
        } catch (error: any) {
            alert('Erro: ' + (error.message || JSON.stringify(error)));
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        if (!editingItem) return;
        setSaving(true);
        try {
            if (canEditStatus()) {
                const { error: chaveError } = await supabase.from('chaves').update({
                    profissional: formData.profissionalUuid || null,
                    status: formData.status
                }).eq('id', editingItem.id);
                if (chaveError) throw chaveError;
            }

            if (showBudgetForm && canEditBudget()) {
                const budgetPayload = {
                    chave: editingItem.id,
                    preco: parseFloat(formData.orcamentoPreco.toString()),
                    custofixo: parseFloat(formData.orcamentoCusto.toString()),
                    custovariavel: parseFloat(formData.orcamentoCustoVariavel.toString()),
                    hh: parseFloat(formData.orcamentoHH.toString()),
                    imposto: parseFloat(formData.orcamentoImposto.toString()),
                    lucro: parseFloat(formData.orcamentoLucro.toString()),
                    tipopagmto: formData.orcamentoTipoPgto,
                    parcelas: parseInt(formData.orcamentoParcelas.toString()),
                    observacaocliente: formData.orcamentoObs,
                    notafiscal: formData.orcamentoNotaFiscal,
                    ativo: true
                };
                
                if (editingItem.orcamentos && editingItem.orcamentos.length > 0) {
                     await supabase.from('orcamentos').update(budgetPayload).eq('id', editingItem.orcamentos[0].id);
                } else {
                     await supabase.from('orcamentos').insert(budgetPayload);
                }
            }

            if (canEditPlanning() && editingItem.planejamento && editingItem.planejamento.length > 0) {
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

            if (showBudgetForm && canEditBudget()) {
                const budgetPayload = {
                    chave: editingItem.id,
                    preco: parseFloat(formData.orcamentoPreco.toString()),
                    custofixo: parseFloat(formData.orcamentoCusto.toString()),
                    custovariavel: parseFloat(formData.orcamentoCustoVariavel.toString()),
                    hh: parseFloat(formData.orcamentoHH.toString()),
                    imposto: parseFloat(formData.orcamentoImposto.toString()),
                    lucro: parseFloat(formData.orcamentoLucro.toString()),
                    tipopagmto: formData.orcamentoTipoPgto,
                    parcelas: parseInt(formData.orcamentoParcelas.toString()),
                    observacaocliente: formData.orcamentoObs,
                    notafiscal: formData.orcamentoNotaFiscal,
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
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Chamados</h1>
                        <p className="text-gray-500 text-sm mt-1">Gestão de serviços e orçamentos.</p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                        {/* Role Badge */}
                        <div className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold uppercase text-gray-500 border border-gray-200">
                            {currentUserRole || 'Carregando...'}
                        </div>
                        
                         {/* Notification Bell */}
                         <div className="relative" ref={notificationRef}>
                            <button 
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="relative p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                                <Bell size={20} className="text-gray-700" />
                                {notifications.length > 0 && (
                                    <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full ring-1 ring-white"></span>
                                )}
                            </button>
                            
                            {showNotifications && (
                                <div className="absolute right-0 top-12 w-80 bg-white/95 backdrop-blur-xl border border-gray-200 shadow-2xl rounded-[1.5rem] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                        <h3 className="font-bold text-gray-900 text-sm">Notificações</h3>
                                        <button onClick={() => setShowNotifications(false)}><X size={16} className="text-gray-400"/></button>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        {notifications.length > 0 ? (
                                            notifications.map((notif) => (
                                                <div key={notif.id} onClick={() => handleNotificationClick(notif)} className="p-4 border-b border-gray-50 hover:bg-blue-50 cursor-pointer">
                                                    <div className="flex justify-between mb-1"><span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded font-bold uppercase">{notif.type}</span><span className="text-[10px] text-gray-400">{notif.date}</span></div>
                                                    <h4 className="text-sm font-bold text-gray-900">{notif.title}</h4>
                                                    <p className="text-xs text-gray-500 truncate">{notif.description}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-6 text-center text-xs text-gray-400">Nenhuma notificação nova.</div>
                                        )}
                                    </div>
                                </div>
                            )}
                         </div>
                    </div>
                </div>
            </div>

            <div className="p-5 max-w-7xl mx-auto space-y-6">
                
                {/* Tabs */}
                <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-1">
                    {visibleTabs.map(tab => (
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

                        {/* Content Area - ADDED FLEX-1 to allow scrolling */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            {/* Status and Assignment */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Status do Pedido</label>
                                    <div className="relative">
                                        <select 
                                            className={`w-full bg-gray-50 border border-gray-100 rounded-2xl p-3 text-xs font-bold text-black outline-none capitalize focus:ring-2 focus:ring-black/10 ${!canEditStatus() ? 'opacity-60 cursor-not-allowed' : ''}`}
                                            value={formData.status}
                                            disabled={!canEditStatus()}
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
                                        className={`w-full bg-gray-50 border border-gray-100 rounded-2xl p-3 text-xs font-bold text-black outline-none ${!canEditPlanning() ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        value={formData.profissionalUuid}
                                        disabled={!canEditPlanning()}
                                        onChange={(e) => setFormData({...formData, profissionalUuid: e.target.value})}
                                    >
                                        <option value="">Selecione...</option>
                                        {professionals.map(p => (
                                            <option key={p.uuid} value={p.uuid}>{p.nome}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                             {/* Planning Info (Controlled by Role) */}
                            <div className={`bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3 relative ${!canEditPlanning() ? 'opacity-90' : ''}`}>
                                {!canEditPlanning() && (
                                    <div className="absolute top-2 right-2 text-gray-400" title="Somente leitura">
                                        <Lock size={14} />
                                    </div>
                                )}
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center">
                                    <FileText size={12} className="mr-1"/> Detalhes do Planejamento
                                </h4>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 ml-1">Execução (Data Desejada)</label>
                                        <input 
                                            type="datetime-local" 
                                            disabled={!canEditPlanning()}
                                            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-medium text-black outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                                            value={formData.planejamentoData}
                                            onChange={(e) => setFormData({...formData, planejamentoData: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 ml-1">Visita Técnica</label>
                                        <input 
                                            type="datetime-local" 
                                            disabled={!canEditPlanning()}
                                            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-medium text-black outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                                            value={formData.planejamentoVisita}
                                            onChange={(e) => setFormData({...formData, planejamentoVisita: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 ml-1">Tipo de Pagamento</label>
                                    <select 
                                        disabled={!canEditPlanning()}
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-medium text-black outline-none disabled:bg-gray-100"
                                        value={formData.planejamentoPagamento}
                                        onChange={(e) => setFormData({...formData, planejamentoPagamento: e.target.value})}
                                    >
                                        <option value="">Selecione...</option>
                                        <option value="hora">Por Hora</option>
                                        <option value="empreitada">Por Empreitada</option>
                                    </select>
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
                                    
                                    {/* Only show create budget if permission allowed */}
                                    {canEditBudget() && (
                                        <button 
                                            onClick={handleCreateBudget}
                                            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
                                        >
                                            Gerar Orçamento
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className={`bg-blue-50 p-4 rounded-2xl border border-blue-100 space-y-4 animate-in fade-in slide-in-from-bottom-4 relative ${!canEditBudget() ? 'opacity-90' : ''}`}>
                                    {!canEditBudget() && (
                                        <div className="absolute top-2 right-2 text-blue-400" title="Somente leitura">
                                            <Lock size={14} />
                                        </div>
                                    )}
                                    <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center justify-between">
                                        <span className="flex items-center"><DollarSign size={12} className="mr-1"/> Composição do Preço</span>
                                        {canEditBudget() && <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">Editando</span>}
                                    </h4>
                                    
                                    {/* Cost Breakdown Inputs */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-blue-500 ml-1">Custo Fixo (R$)</label>
                                            <input 
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                disabled={!canEditBudget()}
                                                className="w-full bg-white border border-blue-200 rounded-xl p-2 text-xs text-black disabled:bg-gray-100 outline-none focus:ring-2 focus:ring-blue-300"
                                                value={formData.orcamentoCusto}
                                                onChange={(e) => setFormData({...formData, orcamentoCusto: parseFloat(e.target.value)})}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-blue-500 ml-1">Custo Variável (R$)</label>
                                            <input 
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                disabled={!canEditBudget()}
                                                className="w-full bg-white border border-blue-200 rounded-xl p-2 text-xs text-black disabled:bg-gray-100 outline-none focus:ring-2 focus:ring-blue-300"
                                                value={formData.orcamentoCustoVariavel}
                                                onChange={(e) => setFormData({...formData, orcamentoCustoVariavel: parseFloat(e.target.value)})}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-blue-500 ml-1">Mão de Obra (R$)</label>
                                            <input 
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                disabled={!canEditBudget()}
                                                className="w-full bg-white border border-blue-200 rounded-xl p-2 text-xs text-black disabled:bg-gray-100 outline-none focus:ring-2 focus:ring-blue-300"
                                                value={formData.orcamentoHH}
                                                onChange={(e) => setFormData({...formData, orcamentoHH: parseFloat(e.target.value)})}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-blue-500 ml-1">Imposto (R$)</label>
                                            <input 
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                disabled={!canEditBudget()}
                                                className="w-full bg-white border border-blue-200 rounded-xl p-2 text-xs text-black disabled:bg-gray-100 outline-none focus:ring-2 focus:ring-blue-300"
                                                value={formData.orcamentoImposto}
                                                onChange={(e) => setFormData({...formData, orcamentoImposto: parseFloat(e.target.value)})}
                                            />
                                        </div>
                                        <div className="space-y-1 col-span-2">
                                            <label className="text-[10px] font-bold text-green-600 ml-1">Margem de Lucro (R$)</label>
                                            <input 
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                disabled={!canEditBudget()}
                                                className="w-full bg-green-50 border border-green-200 rounded-xl p-2 text-xs text-green-800 font-bold disabled:bg-gray-100 disabled:text-gray-500 outline-none focus:ring-2 focus:ring-green-300"
                                                value={formData.orcamentoLucro}
                                                onChange={(e) => setFormData({...formData, orcamentoLucro: parseFloat(e.target.value)})}
                                            />
                                        </div>
                                        <div className="col-span-2 flex items-center justify-between bg-white border border-gray-200 rounded-xl p-3 mt-1">
                                            <span className="text-xs font-bold text-gray-900">Emitir Nota Fiscal?</span>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, orcamentoNotaFiscal: !formData.orcamentoNotaFiscal })}
                                                disabled={!canEditBudget()}
                                                className={`w-10 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${formData.orcamentoNotaFiscal ? 'bg-green-500' : 'bg-gray-300'} disabled:opacity-50`}
                                            >
                                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${formData.orcamentoNotaFiscal ? 'translate-x-4' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Payment Details */}
                                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-blue-100">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-blue-500 ml-1">Tipo de Pagamento</label>
                                            <select 
                                                disabled={!canEditBudget()}
                                                className="w-full bg-white border border-blue-200 rounded-xl p-2 text-xs text-black disabled:bg-gray-100 outline-none focus:ring-2 focus:ring-blue-300"
                                                value={formData.orcamentoTipoPgto}
                                                onChange={(e) => {
                                                    const type = e.target.value;
                                                    setFormData({
                                                        ...formData, 
                                                        orcamentoTipoPgto: type,
                                                        orcamentoParcelas: type === 'PIX' ? 1 : formData.orcamentoParcelas
                                                    });
                                                }}
                                            >
                                                <option value="Dinheiro">Dinheiro</option>
                                                <option value="PIX">PIX</option>
                                                <option value="Cartão de Crédito">Cartão de Crédito</option>
                                                <option value="Cartão de Débito">Cartão de Débito</option>
                                                <option value="Boleto">Boleto</option>
                                                <option value="Transferência">Transferência</option>
                                            </select>
                                        </div>
                                        {formData.orcamentoTipoPgto !== 'PIX' && (
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-blue-500 ml-1">Parcelas</label>
                                                <input 
                                                    type="number"
                                                    min="1"
                                                    max="12"
                                                    disabled={!canEditBudget()}
                                                    className="w-full bg-white border border-blue-200 rounded-xl p-2 text-xs text-black disabled:bg-gray-100 outline-none focus:ring-2 focus:ring-blue-300"
                                                    value={formData.orcamentoParcelas}
                                                    onChange={(e) => setFormData({...formData, orcamentoParcelas: parseInt(e.target.value)})}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-blue-600 text-white p-4 rounded-xl text-center shadow-lg transform transition-transform hover:scale-[1.02]">
                                        <span className="text-[10px] opacity-80 uppercase font-bold block mb-1">Preço Final do Orçamento</span>
                                        <span className="text-2xl font-black">R$ {formData.orcamentoPreco.toFixed(2)}</span>
                                        {formData.orcamentoParcelas > 1 && (
                                            <span className="text-[10px] font-medium block mt-1 opacity-90">
                                                {formData.orcamentoParcelas}x de R$ {(formData.orcamentoPreco / formData.orcamentoParcelas).toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Footer Actions */}
                        <div className="p-6 border-t border-gray-100 bg-gray-50 mt-auto space-y-3">
                             {formData.status === 'pendente' && (currentUserRole === 'planejista' || currentUserRole === 'gestor') && (
                                <button onClick={handleSendToBudget} disabled={saving} className="w-full bg-purple-600 text-white hover:bg-purple-700 py-3.5 rounded-2xl font-bold shadow-lg shadow-purple-200 active:scale-[0.98] transition-all flex justify-center items-center space-x-2">
                                    {saving ? <Loader2 className="animate-spin" size={18}/> : <><ArrowRightCircle size={18} /><span>Enviar para Orçamento</span></>}
                                </button>
                            )}

                            {showBudgetForm && canEditBudget() && editingItem?.status !== 'aguardando_aprovacao' && editingItem?.status !== 'aprovado' && editingItem?.status !== 'executando' && editingItem?.status !== 'concluido' && (
                                <button onClick={handleSendProposal} disabled={saving} className="w-full bg-blue-600 text-white hover:bg-blue-700 py-3.5 rounded-2xl font-bold shadow-lg shadow-blue-200 active:scale-[0.98] transition-all flex justify-center items-center space-x-2">
                                    <Send size={18} /><span>Enviar Proposta ao Cliente</span>
                                </button>
                            )}
                            
                            {(canEditPlanning() || canEditBudget() || canEditStatus()) && (
                                <button onClick={handleSave} disabled={saving} className="w-full bg-black text-white py-4 rounded-2xl font-bold shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex justify-center items-center disabled:opacity-70 disabled:scale-100 space-x-2">
                                    {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18} /><span>Salvar Alterações</span></>}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chamados;
