import React, { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Chave, Geral, User, Orcamento, Planejamento, Avaliacao, Agenda } from '../types';
import { 
    Loader2, Search, Filter, Plus, X, Save, Send, FileText, 
    User as UserIcon, Calendar, DollarSign, CheckCircle, 
    AlertTriangle, ChevronRight, Ban, Clock, Briefcase, MapPin,
    Wallet, CreditCard, LayoutGrid, List, Package, Trash2, Hash, Percent, Calculator, Lock, ArrowRightCircle, Bell, Smartphone, Banknote, Camera, ThumbsUp, Star, UserCheck, ShieldCheck,
    AlertCircle, Play, Image as ImageIcon, Phone, AlignLeft, Edit3, UserCircle, ClipboardList, ThumbsDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ChamadoExtended extends Chave {
    geral?: Geral;
    clienteData?: User;
    profissionalData?: User;
    orcamentos?: Orcamento[];
    planejamento?: Planejamento[];
    avaliacao?: Avaliacao;
    agenda?: Agenda[];
}

interface NotificationItem {
  id: number;
  title: string;
  description: string;
  date: string;
  type: 'agenda' | 'planning' | 'approval';
  read: boolean;
}

type ModalTab = 'status' | 'consumidor' | 'profissional';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const Chamados: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'novos' | 'orcamentos' | 'execucao' | 'historico'>('novos');
    const [modalSubTab, setModalSubTab] = useState<ModalTab>('status');
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
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [processingAction, setProcessingAction] = useState(false);
    const [showBudgetForm, setShowBudgetForm] = useState(false);

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
        planejamentoVisita: '',
        fotoantes: [] as string[],
        fotodepois: [] as string[],
        agendaObs: '' 
    });

    const [professionals, setProfessionals] = useState<User[]>([]);

    const allTabs = [
        { id: 'novos', label: 'Novos / Pendentes', icon: AlertTriangle },
        { id: 'orcamentos', label: 'Orçamentos / Espera', icon: DollarSign },
        { id: 'execucao', label: 'Em Execução', icon: Clock },
        { id: 'historico', label: 'Histórico', icon: FileText }
    ];

    const isProfessional = currentUserRole === 'profissional';
    const isGestor = currentUserRole === 'gestor';
    const isPlanejista = currentUserRole === 'planejista';
    const isOrcamentista = currentUserRole === 'orcamentista';
    const isInternal = isGestor || isPlanejista || isOrcamentista;

    const isMediaVideo = (url: string) => {
        if (!url) return false;
        const cleanPath = url.split('?')[0].toLowerCase();
        const videoExtensions = ['.mp4', '.mov', '.webm', '.quicktime', '.m4v', '.3gp', '.mkv'];
        return videoExtensions.some(ext => cleanPath.endsWith(ext)) || url.toLowerCase().includes('video');
    };

    const extractMetadata = (desc: string | undefined | null, marker: string) => {
        if (!desc) return null;
        if (desc.includes(marker)) {
            const parts = desc.split(marker);
            if (parts.length > 1) {
                return parts[1].split('\n\n[').shift()?.trim();
            }
        }
        return null;
    };

    const extractFlexibility = (desc: string | undefined | null) => extractMetadata(desc, "[FLEXIBILIDADE DE AGENDA]:");
    const extractOriginalDesc = (desc: string | undefined | null) => {
        if (!desc) return "";
        const firstMarkerIndex = desc.indexOf('\n\n[');
        if (firstMarkerIndex !== -1) {
            return desc.substring(0, firstMarkerIndex).trim();
        }
        return desc.trim();
    };

    const visibleTabs = allTabs.filter(tab => {
        if (isPlanejista) return tab.id === 'novos' || tab.id === 'historico';
        if (isOrcamentista) return tab.id === 'novos' || tab.id === 'orcamentos' || tab.id === 'execucao' || tab.id === 'historico';
        if (isProfessional) return tab.id === 'novos' || tab.id === 'execucao' || tab.id === 'historico';
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
        if (isPlanejista || isOrcamentista) setActiveTab('novos');
        else if (isProfessional) setActiveTab('novos'); 
    }, [currentUserRole]);

    useEffect(() => {
        if (showBudgetForm) {
            const custoFixo = parseFloat(formData.orcamentoCusto.toString()) || 0;
            const hh = parseFloat(formData.orcamentoHH.toString()) || 0;
            const lucro = parseFloat(formData.orcamentoLucro.toString()) || 0;
            const impostoPercent = parseFloat(formData.orcamentoImposto.toString()) || 0;
            
            const subtotal = custoFixo + hh + lucro;
            const impostoValor = subtotal * (impostoPercent / 100);
            const total = subtotal + impostoValor;
            
            if (Math.abs(total - formData.orcamentoPreco) > 0.01) {
                setFormData(prev => ({ ...prev, orcamentoPreco: total }));
            }
        }
    }, [formData.orcamentoCusto, formData.orcamentoHH, formData.orcamentoImposto, formData.orcamentoLucro]);

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
            const [usersRes, servicesRes, orcRes, planRes, avalRes, agendaRes] = await Promise.all([
                userIds.size > 0 ? supabase.from('users').select('*').in('uuid', Array.from(userIds)) : { data: [] },
                serviceIds.size > 0 ? supabase.from('geral').select('*').in('id', Array.from(serviceIds)) : { data: [] },
                chaveIds.length > 0 ? supabase.from('orcamentos').select('*').in('chave', chaveIds) : { data: [] },
                chaveIds.length > 0 ? supabase.from('planejamento').select('*').in('chave', chaveIds) : { data: [] },
                chaveIds.length > 0 ? supabase.from('avaliacoes').select('*').in('chave', chaveIds) : { data: [] },
                chaveIds.length > 0 ? supabase.from('agenda').select('*').in('chave', chaveIds) : { data: [] }
            ]);
            const usersMap: Record<string, User> = {};
            usersRes.data?.forEach((u: any) => usersMap[u.uuid] = u);
            const servicesMap: Record<number, Geral> = {};
            servicesRes.data?.forEach((s: any) => servicesMap[s.id] = s);
            const orcMap: Record<number, Orcamento[]> = {};
            orcRes.data?.forEach((o: any) => { if(!orcMap[o.chave]) orcMap[o.chave] = []; orcMap[o.chave].push(o); });
            const planMap: Record<number, Planejamento[]> = {};
            planRes.data?.forEach((p: any) => { if(!planMap[p.chave]) planMap[p.chave] = []; planMap[p.chave].push(p); });
            const avalMap: Record<number, Avaliacao> = {};
            avalRes.data?.forEach((a: any) => avalMap[a.chave] = a);
            const agendaMap: Record<number, Agenda[]> = {};
            agendaRes.data?.forEach((ag: any) => { if(!agendaMap[ag.chave]) agendaMap[ag.chave] = []; agendaMap[ag.chave].push(ag); });

            setTickets(chavesData.map(c => ({ 
                ...c, 
                clienteData: usersMap[c.cliente], 
                profissionalData: usersMap[c.profissional], 
                geral: servicesMap[c.atividade], 
                orcamentos: orcMap[c.id] || [], 
                planejamento: planMap[c.id] || [],
                avaliacao: avalMap[c.id],
                agenda: agendaMap[c.id] || []
            })));
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    const fetchProfessionals = async () => {
        const { data } = await supabase
            .from('users')
            .select('uuid, nome, fotoperfil, whatsapp, cidade, atividade, cidades(cidade)')
            .ilike('tipo', 'profissional')
            .eq('ativo', true);
        if(data) setProfessionals(data as User[]);
    };

    const getFilteredTickets = () => {
        let filtered = tickets;
        
        if (isProfessional) {
            filtered = filtered.filter(t => 
                t.profissional === currentUserId && 
                !['pendente', 'analise', 'aguardando_aprovacao'].includes(t.status.toLowerCase())
            );
        }

        if (activeTab === 'novos') {
            if (isPlanejista) filtered = filtered.filter(t => t.status === 'pendente');
            else if (isOrcamentista) filtered = filtered.filter(t => t.status === 'analise');
            else if (isProfessional) filtered = filtered.filter(t => t.status === 'aguardando_profissional');
            else filtered = filtered.filter(t => t.status === 'pendente' || t.status === 'analise' || t.status === 'aguardando_profissional');
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

    const handleEdit = (ticket: ChamadoExtended) => {
        setEditingItem(ticket);
        setModalSubTab('status');
        setUploadError(null);
        const budget = ticket.orcamentos?.[0];
        const plan = ticket.planejamento?.[0];
        const status = (ticket.status || 'pendente').toLowerCase();
        const agenda = ticket.agenda?.[0];
        
        const shouldShowBudget = !isPlanejista && !isProfessional && 
                               (!!(ticket.orcamentos?.length) || isOrcamentista || (isGestor && status !== 'pendente'));
        
        setShowBudgetForm(shouldShowBudget);
        
        const consumerRequestedDate = plan?.execucao ? toLocalISOString(plan.execucao) : '';
        const initialVisita = plan?.visita ? toLocalISOString(plan.visita) : consumerRequestedDate;

        const currentObs = agenda?.observacoes || '';
        const planDesc = plan?.descricao || '';
        const isDefaultObs = currentObs.includes('[FLEXIBILIDADE DE AGENDA]:') || currentObs === planDesc;
        const initialAgendaObs = isDefaultObs ? '' : currentObs;

        setFormData({
            profissionalUuid: (typeof ticket.profissional === 'string' ? ticket.profissional : (ticket.profissional as any)?.uuid) || '',
            status: status, 
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
            planejamentoDesc: planDesc,
            planejamentoData: consumerRequestedDate,
            planejamentoRecursos: plan?.recursos || [],
            planejamentoPagamento: plan?.pagamento || 'Dinheiro',
            planejamentoVisita: initialVisita,
            fotoantes: ticket.fotoantes || [],
            fotodepois: ticket.fotodepois || [],
            agendaObs: initialAgendaObs
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
            const updatesChave: any = { status: formData.status };
            if (isProfessional) {
                updatesChave.fotoantes = formData.fotoantes;
                updatesChave.fotodepois = formData.fotodepois;
                
                if (editingItem.agenda?.length) {
                    await supabase.from('agenda').update({ observacoes: formData.agendaObs }).eq('id', editingItem.agenda[0].id);
                }
            } else if (isGestor || isPlanejista) {
                updatesChave.profissional = formData.profissionalUuid || null;
            }
            
            await supabase.from('chaves').update(updatesChave).eq('id', editingItem.id);

            if (showBudgetForm && !isProfessional && !isPlanejista) {
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
                if (editingItem.orcamentos?.length) await supabase.from('orcamentos').update(b).eq('id', editingItem.orcamentos[0].id);
                else await supabase.from('orcamentos').insert(b);
            }
            
            if (isGestor || isPlanejista) {
                const p: any = { 
                    chave: editingItem.id,
                    descricao: formData.planejamentoDesc, 
                    recursos: formData.planejamentoRecursos, 
                    pagamento: formData.planejamentoPagamento,
                    ativo: true
                };
                if (formData.planejamentoData) p.execucao = new Date(formData.planejamentoData).toISOString();
                if (formData.planejamentoVisita) p.visita = new Date(formData.planejamentoVisita).toISOString(); else p.visita = null;
                
                if (editingItem.planejamento?.length) await supabase.from('planejamento').update(p).eq('id', editingItem.planejamento[0].id);
                else await supabase.from('planejamento').insert(p);
            }
            
            await fetchData(); setIsModalOpen(false); alert('Salvo!');
        } catch (error: any) { alert(error.message); } finally { setSaving(false); }
    };

    const handleProfessionalDecision = async (accept: boolean) => {
        if (!editingItem || processingAction) return;
        setProcessingAction(true);
        try {
            if (accept) {
                await supabase.from('chaves').update({ status: 'aprovado' }).eq('id', editingItem.id);
            } else {
                await supabase.from('chaves').update({ status: 'pendente', profissional: null }).eq('id', editingItem.id);
                await supabase.from('agenda').delete().eq('id', editingItem.id);
            }
            await fetchData(); setIsModalOpen(false);
            alert(accept ? "Serviço aceito!" : "Serviço recusado.");
        } catch (e: any) { alert(e.message); } finally { setProcessingAction(false); }
    };

    const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'antes' | 'depois') => {
        if (!isProfessional || !e.target.files?.length) return;
        
        const file = e.target.files[0];
        setUploadError(null);
        
        if (file.size > MAX_FILE_SIZE) {
            const sizeInMb = (file.size / 1024 / 1024).toFixed(1);
            setUploadError(`O arquivo (${sizeInMb}MB) é maior que o tamanho máximo de 50MB.`);
            e.target.value = '';
            return;
        }

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
            const path = `pedidos/${editingItem?.chaveunica || 'order'}_${target}_${Date.now()}.${fileExt}`;
            
            const { error } = await supabase.storage.from('imagens').upload(path, file, {
                contentType: file.type || undefined,
                cacheControl: '3600',
                upsert: false
            });
            
            if (error) throw error;
            const { data } = supabase.storage.from('imagens').getPublicUrl(path);
            setFormData(prev => ({
                ...prev,
                [target === 'antes' ? 'fotoantes' : 'fotodepois']: [...prev[target === 'antes' ? 'fotoantes' : 'fotodepois'], data.publicUrl]
            }));
        } catch (error: any) { 
            console.error("Upload error:", error);
            setUploadError("Erro no upload.");
        } finally { 
            setUploading(false); 
        }
    };

    const handleSendToBudget = async () => {
        if (!editingItem) return;
        if (!formData.profissionalUuid) return alert("Selecione um profissional antes de enviar.");
        if (!formData.planejamentoData) return alert("Defina a data de execução prevista.");
        setSaving(true);
        try {
            await supabase.from('chaves').update({ profissional: formData.profissionalUuid, status: 'analise', planejista: currentUserId }).eq('id', editingItem.id);
            const p: any = { chave: editingItem.id, descricao: formData.planejamentoDesc, recursos: formData.planejamentoRecursos, pagamento: formData.planejamentoPagamento, execucao: new Date(formData.planejamentoData).toISOString(), visita: formData.planejamentoVisita ? new Date(formData.planejamentoVisita).toISOString() : null, ativo: true };
            if (editingItem.planejamento?.length) await supabase.from('planejamento').update(p).eq('id', editingItem.planejamento[0].id);
            else await supabase.from('planejamento').insert(p);
            alert("Enviado para orçamento!");
            await fetchData(); setIsModalOpen(false);
        } catch (error: any) { alert(error.message); } finally { setSaving(false); }
    };

    const handleSendToConsumer = async () => {
        if (!editingItem) return;
        if (formData.orcamentoPreco <= 0) return alert("O valor do orçamento deve ser maior que zero.");
        setSaving(true);
        try {
            await supabase.from('chaves').update({ status: 'aguardando_aprovacao', orcamentista: currentUserId }).eq('id', editingItem.id);
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
            if (editingItem.orcamentos?.length) await supabase.from('orcamentos').update(b).eq('id', editingItem.orcamentos[0].id);
            else await supabase.from('orcamentos').insert(b);
            alert("Orçamento enviado!");
            await fetchData(); setIsModalOpen(false);
        } catch (error: any) { alert(error.message); } finally { setSaving(false); }
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

    const actingAsPlanning = isPlanejista || (isGestor && formData.status === 'pendente');
    const actingAsBudget = isOrcamentista || (isGestor && (formData.status === 'analise' || formData.status === 'reprovado'));
    const isBudgetLocked = ['aprovado', 'executando', 'concluido'].includes(formData.status.toLowerCase());

    const availableProfessionals = useMemo(() => {
        if (!editingItem) return [];
        return professionals.filter(p => {
            const matchesCity = p.cidade === editingItem.cidade;
            const matchesSpecialty = p.atividade?.includes(editingItem.atividade);
            return matchesCity && matchesSpecialty;
        });
    }, [professionals, editingItem]);

    const selectedProfessional = useMemo(() => {
        return professionals.find(p => p.uuid === formData.profissionalUuid);
    }, [professionals, formData.profissionalUuid]);

    const currentClientDescription = useMemo(() => {
        return extractOriginalDesc(editingItem?.planejamento?.[0]?.descricao);
    }, [editingItem]);

    const currentClientFlexibility = useMemo(() => {
        return extractFlexibility(editingItem?.planejamento?.[0]?.descricao);
    }, [editingItem]);

    return (
        <div className="min-h-screen bg-ios-bg pb-20">
            <div className="bg-white/80 backdrop-blur-md px-5 pt-12 pb-4 sticky top-0 z-40 border-b border-gray-200">
                <div className="flex justify-between items-start">
                    <div><h1 className="text-3xl font-bold text-gray-900 tracking-tight">Chamados</h1><p className="text-gray-500 text-sm mt-1">Gestão inteligente.</p></div>
                    <div className="flex items-center space-x-2">
                        <div className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold uppercase text-gray-700 border border-gray-200">{currentUserRole || '...'}</div>
                        <div className="relative" ref={notificationRef}>
                            <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 rounded-full bg-gray-100 hover:bg-gray-200"><Bell size={20} className="text-gray-700" />{notifications.length > 0 && <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full ring-1 ring-white"></span>}</button>
                            {showNotifications && (
                                <div className="absolute right-0 top-12 w-80 bg-white/95 backdrop-blur-xl border border-gray-200 shadow-2xl rounded-[1.5rem] overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2">
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
                    <input type="text" placeholder="Buscar por ID, Cliente ou Serviço..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl py-3 pl-10 pr-4 text-sm outline-none shadow-sm focus:ring-2 focus:ring-ios-blue/10" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {loading ? (<div className="col-span-full flex justify-center py-10"><Loader2 className="animate-spin text-ios-blue"/></div>) : getFilteredTickets().length > 0 ? getFilteredTickets().map(t => {
                        const clientDescription = extractOriginalDesc(t.planejamento?.[0]?.descricao);
                        return (
                            <div key={t.id} onClick={() => handleEdit(t)} className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer relative overflow-hidden group">
                                <div className={`absolute top-0 right-0 px-3 py-1.5 rounded-bl-2xl text-[10px] font-bold uppercase border-b border-l ${getStatusColor(t.status)}`}>{t.status.replace('_',' ')}</div>
                                <div className="flex items-center space-x-3 mb-4">
                                    <div className="w-12 h-12 bg-gray-50 rounded-2xl overflow-hidden">
                                        {t.geral?.imagem ? <img src={t.geral.imagem} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-gray-300"><FileText size={20}/></div>}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 leading-tight truncate w-40">{t.geral?.nome}</h3>
                                        <div className="inline-flex items-center mt-1 bg-gray-100 px-2 py-0.5 rounded border border-gray-200"><Hash size={10} className="text-gray-400 mr-1" /><span className="text-[10px] font-black text-gray-700 font-mono">{t.chaveunica}</span></div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-xl flex items-center space-x-2 mb-3"><div className="w-8 h-8 rounded-full bg-white overflow-hidden border border-gray-100"><img src={t.clienteData?.fotoperfil || `https://ui-avatars.com/api/?name=${t.clienteData?.nome || 'U'}`} className="w-full h-full object-cover"/></div><div className="overflow-hidden"><p className="text-[10px] font-bold text-gray-400 uppercase">Cliente</p><p className="text-xs font-bold text-gray-900 truncate">{t.clienteData?.nome}</p></div></div>
                                {isInternal && clientDescription && (
                                    <div className="mb-3 px-4 py-3 bg-yellow-50/50 border border-yellow-100 rounded-2xl">
                                        <p className="text-xs font-bold text-gray-800 line-clamp-2 italic leading-relaxed">"{clientDescription}"</p>
                                    </div>
                                )}
                                <div className="flex justify-between items-center text-xs text-gray-500">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center text-gray-400 text-[10px]"><Calendar size={10} className="mr-1"/> {new Date(t.created_at).toLocaleDateString('pt-BR')}</div>
                                        {t.planejamento?.[0]?.execucao && (
                                            <div className="flex items-center font-bold text-ios-blue"><Clock size={12} className="mr-1"/> {new Date(t.planejamento[0].execucao).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})} {new Date(t.planejamento[0].execucao).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</div>
                                        )}
                                    </div>
                                    {!isProfessional && t.orcamentos?.length ? (
                                        <div className="flex items-center font-bold text-green-700 text-sm"><DollarSign size={14}/> {t.orcamentos[0].preco.toFixed(2)}</div>
                                    ) : null}
                                </div>
                            </div>
                        );
                    }) : (<div className="col-span-full text-center py-12 text-gray-400 font-bold border-2 border-dashed border-gray-100 rounded-[2.5rem]">Vazio.</div>)}
                </div>
            </div>

            {isModalOpen && editingItem && (
                 <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                            <div><h3 className="font-bold text-gray-900 text-lg leading-tight">{editingItem.geral?.nome}</h3><div className="flex items-center mt-1"><span className="bg-gray-100 text-gray-900 px-2 py-1 rounded-md text-[10px] font-black font-mono flex items-center border border-gray-200"><Hash size={10} className="mr-1 opacity-50"/> {editingItem.chaveunica}</span></div></div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 transition-colors"><X size={20} /></button>
                        </div>

                        <div className="flex border-b border-gray-100 bg-white overflow-x-auto no-scrollbar h-14 shrink-0">
                            <button onClick={() => setModalSubTab('status')} className={`flex-1 min-w-[80px] h-full flex flex-col items-center justify-center transition-all relative group`}>
                                <span className={`text-[10px] font-black uppercase tracking-widest leading-none ${modalSubTab === 'status' ? 'text-ios-blue' : 'text-gray-400'}`}>Geral</span>
                                {modalSubTab === 'status' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}
                            </button>
                            <button onClick={() => setModalSubTab('consumidor')} className={`flex-1 min-w-[80px] h-full flex flex-col items-center justify-center transition-all relative group`}>
                                <span className={`text-[10px] font-black uppercase tracking-widest leading-none ${modalSubTab === 'consumidor' ? 'text-ios-blue' : 'text-gray-400'}`}>Consumidor</span>
                                {modalSubTab === 'consumidor' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}
                            </button>
                            <button onClick={() => setModalSubTab('profissional')} className={`flex-1 min-w-[80px] h-full flex flex-col items-center justify-center transition-all relative group`}>
                                <span className={`text-[10px] font-black uppercase tracking-widest leading-none ${modalSubTab === 'profissional' ? 'text-ios-blue' : 'text-gray-400'}`}>Profissional</span>
                                {modalSubTab === 'profissional' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-6 flex-1 no-scrollbar bg-white">
                            {modalSubTab === 'status' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    {/* CORE INFO CARD - ALWAYS VISIBLE ON GERAL TAB */}
                                    <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gray-200 border border-gray-100 overflow-hidden shadow-sm flex-shrink-0 flex items-center justify-center font-black text-gray-500">
                                                    {selectedProfessional?.fotoperfil ? <img src={selectedProfessional.fotoperfil} className="w-full h-full object-cover" /> : <span>{selectedProfessional?.nome?.substring(0,2).toUpperCase() || 'N'}</span>}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Profissional Alocado</p>
                                                    <h4 className="font-black text-gray-900 text-sm truncate">{selectedProfessional?.nome || 'Não definido'}</h4>
                                                </div>
                                            </div>
                                            <div className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-black uppercase text-center min-w-[80px] shadow-sm ${getStatusColor(formData.status)}`}>
                                                {formData.status.replace('_', ' ')}
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-blue-50 rounded-lg text-ios-blue">
                                                    <Clock size={14} />
                                                </div>
                                                <div>
                                                    <p className="text-[8px] font-black text-gray-400 uppercase leading-none mb-0.5">Visita Técnica</p>
                                                    <p className="text-[10px] font-bold text-gray-900">
                                                        {formData.planejamentoVisita ? new Date(formData.planejamentoVisita).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : 'A definir'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-purple-50 rounded-lg text-purple-600">
                                                    <Calendar size={14} />
                                                </div>
                                                <div>
                                                    <p className="text-[8px] font-black text-gray-400 uppercase leading-none mb-0.5">Execução Prevista</p>
                                                    <p className="text-[10px] font-bold text-gray-900">
                                                        {formData.planejamentoData ? new Date(formData.planejamentoData).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : 'A definir'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* SEUS GANHOS - VISIBLE FOR PROFESSIONALS */}
                                    {isProfessional && (editingItem.orcamentos?.length || 0) > 0 && (
                                        <div className="bg-green-50/80 p-6 rounded-[2rem] border border-green-100 flex items-center justify-between shadow-sm animate-in slide-in-from-right-4 duration-500">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 bg-green-500 text-white rounded-2xl shadow-lg shadow-green-200">
                                                    <Wallet size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-green-700 uppercase tracking-[0.1em] mb-0.5">Seus Ganhos (Mão de Obra)</p>
                                                    <p className="text-xl font-black text-green-900">R$ {editingItem.orcamentos![0].hh.toFixed(2)}</p>
                                                </div>
                                            </div>
                                            <div className="bg-green-100 px-3 py-1 rounded-full text-[10px] font-black text-green-700 border border-green-200">
                                                $
                                            </div>
                                        </div>
                                    )}

                                    {/* STATUS SELECT - ALWAYS VISIBLE FOR RESPONSIBLE PARTIES */}
                                    {(isProfessional || isGestor) && (
                                        <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 shadow-inner">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-4 block">Status do Serviço</label>
                                            <select 
                                                disabled={(isProfessional && editingItem.status === 'concluido') || processingAction} 
                                                className="w-full bg-white border border-gray-200 rounded-xl p-4 text-sm font-black text-gray-900 outline-none shadow-sm appearance-none" 
                                                value={formData.status} 
                                                onChange={(e) => setFormData({...formData, status: e.target.value})}
                                            >
                                                <option value="aguardando_profissional">Aguardando Aceite</option>
                                                <option value="aprovado">Agendado</option>
                                                <option value="executando">Executando</option>
                                                <option value="concluido">Concluído</option>
                                                <option value="cancelado">Cancelado</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* CLIENT INFO CARD - ALWAYS VISIBLE ON GERAL */}
                                    <div className="bg-blue-50/50 p-6 rounded-[2.5rem] border border-blue-100 flex items-center space-x-4 shadow-sm">
                                        <div className="w-12 h-12 rounded-2xl bg-white border border-blue-100 overflow-hidden flex-shrink-0 shadow-sm">
                                            <img src={editingItem.clienteData?.fotoperfil || `https://ui-avatars.com/api/?name=${editingItem.clienteData?.nome || 'U'}`} className="w-full h-full object-cover"/>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-0.5">Cliente</p>
                                            <p className="text-sm font-bold text-gray-900 truncate">{editingItem.clienteData?.nome}</p>
                                            <p className="text-[10px] text-gray-500 font-medium flex items-center gap-1 mt-1 truncate">
                                                <MapPin size={10}/> {editingItem.clienteData?.rua}, {editingItem.clienteData?.numero}
                                            </p>
                                        </div>
                                    </div>

                                    {/* ADDITIONAL FORMS BASED ON ROLE */}
                                    {actingAsPlanning && (
                                        <div className="space-y-6 pt-4 animate-in slide-in-from-top-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Alterar Profissional</label>
                                                <select className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold text-gray-900 outline-none" value={formData.profissionalUuid} onChange={(e) => setFormData({...formData, profissionalUuid: e.target.value})}>
                                                    <option value="">Escolha um profissional...</option>
                                                    {availableProfessionals.map(p => (<option key={p.uuid} value={p.uuid}>{p.nome}</option>))}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {actingAsBudget && (
                                        <div className="space-y-6 pt-4 animate-in slide-in-from-top-4">
                                            <div className="bg-blue-50/50 p-6 rounded-[2.5rem] border border-blue-100 space-y-6 shadow-sm">
                                                <div className="flex justify-between items-center border-b border-blue-100 pb-3">
                                                    <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest flex items-center"><DollarSign size={14} className="mr-1"/> Detalhamento</h4>
                                                    <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-black">Total: R$ {formData.orcamentoPreco.toFixed(2)}</div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-blue-700 uppercase tracking-wider ml-1">Custo Fixo</label><input type="number" step="0.01" disabled={isBudgetLocked} className="w-full bg-white border border-blue-200 rounded-xl p-3 text-sm font-bold text-gray-900 outline-none disabled:bg-gray-100" value={formData.orcamentoCusto} onChange={(e) => setFormData({...formData, orcamentoCusto: parseFloat(e.target.value) || 0})}/></div>
                                                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-blue-700 uppercase tracking-wider ml-1">Mão de Obra</label><input type="number" step="0.01" disabled={isBudgetLocked} className="w-full bg-white border border-blue-200 rounded-xl p-3 text-sm font-bold text-gray-900 outline-none disabled:bg-gray-100" value={formData.orcamentoHH} onChange={(e) => setFormData({...formData, orcamentoHH: parseFloat(e.target.value) || 0})}/></div>
                                                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-blue-700 uppercase tracking-wider ml-1">Lucro</label><input type="number" step="0.01" disabled={isBudgetLocked} className="w-full bg-white border border-blue-200 rounded-xl p-3 text-sm font-bold text-gray-900 outline-none disabled:bg-gray-100" value={formData.orcamentoLucro} onChange={(e) => setFormData({...formData, orcamentoLucro: parseFloat(e.target.value) || 0})}/></div>
                                                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-blue-700 uppercase tracking-wider ml-1">Impostos (%)</label><input type="number" step="0.1" disabled={isBudgetLocked} className="w-full bg-white border border-blue-200 rounded-xl p-3 text-sm font-bold text-gray-900 outline-none disabled:bg-gray-100" value={formData.orcamentoImposto} onChange={(e) => setFormData({...formData, orcamentoImposto: parseFloat(e.target.value) || 0})}/></div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {modalSubTab === 'consumidor' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="bg-yellow-50/50 p-6 rounded-[2.5rem] border border-yellow-100 shadow-sm">
                                        <div className="flex items-center gap-2 text-yellow-700 mb-4"><UserCircle size={18} /><h4 className="text-[10px] font-black uppercase tracking-widest">Observações do Consumidor</h4></div>
                                        <p className="text-sm font-bold text-gray-800 leading-relaxed italic mb-6">"{currentClientDescription || "Nenhuma descrição."}"</p>
                                        {editingItem.planejamento?.[0]?.imagem_pedido && (
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black text-yellow-600 uppercase tracking-widest ml-1">Mídia do Cliente</label>
                                                <div className="w-full h-48 bg-gray-100 rounded-2xl overflow-hidden border border-yellow-100 group">
                                                    {isMediaVideo(editingItem.planejamento[0].imagem_pedido) ? <video src={editingItem.planejamento[0].imagem_pedido} className="w-full h-full object-cover" controls /> : <img src={editingItem.planejamento[0].imagem_pedido} className="w-full h-full object-contain cursor-zoom-in" onClick={() => window.open(editingItem.planejamento![0].imagem_pedido!, '_blank')} />}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* EXIBIÇÃO DE FLEXIBILIDADE DE HORÁRIO */}
                                    {currentClientFlexibility && (
                                        <div className="bg-blue-50/50 p-6 rounded-[2.5rem] border border-blue-100 shadow-sm">
                                            <div className="flex items-center gap-2 text-blue-700 mb-4">
                                                <Clock size={18} />
                                                <h4 className="text-[10px] font-black uppercase tracking-widest">Flexibilidade de Horário</h4>
                                            </div>
                                            <p className="text-sm font-bold text-blue-900 leading-relaxed italic">
                                                "{currentClientFlexibility}"
                                            </p>
                                        </div>
                                    )}

                                    <div className={`p-6 rounded-[2.5rem] border shadow-sm ${editingItem.avaliacao ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
                                        <div className={`flex items-center gap-2 mb-4 ${editingItem.avaliacao ? 'text-green-700' : 'text-gray-400'}`}><Star size={18} fill={editingItem.avaliacao ? "currentColor" : "none"} /><h4 className="text-[10px] font-black uppercase tracking-widest">Avaliação</h4></div>
                                        {editingItem.avaliacao ? (
                                            <div className="space-y-4">
                                                <div className="flex space-x-1">{[1,2,3,4,5].map(s => <Star key={s} size={18} className={s <= editingItem.avaliacao!.nota ? 'fill-green-500 text-green-500' : 'text-green-200'} />)}</div>
                                                <p className="text-xs font-bold text-green-900 leading-relaxed italic">"{editingItem.avaliacao.comentario}"</p>
                                            </div>
                                        ) : <p className="text-xs font-bold text-gray-400 italic text-center py-2">Aguardando avaliação.</p>}
                                    </div>
                                </div>
                            )}

                            {modalSubTab === 'profissional' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="bg-blue-50/50 p-6 rounded-[2.5rem] border border-blue-100 shadow-sm">
                                        <div className="flex items-center gap-2 text-blue-800 mb-4"><ClipboardList size={18} /><h4 className="text-[10px] font-black uppercase tracking-widest">Notas Técnicas</h4></div>
                                        <div className="w-full bg-white/60 border border-blue-100 rounded-2xl p-5 min-h-[120px]">
                                            {isProfessional ? <textarea className="w-full bg-transparent text-sm font-bold text-gray-900 outline-none resize-none" value={formData.agendaObs} onChange={(e) => setFormData({...formData, agendaObs: e.target.value})} placeholder="Notas da execução..."/> : <p className="text-sm font-bold text-blue-900 leading-relaxed italic">{formData.agendaObs || "Nenhuma nota técnica."}</p>}
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="space-y-3"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Execução (Antes)</label><div className="grid grid-cols-2 gap-3">
                                            {formData.fotoantes.map((url, i) => (<div key={i} className="aspect-video bg-gray-100 rounded-2xl overflow-hidden relative border border-gray-200">{isMediaVideo(url) ? <video src={url} className="w-full h-full object-cover" controls /> : <img src={url} className="w-full h-full object-cover" />}{isProfessional && editingItem.status !== 'concluido' && <button onClick={() => setFormData({...formData, fotoantes: formData.fotoantes.filter((_, idx) => idx !== i)})} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full"><Trash2 size={12}/></button>}</div>))}
                                            {isProfessional && editingItem.status !== 'concluido' && <label className="aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center cursor-pointer">{uploading ? <Loader2 className="animate-spin text-ios-blue"/> : <Camera size={24} className="text-gray-300" />}<input type="file" className="hidden" accept="image/*,video/*" onChange={(e) => handleMediaUpload(e, 'antes')} /></label>}
                                        </div></div>
                                        <div className="space-y-3"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Conclusão (Depois)</label><div className="grid grid-cols-2 gap-3">
                                            {formData.fotodepois.map((url, i) => (<div key={i} className="aspect-video bg-gray-100 rounded-2xl overflow-hidden relative border border-gray-200">{isMediaVideo(url) ? <video src={url} className="w-full h-full object-cover" controls /> : <img src={url} className="w-full h-full object-cover" />}{isProfessional && editingItem.status !== 'concluido' && <button onClick={() => setFormData({...formData, fotodepois: formData.fotodepois.filter((_, idx) => idx !== i)})} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full"><Trash2 size={12}/></button>}</div>))}
                                            {isProfessional && editingItem.status !== 'concluido' && <label className="aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center cursor-pointer">{uploading ? <Loader2 className="animate-spin text-ios-blue"/> : <Camera size={24} className="text-gray-300" />}<input type="file" className="hidden" accept="image/*,video/*" onChange={(e) => handleMediaUpload(e, 'depois')} /></label>}
                                        </div></div>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="p-6 border-t border-gray-100 bg-gray-50 mt-auto">
                            {isProfessional && formData.status === 'aguardando_profissional' ? (
                                <div className="flex gap-3 animate-in slide-in-from-bottom-2">
                                    <button onClick={() => handleProfessionalDecision(true)} disabled={processingAction} className="flex-[2] bg-black text-white py-4 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                                        {processingAction ? <Loader2 className="animate-spin" size={18}/> : <><ThumbsUp size={18}/><span>Aceitar Serviço</span></>}
                                    </button>
                                    <button onClick={() => handleProfessionalDecision(false)} disabled={processingAction} className="flex-1 bg-white border border-red-100 text-red-500 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 active:scale-95 transition-all">
                                        <ThumbsDown size={14}/><span>Recusar</span>
                                    </button>
                                </div>
                            ) : actingAsPlanning ? (
                                <button onClick={handleSendToBudget} disabled={saving || !formData.profissionalUuid} className="w-full bg-black text-white py-4 rounded-2xl font-bold shadow-xl active:scale-[0.98] transition-all flex justify-center items-center gap-2 disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={20} /> : <><Send size={18} /><span>Enviar para Orçamento</span></>}</button>
                            ) : actingAsBudget ? (
                                <button onClick={handleSendToConsumer} disabled={saving || isBudgetLocked} className="w-full bg-black text-white py-4 rounded-2xl font-bold shadow-xl active:scale-[0.98] transition-all flex justify-center items-center gap-2 disabled:opacity-50">
                                    {saving ? <Loader2 className="animate-spin" size={20} /> : <><Send size={18} /><span>{isBudgetLocked ? 'Orçamento Bloqueado' : 'Enviar Orçamento'}</span></>}
                                </button>
                            ) : (
                                <button onClick={handleSave} disabled={saving || (editingItem.status === 'concluido' && isProfessional && !!editingItem.avaliacao)} className="w-full bg-black text-white py-4 rounded-2xl font-bold shadow-xl active:scale-[0.98] transition-all flex justify-center items-center gap-2 disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18} /><span>Salvar Alterações</span></>}</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chamados;