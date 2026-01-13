
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Chave, Geral, User, Orcamento, Planejamento } from '../types';
import { 
    Loader2, Search, Filter, Plus, X, Save, Send, FileText, 
    User as UserIcon, Calendar, DollarSign, CheckCircle, 
    AlertTriangle, ChevronRight, Ban, Clock, Briefcase, MapPin,
    Wallet, CreditCard, LayoutGrid, List, Package, Trash2, Hash, Percent, Calculator, Lock, ArrowRightCircle, Bell, Smartphone, Banknote
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
  type: 'agenda' | 'planning' | 'approval';
  read: boolean;
}

const Chamados: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'novos' | 'orcamentos' | 'execucao' | 'historico'>('novos');
    const [tickets, setTickets] = useState<ChamadoExtended[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [currentUserRole, setCurrentUserRole] = useState<string>('');
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const notificationRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ChamadoExtended | null>(null);
    const [saving, setSaving] = useState(false);
    const [showBudgetForm, setShowBudgetForm] = useState(false);
    const [newResource, setNewResource] = useState('');

    const [formData, setFormData] = useState({
        profissionalUuid: '',
        status: '',
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
        { id: 'orcamentos', label: 'Orçamentos / Espera', icon: DollarSign },
        { id: 'execucao', label: 'Em Execução', icon: Clock },
        { id: 'historico', label: 'Histórico', icon: FileText }
    ];

    const visibleTabs = allTabs.filter(tab => {
        const r = currentUserRole.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (r === 'planejista') return tab.id === 'novos' || tab.id === 'historico';
        if (r === 'orcamentista') return tab.id === 'novos' || tab.id === 'orcamentos' || tab.id === 'execucao' || tab.id === 'historico';
        if (r === 'profissional') return tab.id === 'execucao' || tab.id === 'historico';
        return true;
    });

    useEffect(() => {
        fetchUserRole();
        fetchData();
        fetchProfessionals();
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) setShowNotifications(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (currentUserRole === 'planejista' || currentUserRole === 'orcamentista') setActiveTab('novos');
        else if (currentUserRole === 'profissional') setActiveTab('execucao');
    }, [currentUserRole]);

    useEffect(() => {
        if (showBudgetForm) {
            const custoFixo = parseFloat(formData.orcamentoCusto.toString()) || 0;
            const custoVariavel = parseFloat(formData.orcamentoCustoVariavel.toString()) || 0;
            const hh = parseFloat(formData.orcamentoHH.toString()) || 0;
            const imposto = parseFloat(formData.orcamentoImposto.toString()) || 0;
            const lucro = parseFloat(formData.orcamentoLucro.toString()) || 0;
            const total = custoFixo + custoVariavel + hh + imposto + lucro;
            if (total !== formData.orcamentoPreco) setFormData(prev => ({ ...prev, orcamentoPreco: total }));
        }
    }, [formData.orcamentoCusto, formData.orcamentoCustoVariavel, formData.orcamentoHH, formData.orcamentoImposto, formData.orcamentoLucro]);

    useEffect(() => {
        if (formData.orcamentoTipoPgto !== 'Cartão de Crédito' && formData.orcamentoParcelas !== 1) {
            setFormData(prev => ({ ...prev, orcamentoParcelas: 1 }));
        }
    }, [formData.orcamentoTipoPgto]);

    const fetchUserRole = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setCurrentUserId(user.id);
            const { data: userData } = await supabase.from('users').select('tipo').eq('uuid', user.id).single();
            if (userData) {
                const normalizedRole = (userData.tipo || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                setCurrentUserRole(normalizedRole);
                fetchNotifications(normalizedRole, user.id);
            }
        }
    };

    const fetchNotifications = async (role: string, uuid: string) => {
      let notifs: NotificationItem[] = [];
      try {
          if (['planejista', 'orcamentista', 'gestor'].includes(role)) {
              const { data } = await supabase
                .from('chaves')
                .select(`id, created_at, chaveunica, status, geral (nome)`)
                .in('status', ['pendente', 'analise'])
                .order('created_at', { ascending: false })
                .limit(10);

              if (data) {
                  notifs = data.map((item: any) => ({ 
                      id: item.id, 
                      title: item.status === 'analise' ? 'Aguardando Orçamento' : 'Novo Chamado Pendente', 
                      description: `Chave: ${item.chaveunica} - ${item.geral?.nome}`, 
                      date: new Date(item.created_at).toLocaleDateString('pt-BR'), 
                      type: 'planning', 
                      read: false 
                  }));
              }
          } 
          setNotifications(notifs);
      } catch (error) { console.error(error); }
    };

    const handleNotificationClick = (notif: NotificationItem) => { setShowNotifications(false); navigate('/chamados'); };

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: chavesData, error: chavesError } = await supabase.from('chaves').select('*').order('created_at', { ascending: false });
            if (chavesError) throw chavesError;
            if (!chavesData) { setTickets([]); return; }
            const chaveIds = chavesData.map(c => c.id);
            const userIds = new Set<string>();
            const serviceIds = new Set<number>();
            chavesData.forEach(c => { if(c.cliente) userIds.add(c.cliente); if(c.profissional) userIds.add(c.profissional); if(c.atividade) serviceIds.add(c.atividade); });
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
            orcRes.data?.forEach((o: any) => { if(!orcMap[o.chave]) orcMap[o.chave] = []; orcMap[o.chave].push(o); });
            const planMap: Record<number, Planejamento[]> = {};
            planRes.data?.forEach((p: any) => { if(!planMap[p.chave]) planMap[p.chave] = []; planMap[p.chave].push(p); });
            setTickets(chavesData.map(c => ({ ...c, clienteData: usersMap[c.cliente], profissionalData: usersMap[c.profissional], geral: servicesMap[c.atividade], orcamentos: orcMap[c.id] || [], planejamento: planMap[c.id] || [] })));
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    const fetchProfessionals = async () => {
        const { data } = await supabase.from('users').select('*').ilike('tipo', 'profissional').eq('ativo', true);
        if(data) setProfessionals(data);
    };

    const getFilteredTickets = () => {
        let filtered = tickets;
        if (currentUserRole === 'profissional') filtered = filtered.filter(t => t.profissional === currentUserId);

        if (activeTab === 'novos') {
            if (currentUserRole === 'planejista') filtered = filtered.filter(t => t.status === 'pendente');
            else if (currentUserRole === 'orcamentista') filtered = filtered.filter(t => t.status === 'analise');
            else filtered = filtered.filter(t => t.status === 'pendente' || t.status === 'analise');
        } else if (activeTab === 'orcamentos') {
            filtered = filtered.filter(t => t.status === 'aguardando_aprovacao' || t.status === 'reprovado' || t.status === 'aguardando_profissional');
        } else if (activeTab === 'execucao') {
            filtered = filtered.filter(t => t.status === 'aprovado' || t.status === 'executando');
        } else if (activeTab === 'historico') {
            filtered = filtered.filter(t => t.status === 'concluido' || t.status === 'cancelado');
        }

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(t => t.chaveunica?.toLowerCase().includes(lower) || t.geral?.nome.toLowerCase().includes(lower) || t.clienteData?.nome.toLowerCase().includes(lower));
        }
        return filtered;
    };

    const canEditPlanning = () => {
        const r = currentUserRole.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (r === 'gestor') return true;
        // Orçamentista e Profissional não editam planejamento
        if (r === 'planejista') return !['concluido', 'cancelado'].includes(formData.status);
        return false;
    };

    const canEditBudget = () => {
        const r = currentUserRole.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (r === 'gestor') return true;
        if (r === 'orcamentista') return !['executando', 'concluido', 'cancelado'].includes(formData.status);
        return false; 
    };

    const canEditStatus = () => {
        const r = currentUserRole.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (r === 'gestor') return true;
        if (r === 'profissional') return !['concluido', 'cancelado'].includes(editingItem?.status || '');
        // Orçamentista e Planejista não editam status manualmente através de seletor livre
        return false;
    };

    const handleEdit = (ticket: ChamadoExtended) => {
        setEditingItem(ticket);
        setNewResource('');
        const hasBudget = ticket.orcamentos && ticket.orcamentos.length > 0;
        const budget = hasBudget ? ticket.orcamentos[0] : null;
        const plan = ticket.planejamento && ticket.planejamento.length > 0 ? ticket.planejamento[0] : null;
        
        const r = currentUserRole.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        // Orçamento oculto para Planejistas E Profissionais
        setShowBudgetForm(r !== 'planejista' && r !== 'profissional' && (hasBudget || currentUserRole === 'orcamentista' || currentUserRole === 'gestor'));
        
        let formattedDate = '', formattedVisita = '';
        if (plan?.execucao) formattedDate = toLocalISOString(plan.execucao);
        if (plan?.visita) formattedVisita = toLocalISOString(plan.visita);

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
            planejamentoPagamento: plan?.pagamento || 'Dinheiro',
            planejamentoVisita: formattedVisita
        });
        setIsModalOpen(true);
    };

    const toLocalISOString = (s: string) => { 
        if (!s) return ''; 
        const d = new Date(s); 
        return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0, 16); 
    };

    const handleSave = async () => {
        if (!editingItem) return;
        setSaving(true);
        try {
            if (canEditStatus()) {
                await supabase.from('chaves').update({ profissional: formData.profissionalUuid || null, status: formData.status }).eq('id', editingItem.id);
            }
            if (showBudgetForm && canEditBudget()) {
                const b = { chave: editingItem.id, preco: formData.orcamentoPreco, custofixo: formData.orcamentoCusto, custovariavel: formData.orcamentoCustoVariavel, hh: formData.orcamentoHH, imposto: formData.orcamentoImposto, lucro: formData.orcamentoLucro, tipopagmto: formData.orcamentoTipoPgto, parcelas: formData.orcamentoParcelas, observacaocliente: formData.orcamentoObs, notafiscal: formData.orcamentoNotaFiscal, ativo: true };
                if (editingItem.orcamentos?.length) await supabase.from('orcamentos').update(b).eq('id', editingItem.orcamentos[0].id);
                else await supabase.from('orcamentos').insert(b);
            }
            
            if (canEditPlanning()) {
                const p: any = { 
                    chave: editingItem.id,
                    descricao: formData.planejamentoDesc, 
                    recursos: formData.planejamentoRecursos, 
                    pagamento: formData.planejamentoPagamento,
                    ativo: true
                };
                if (formData.planejamentoData) p.execucao = new Date(formData.planejamentoData).toISOString();
                if (formData.planejamentoVisita) p.visita = new Date(formData.planejamentoVisita).toISOString(); else p.visita = null;
                
                if (editingItem.planejamento?.length) {
                    await supabase.from('planejamento').update(p).eq('id', editingItem.planejamento[0].id);
                } else {
                    await supabase.from('planejamento').insert(p);
                }
            }
            await fetchData(); setIsModalOpen(false); alert('Salvo!');
        } catch (error: any) { alert(error.message); } finally { setSaving(false); }
    };

    const handleSendToBudget = async () => {
        if (!editingItem) return;
        if (!formData.profissionalUuid) return alert("Selecione um profissional antes de enviar.");
        if (!formData.planejamentoData) return alert("Defina a data de execução prevista.");

        setSaving(true);
        try {
            const { error: chaveError } = await supabase
                .from('chaves')
                .update({ 
                    profissional: formData.profissionalUuid, 
                    status: 'analise',
                    planejista: currentUserId
                })
                .eq('id', editingItem.id);
            
            if (chaveError) throw chaveError;

            const p: any = { 
                chave: editingItem.id,
                descricao: formData.planejamentoDesc, 
                recursos: formData.planejamentoRecursos, 
                pagamento: formData.planejamentoPagamento,
                execucao: new Date(formData.planejamentoData).toISOString(),
                visita: formData.planejamentoVisita ? new Date(formData.planejamentoVisita).toISOString() : null,
                ativo: true
            };

            if (editingItem.planejamento?.length) {
                await supabase.from('planejamento').update(p).eq('id', editingItem.planejamento[0].id);
            } else {
                await supabase.from('planejamento').insert(p);
            }

            alert("Chamado enviado para o orçamentista com sucesso!");
            await fetchData();
            setIsModalOpen(false);
        } catch (error: any) { alert(error.message); } finally { setSaving(false); }
    };

    const handleSendToConsumer = async () => {
        if (!editingItem) return;
        if (formData.orcamentoPreco <= 0) return alert("O valor do orçamento deve ser maior que zero.");

        setSaving(true);
        try {
            const { error: chaveError } = await supabase
                .from('chaves')
                .update({ 
                    status: 'aguardando_aprovacao',
                    orcamentista: currentUserId
                })
                .eq('id', editingItem.id);
            
            if (chaveError) throw chaveError;

            const b = { 
                chave: editingItem.id, 
                preco: formData.orcamentoPreco, 
                custofixo: formData.orcamentoCusto, 
                custovariavel: formData.orcamentoCustoVariavel, 
                hh: formData.orcamentoHH, 
                imposto: formData.orcamentoImposto, 
                lucro: formData.orcamentoLucro, 
                tipopagmto: formData.orcamentoTipoPgto, 
                parcelas: formData.orcamentoParcelas, 
                observacaocliente: formData.orcamentoObs, 
                notafiscal: formData.orcamentoNotaFiscal, 
                ativo: true 
            };

            if (editingItem.orcamentos?.length) {
                await supabase.from('orcamentos').update(b).eq('id', editingItem.orcamentos[0].id);
            } else {
                await supabase.from('orcamentos').insert(b);
            }

            alert("Orçamento enviado para o consumidor!");
            await fetchData();
            setIsModalOpen(false);
        } catch (error: any) {
            alert("Erro ao enviar orçamento: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const getStatusColor = (s: string) => {
        switch (s?.toLowerCase()) {
            case 'pendente': return 'bg-yellow-100 text-yellow-900 border-yellow-200';
            case 'analise': return 'bg-blue-100 text-blue-900 border-blue-200';
            case 'aguardando_aprovacao': return 'bg-orange-100 text-orange-900 border-orange-200';
            case 'aguardando_profissional': return 'bg-cyan-100 text-cyan-900 border-cyan-200';
            case 'aprovado': return 'bg-green-100 text-green-900 border-green-200';
            case 'executando': return 'bg-purple-100 text-purple-900 border-purple-200';
            case 'concluido': return 'bg-green-200 text-green-900 border-green-300';
            case 'cancelado': return 'bg-red-100 text-red-900 border-red-200';
            default: return 'bg-gray-100 text-gray-900 border-gray-200';
        }
    };

    const normRole = currentUserRole.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const isPlanejista = normRole === 'planejista';
    const isOrcamentista = normRole === 'orcamentista';
    const isProfissional = normRole === 'profissional';

    return (
        <div className="min-h-screen bg-ios-bg pb-20">
            <div className="bg-white/80 backdrop-blur-md px-5 pt-12 pb-4 sticky top-0 z-20 border-b border-gray-200">
                <div className="flex justify-between items-start">
                    <div><h1 className="text-3xl font-bold text-gray-900 tracking-tight">Chamados</h1><p className="text-gray-500 text-sm mt-1">Gestão inteligente.</p></div>
                    <div className="flex items-center space-x-2">
                        <div className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold uppercase text-gray-700 border border-gray-200">{currentUserRole || '...'}</div>
                        <div className="relative" ref={notificationRef}>
                            <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 rounded-full bg-gray-100 hover:bg-gray-200"><Bell size={20} className="text-gray-700" />{notifications.length > 0 && <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full ring-1 ring-white"></span>}</button>
                            {showNotifications && (
                                <div className="absolute right-0 top-12 w-80 bg-white/95 backdrop-blur-xl border border-gray-200 shadow-2xl rounded-[1.5rem] overflow-hidden z-50">
                                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50"><h3 className="font-bold text-gray-900 text-sm">Notificações</h3><button onClick={() => setShowNotifications(false)}><X size={16} className="text-gray-400"/></button></div>
                                    <div className="max-h-64 overflow-y-auto">
                                        {notifications.length > 0 ? notifications.map((n) => (<div key={n.id} onClick={() => handleNotificationClick(n)} className="p-4 border-b border-gray-50 hover:bg-blue-50 cursor-pointer"><div><span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded font-bold uppercase">{n.type}</span></div><h4 className="text-sm font-bold text-gray-900">{n.title}</h4><p className="text-xs text-gray-500 truncate">{n.description}</p></div>)) : <div className="p-6 text-center text-xs text-gray-400">Vazio.</div>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-5 max-w-7xl mx-auto space-y-6">
                <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-1">
                    {visibleTabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center px-4 py-2.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-black text-white border-black shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}><tab.icon size={14} className="mr-2" />{tab.label}</button>
                    ))}
                </div>

                <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Buscar por ID, Cliente ou Serviço..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl py-3 pl-10 pr-4 text-sm outline-none" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {loading ? (<div className="col-span-full flex justify-center py-10"><Loader2 className="animate-spin text-ios-blue"/></div>) : getFilteredTickets().length > 0 ? getFilteredTickets().map(t => (
                        <div key={t.id} onClick={() => handleEdit(t)} className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer relative overflow-hidden group">
                            <div className={`absolute top-0 right-0 px-3 py-1.5 rounded-bl-2xl text-[10px] font-bold uppercase border-b border-l ${getStatusColor(t.status)}`}>{t.status.replace('_',' ')}</div>
                            <div className="flex items-center space-x-3 mb-4"><div className="w-12 h-12 bg-gray-50 rounded-2xl flex-shrink-0 overflow-hidden">{t.geral?.imagem ? <img src={t.geral.imagem} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-gray-300"><FileText size={20}/></div>}</div><div><h3 className="font-bold text-gray-900 leading-tight group-hover:text-ios-blue transition-colors">{t.geral?.nome}</h3><div className="inline-flex items-center mt-1 bg-gray-100 px-2 py-0.5 rounded border border-gray-200"><Hash size={10} className="text-gray-400 mr-1" /><span className="text-[10px] font-black text-gray-700 font-mono tracking-wider">{t.chaveunica}</span></div></div></div>
                            <div className="bg-gray-50 p-3 rounded-xl flex items-center space-x-2 mb-3"><div className="w-8 h-8 rounded-full bg-white overflow-hidden border border-gray-100"><img src={t.clienteData?.fotoperfil || `https://ui-avatars.com/api/?name=${t.clienteData?.nome || 'U'}`} className="w-full h-full object-cover"/></div><div className="overflow-hidden"><p className="text-[10px] font-bold text-gray-400 uppercase">Cliente</p><p className="text-xs font-bold text-gray-900 truncate">{t.clienteData?.nome}</p></div></div>
                            <div className="flex justify-between items-center text-xs text-gray-500">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center text-gray-400 text-[10px]"><Calendar size={10} className="mr-1"/> Criado em {new Date(t.created_at).toLocaleDateString('pt-BR')}</div>
                                    {t.planejamento?.[0]?.execucao && (
                                        <div className="flex items-center font-bold text-ios-blue"><Clock size={12} className="mr-1"/> Execução: {new Date(t.planejamento[0].execucao).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}</div>
                                    )}
                                </div>
                                {!isProfissional && t.orcamentos?.length ? (
                                    <div className="flex flex-col items-end">
                                        <div className="flex items-center font-bold text-green-700 text-sm"><DollarSign size={14} className="mr-0.5"/>R$ {t.orcamentos[0].preco.toFixed(2)}</div>
                                        {t.orcamentos[0].tipopagmto === 'Cartão de Crédito' && t.orcamentos[0].parcelas > 1 && (
                                            <div className="text-[9px] font-bold text-gray-400 uppercase">{t.orcamentos[0].parcelas}x Parcelas</div>
                                        )}
                                    </div>
                                ) : !isProfissional && <div className="text-orange-600 font-bold flex items-center text-[10px] uppercase"><AlertTriangle size={12} className="mr-1"/> Sem Orçamento</div>}
                            </div>
                        </div>
                    )) : (<div className="col-span-full text-center py-12 text-gray-400">Nenhum chamado encontrado.</div>)}
                </div>
            </div>

            {isModalOpen && editingItem && (
                 <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                            <div><h3 className="font-bold text-gray-900 text-lg">{editingItem.geral?.nome}</h3><div className="flex items-center mt-1"><span className="bg-gray-100 text-gray-900 px-2 py-1 rounded-md text-xs font-black font-mono tracking-wider flex items-center border border-gray-200"><Hash size={10} className="mr-1 opacity-50"/> {editingItem.chaveunica}</span></div></div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 transition-colors"><X size={20} /></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-6 flex-1 no-scrollbar">
                            
                            {isPlanejista ? (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Selecionar Profissional</label>
                                        <select 
                                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-black/10" 
                                            value={formData.profissionalUuid} 
                                            onChange={(e) => setFormData({...formData, profissionalUuid: e.target.value})}
                                        >
                                            <option value="">Selecione o melhor profissional...</option>
                                            {professionals.map(p => (<option key={p.uuid} value={p.uuid}>{p.nome}</option>))}
                                        </select>
                                    </div>

                                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
                                        <div className="flex items-center gap-2 mb-2 text-gray-600"><FileText size={18} /><h4 className="text-[10px] font-black uppercase tracking-widest">Detalhes do Planejamento</h4></div>
                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 ml-1">Execução Prevista</label><input type="datetime-local" className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-bold text-gray-900 outline-none" value={formData.planejamentoData} onChange={(e) => setFormData({...formData, planejamentoData: e.target.value})} /></div>
                                            <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 ml-1">Visita Técnica (Opcional)</label><input type="datetime-local" className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-bold text-gray-900 outline-none" value={formData.planejamentoVisita} onChange={(e) => setFormData({...formData, planejamentoVisita: e.target.value})} /></div>
                                        </div>
                                    </div>
                                    <div className="bg-yellow-50 p-5 rounded-3xl border border-yellow-100"><label className="text-[10px] font-black text-yellow-700 uppercase tracking-wider mb-2 block">Informações Técnicas</label><textarea className="w-full bg-white/50 border border-yellow-200 rounded-2xl p-4 text-sm font-medium text-gray-800 min-h-[100px] outline-none" placeholder="Detalhes técnicos para o orçamentista..." value={formData.planejamentoDesc} onChange={(e) => setFormData({...formData, planejamentoDesc: e.target.value})} /></div>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Status do Pedido</label>
                                            {isOrcamentista ? (
                                                <div className={`w-full px-4 py-3 rounded-2xl text-xs font-black uppercase border text-center ${getStatusColor(formData.status)}`}>{formData.status.replace('_',' ')}</div>
                                            ) : (
                                                <select className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-3 text-xs font-bold text-gray-900 outline-none capitalize focus:ring-2 focus:ring-black/10" value={formData.status} disabled={!canEditStatus()} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                                                    <option value="pendente">Pendente</option>
                                                    <option value="analise">Em Análise</option>
                                                    <option value="aguardando_aprovacao">Aguardando Aprovação</option>
                                                    <option value="aguardando_profissional">Aguardando Profissional</option>
                                                    <option value="aprovado">Aprovado</option>
                                                    <option value="executando">Executando</option>
                                                    <option value="concluido">Concluído</option>
                                                    <option value="cancelado">Cancelado</option>
                                                    <option value="reprovado">Reprovado</option>
                                                </select>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Profissional</label>
                                            <select 
                                                className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-3 text-xs font-bold text-gray-900 outline-none disabled:opacity-80" 
                                                value={formData.profissionalUuid} 
                                                disabled={!canEditPlanning()} 
                                                onChange={(e) => setFormData({...formData, profissionalUuid: e.target.value})}
                                            >
                                                <option value="">Selecione...</option>
                                                {professionals.map(p => (<option key={p.uuid} value={p.uuid}>{p.nome}</option>))}
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3 relative">
                                        <div className="flex justify-between items-center"><h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center"><FileText size={12} className="mr-1"/> Detalhes do Planejamento</h4>{(!canEditPlanning() || isOrcamentista || isProfissional) && <Lock size={10} className="text-gray-300"/>}</div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2"><label className="text-[10px] font-bold text-gray-400 ml-1">Execução</label><input type="datetime-local" disabled={true} className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-bold text-gray-900 outline-none opacity-80" value={formData.planejamentoData} /></div>
                                            <div className="space-y-2"><label className="text-[10px] font-bold text-gray-400 ml-1">Visita Técnica</label><input type="datetime-local" disabled={true} className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-bold text-gray-900 outline-none opacity-80" value={formData.planejamentoVisita} /></div>
                                        </div>
                                    </div>

                                    {showBudgetForm && !isProfissional && (
                                        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 space-y-4 animate-in slide-in-from-right-4">
                                            <div className="flex justify-between items-center"><h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center"><DollarSign size={12} className="mr-1"/> Orçamento Financeiro</h4><div className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase shadow-sm">Total: R$ {formData.orcamentoPreco.toFixed(2)}</div></div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1"><label className="text-[9px] font-bold text-blue-700 uppercase ml-1">Custo Fixo (Peças)</label><input type="number" step="0.01" disabled={!canEditBudget()} className="w-full bg-white border border-blue-100 rounded-xl p-3 text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20" value={formData.orcamentoCusto} onChange={(e) => setFormData({...formData, orcamentoCusto: parseFloat(e.target.value) || 0})}/></div>
                                                <div className="space-y-1"><label className="text-[9px] font-bold text-blue-700 uppercase ml-1">Mão de Obra (HH)</label><input type="number" step="0.01" disabled={!canEditBudget()} className="w-full bg-white border border-blue-100 rounded-xl p-3 text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20" value={formData.orcamentoHH} onChange={(e) => setFormData({...formData, orcamentoHH: parseFloat(e.target.value) || 0})}/></div>
                                                <div className="space-y-1"><label className="text-[9px] font-bold text-blue-700 uppercase ml-1">Lucro Estimado</label><input type="number" step="0.01" disabled={!canEditBudget()} className="w-full bg-white border border-blue-100 rounded-xl p-3 text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20" value={formData.orcamentoLucro} onChange={(e) => setFormData({...formData, orcamentoLucro: parseFloat(e.target.value) || 0})}/></div>
                                                <div className="space-y-1"><label className="text-[9px] font-bold text-blue-700 uppercase ml-1">Impostos (%)</label><input type="number" step="0.01" disabled={!canEditBudget()} className="w-full bg-white border border-blue-100 rounded-xl p-3 text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20" value={formData.orcamentoImposto} onChange={(e) => setFormData({...formData, orcamentoImposto: parseFloat(e.target.value) || 0})}/></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1"><label className="text-[9px] font-bold text-blue-700 uppercase ml-1">Tipo de Pagamento</label><select disabled={!canEditBudget()} className="w-full bg-white border border-blue-100 rounded-xl p-3 text-xs font-bold text-gray-900 outline-none" value={formData.orcamentoTipoPgto} onChange={(e) => setFormData({...formData, orcamentoTipoPgto: e.target.value})}><option value="Dinheiro">Dinheiro</option><option value="PIX">PIX</option><option value="Cartão de Crédito">Cartão de Crédito</option><option value="Cartão de Débito">Cartão de Débito</option></select></div>
                                                {formData.orcamentoTipoPgto === 'Cartão de Crédito' && (
                                                    <div className="space-y-1 animate-in zoom-in duration-200"><label className="text-[9px] font-bold text-blue-700 uppercase ml-1">Parcelas</label><input type="number" min="1" max="12" disabled={!canEditBudget()} className="w-full bg-white border border-blue-100 rounded-xl p-3 text-xs font-bold text-gray-900 outline-none" value={formData.orcamentoParcelas} onChange={(e) => setFormData({...formData, orcamentoParcelas: parseInt(e.target.value) || 1})}/></div>
                                                )}
                                            </div>
                                            <div className="space-y-1"><label className="text-[9px] font-bold text-blue-700 uppercase ml-1">Observação para o Cliente</label><textarea disabled={!canEditBudget()} className="w-full bg-white border border-blue-100 rounded-xl p-3 text-xs font-bold text-gray-900 outline-none resize-none min-h-[60px]" value={formData.orcamentoObs} onChange={(e) => setFormData({...formData, orcamentoObs: e.target.value})} placeholder="Instruções sobre o valor..."/></div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        
                        <div className="p-6 border-t border-gray-100 bg-gray-50 mt-auto space-y-3">
                            {isPlanejista ? (
                                <button onClick={handleSendToBudget} disabled={saving} className="w-full bg-black text-white py-4 rounded-2xl font-bold shadow-xl active:scale-[0.98] transition-all flex justify-center items-center gap-2">{saving ? <Loader2 className="animate-spin" size={20} /> : <><Send size={18} /><span>Enviar para Orçamento</span></>}</button>
                            ) : isOrcamentista ? (
                                <button onClick={handleSendToConsumer} disabled={saving} className="w-full bg-black text-white py-4 rounded-2xl font-bold shadow-xl active:scale-[0.98] transition-all flex justify-center items-center gap-2">{saving ? <Loader2 className="animate-spin" size={20} /> : <><Send size={18} /><span>Enviar Orçamento</span></>}</button>
                            ) : (
                                <button onClick={handleSave} disabled={saving} className="w-full bg-black text-white py-4 rounded-2xl font-bold shadow-xl active:scale-[0.98] transition-all flex justify-center items-center gap-2">{saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18} /><span>Salvar Alterações</span></>}</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chamados;
