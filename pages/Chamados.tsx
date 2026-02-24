
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Chave, Geral, User, Orcamento, Planejamento, Avaliacao, Agenda } from '../types';
import { 
    Loader2, Search, Plus, X, Save, Send, FileText, 
    User as UserIcon, Calendar, DollarSign, CheckCircle, 
    AlertTriangle, ChevronRight, Clock, Briefcase, MapPin,
    Wallet, CreditCard, LayoutGrid, Box, Trash2, Hash, Percent, Bell, Smartphone, Banknote, Camera, ThumbsUp, Star,
    AlertCircle, Play, Image as ImageIcon, ClipboardList, ThumbsDown, PlayCircle, Sparkles, MessageSquare, Tag,
    History, CheckCircle2, Ban, Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StatusSection from '@/components/modals/StatusSection';
import PlanningSection from '@/components/modals/PlanningSection';
import BudgetSection from '@/components/modals/BudgetSection';
import ConsumerTab from '@/components/modals/ConsumerTab';
import ProfessionalTab from '@/components/modals/ProfessionalTab';
import PaymentInfoSection from '@/components/modals/PaymentInfoSection';
import FlexibilitySection from '@/components/modals/FlexibilitySection';

export interface ChamadoExtended extends Chave {
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

type TabType = 'novos' | 'orcamento' | 'execucao' | 'concluidos' | 'reprovados' | 'historico';
type ModalTab = 'status' | 'consumidor' | 'profissional';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const Chamados: React.FC = () => {
    // REQUISITO: Filtro padrão é Histórico
    const [activeTab, setActiveTab] = useState<TabType>('historico');
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
        orcamentoDesconto: 0,
        orcamentoTipoPgto: 'Dinheiro',
        orcamentoParcelas: 1,
        orcamentoTipoPgtoSugerido: '',
        orcamentoParcelasSugerido: 1,
        orcamentoDescontoSugerido: 0,
        orcamentoJustificativaSugerido: '',
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
        { id: 'novos', label: 'Novos', icon: AlertCircle, color: 'text-yellow-500' },
        { id: 'orcamento', label: 'Em Orçamento', icon: DollarSign, color: 'text-blue-500' },
        { id: 'execucao', label: 'Em Execução', icon: Activity, color: 'text-purple-500' },
        { id: 'concluidos', label: 'Concluídos', icon: CheckCircle2, color: 'text-green-500' },
        { id: 'reprovados', label: 'Reprovados', icon: Ban, color: 'text-red-500' },
        { id: 'historico', label: 'Histórico', icon: History, color: 'text-gray-500' }
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
    
    const extractInstallments = (desc: string | undefined | null) => {
        const val = extractMetadata(desc, "[PARCELAMENTO DESEJADO]:");
        if (!val) return 1;
        const num = parseInt(val.replace(/\D/g, ''));
        return isNaN(num) ? 1 : num;
    };
    
    const extractOriginalDesc = (desc: string | undefined | null) => {
        if (!desc) return "";
        const firstMarkerIndex = desc.indexOf('\n\n[');
        if (firstMarkerIndex !== -1) {
            return desc.substring(0, firstMarkerIndex).trim();
        }
        return desc.trim();
    };

    const visibleTabs = useMemo(() => {
        if (isProfessional) return allTabs.filter(tab => ['novos', 'execucao', 'concluidos', 'historico'].includes(tab.id));
        return allTabs;
    }, [isProfessional]);

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
            const userUuids = new Set<string>();
            const serviceIds = new Set<number>();
            chavesData.forEach(c => { if(c.cliente) userUuids.add(c.cliente); if(c.profissional) userUuids.add(c.profissional); if(c.atividade) serviceIds.add(c.atividade); });
            const [usersRes, servicesRes, orcRes, planRes, avalRes, agendaRes] = await Promise.all([
                userUuids.size > 0 ? supabase.from('users').select('*').in('uuid', Array.from(userUuids)) : { data: [] },
                serviceIds.size > 0 ? supabase.from('geral').select('*').in('id', Array.from(serviceIds)) : { data: [] },
                chaveIds.length > 0 ? supabase.from('orcamentos').select('*').in('chave', chaveIds).order('created_at', { ascending: false }) : { data: [] },
                chaveIds.length > 0 ? supabase.from('planejamento').select('*').in('chave', chaveIds).order('created_at', { ascending: false }) : { data: [] },
                chaveIds.length > 0 ? supabase.from('avaliacoes').select('*').in('chave', chaveIds) : { data: [] },
                chaveIds.length > 0 ? supabase.from('agenda').select('*').in('chave', chaveIds) : { data: [] }
            ]);
            const usersMap: Record<string, User> = {};
            usersRes.data?.forEach((u: any) => usersMap[u.uuid] = u);
            const servicesMap: Record<number, Geral> = {};
            servicesRes.data?.forEach((s: any) => servicesMap[s.id] = s);
            const orcMap: Record<number, Orcamento[]> = {};
            orcRes.data?.forEach((o: any) => { 
                const key = Number(o.chave);
                if(!orcMap[key]) orcMap[key] = []; 
                orcMap[key].push(o); 
            });
            const planMap: Record<number, Planejamento[]> = {};
            planRes.data?.forEach((p: any) => { 
                const key = Number(p.chave);
                if(!planMap[key]) planMap[key] = []; 
                planMap[key].push(p); 
            });
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
        if(data) setProfessionals(data as unknown as User[]);
    };

    const getFilteredTickets = () => {
        let filtered = tickets;
        
        if (isProfessional) {
            filtered = filtered.filter(t => t.profissional === currentUserId);
        }

        switch (activeTab) {
            case 'novos':
                filtered = filtered.filter(t => isProfessional ? t.status === 'aguardando_profissional' : t.status === 'pendente');
                break;
            case 'orcamento':
                filtered = filtered.filter(t => 
                    t.status === 'analise' || t.status === 'aguardando_profissional' || t.status === 'aguardando_aprovacao'
                );
                break;
            case 'execucao':
                filtered = filtered.filter(t => t.status === 'aprovado' || t.status === 'executando');
                break;
            case 'concluidos':
                filtered = filtered.filter(t => t.status === 'concluido');
                break;
            case 'reprovados':
                filtered = filtered.filter(t => t.status === 'reprovado');
                break;
            case 'historico':
                // Mostra todos, sem filtro extra além do de busca
                break;
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

    const filterCounts = useMemo(() => {
        const counts = { novos: 0, orcamento: 0, execucao: 0, concluidos: 0, reprovados: 0, historico: 0 };
        tickets.forEach(t => {
            const roleFiltered = isProfessional ? t.profissional === currentUserId : true;
            if (!roleFiltered) return;

            counts.historico++;
            if (isProfessional ? t.status === 'aguardando_profissional' : t.status === 'pendente') counts.novos++;
            if (t.status === 'analise' || t.status === 'aguardando_profissional' || t.status === 'aguardando_aprovacao') counts.orcamento++;
            if (t.status === 'aprovado' || t.status === 'executando') counts.execucao++;
            if (t.status === 'concluido') counts.concluidos++;
            if (t.status === 'reprovado') counts.reprovados++;
        });
        return counts;
    }, [tickets, isProfessional, currentUserId]);

    const handleEdit = (ticket: ChamadoExtended) => {
        setEditingItem(ticket);
        setModalSubTab('status');
        setUploadError(null);
        const budget = ticket.orcamentos?.[0];
        const plan = ticket.planejamento?.[0];
        const status = (ticket.status || 'pendente').toLowerCase();
        
        const shouldShowBudget = (isGestor && status !== 'pendente') || isOrcamentista || (!!ticket.orcamentos?.length && !isProfessional && !isPlanejista);
        setShowBudgetForm(shouldShowBudget);
        
        const consumerRequestedDate = plan?.execucao ? toLocalISOString(plan.execucao) : '';
        const initialVisita = plan?.visita ? toLocalISOString(plan.visita) : consumerRequestedDate;
        const consumerInstallments = extractInstallments(plan?.descricao);

        setFormData({
            profissionalUuid: (typeof ticket.profissional === 'string' ? ticket.profissional : (ticket.profissional as any)?.uuid) || '',
            status: status, 
            orcamentoPreco: budget?.preco || 0,
            orcamentoCusto: budget?.custofixo || 0,
            orcamentoHH: budget?.hh || 0,
            orcamentoImposto: budget?.imposto || 0,
            orcamentoLucro: budget?.lucro || 0,
            orcamentoTipoPgto: budget?.tipopagmto || plan?.pagamento || 'Dinheiro',
            orcamentoParcelas: budget?.parcelas || consumerInstallments,
            orcamentoTipoPgtoSugerido: budget?.tipopagmto_sugerido || '',
            orcamentoParcelasSugerido: budget?.parcelas_sugerido || 1,
            orcamentoDescontoSugerido: budget?.desconto_sugerido || 0,
            orcamentoJustificativaSugerido: budget?.justificativa_sugerido || '',
            orcamentoObs: budget?.observacaocliente || '',
            orcamentoNotaFiscal: budget?.notafiscal || false,
            planejamentoDesc: plan?.descricao || '',
            planejamentoData: consumerRequestedDate,
            planejamentoRecursos: plan?.recursos || [],
            planejamentoPagamento: plan?.pagamento || 'Dinheiro',
            planejamentoVisita: initialVisita,
            fotoantes: ticket.fotoantes || [],
            fotodepois: ticket.fotodepois || [],
            agendaObs: ticket.agenda?.[0]?.observacoes || ''
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
            let finalStatus = formData.status;
            
            // Auto-advance to budget stage if planning is complete
            if ((isGestor || isPlanejista) && formData.status === 'pendente') {
                if (formData.profissionalUuid && formData.planejamentoVisita && formData.planejamentoData) {
                    finalStatus = 'analise';
                }
            }

            // Auto-advance to professional acceptance stage if budget is complete
            if ((isGestor || isOrcamentista) && finalStatus === 'analise') {
                if (formData.orcamentoPreco > 0) {
                    finalStatus = 'aguardando_profissional';
                }
            }

            const updatesChave: any = { status: finalStatus };
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

            if (showBudgetForm && (isGestor || isOrcamentista)) {
                const b: any = { 
                    chave: editingItem.id, 
                    preco: formData.orcamentoPreco, 
                    custofixo: formData.orcamentoCusto, 
                    hh: formData.orcamentoHH, 
                    imposto: formData.orcamentoImposto, 
                    lucro: formData.orcamentoLucro, 
                    tipopagmto: formData.orcamentoTipoPgto, 
                    parcelas: formData.orcamentoParcelas, 
                    tipopagmto_sugerido: formData.orcamentoTipoPgtoSugerido || null,
                    parcelas_sugerido: formData.orcamentoParcelasSugerido,
                    desconto_sugerido: formData.orcamentoDescontoSugerido,
                    justificativa_sugerido: formData.orcamentoJustificativaSugerido || null,
                    observacaocliente: formData.orcamentoObs, 
                    notafiscal: formData.orcamentoNotaFiscal, 
                    ativo: true 
                };
                
                // Check if we already have a budget ID to update
                const existingBudgetId = editingItem.orcamentos?.[0]?.id;
                if (existingBudgetId) {
                    await supabase.from('orcamentos').update(b).eq('id', existingBudgetId);
                } else {
                    await supabase.from('orcamentos').insert(b);
                }
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
            
            await fetchData(); 
            setIsModalOpen(false); 
            const statusMsg = finalStatus !== formData.status ? ` e status atualizado para ${finalStatus.replace('_', ' ')}` : '';
            alert(`Salvo com sucesso${statusMsg}!`);
        } catch (error: any) { alert(error.message); } finally { setSaving(false); }
    };

    const handleStartExecution = async () => {
        if (!editingItem) return;
        setSaving(true);
        try {
            await supabase.from('chaves').update({ status: 'executando' }).eq('id', editingItem.id);
            await fetchData();
            setIsModalOpen(false);
            alert('Execução iniciada com sucesso!');
        } catch (error: any) {
            alert(error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleFinishTask = async () => {
        if (!editingItem) return;
        
        // Validação obrigatória
        if (formData.fotoantes.length === 0) {
            alert('É obrigatório inserir pelo menos uma foto de ANTES.');
            return;
        }
        if (formData.fotodepois.length === 0) {
            alert('É obrigatório inserir pelo menos uma foto de DEPOIS.');
            return;
        }
        if (!formData.agendaObs || formData.agendaObs.trim().length < 5) {
            alert('É obrigatório preencher as observações da tarefa na aba Profissional.');
            return;
        }

        setSaving(true);
        try {
            // Primeiro salvamos as fotos e observações (mesma lógica do handleSave para profissional)
            const updatesChave: any = { 
                status: 'concluido',
                fotoantes: formData.fotoantes,
                fotodepois: formData.fotodepois
            };
            
            await supabase.from('chaves').update(updatesChave).eq('id', editingItem.id);
            
            if (editingItem.agenda?.length) {
                await supabase.from('agenda').update({ observacoes: formData.agendaObs }).eq('id', editingItem.agenda[0].id);
            } else {
                // Se não existir agenda (improvável mas possível), criamos
                await supabase.from('agenda').insert({
                    chave: editingItem.id,
                    cliente: editingItem.cliente,
                    profissional: currentUserId,
                    observacoes: formData.agendaObs,
                    execucao: new Date().toISOString()
                });
            }

            await fetchData();
            setIsModalOpen(false);
            alert('Tarefa concluída com sucesso!');
        } catch (error: any) {
            alert(error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleAccept = async () => {
        if (!editingItem) return;
        setSaving(true);
        try {
            await supabase.from('chaves').update({ status: 'aguardando_aprovacao' }).eq('id', editingItem.id);
            await fetchData();
            setIsModalOpen(false);
            alert('Tarefa aceita com sucesso! Aguardando aprovação do cliente.');
        } catch (error: any) {
            alert(error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleReject = async () => {
        if (!editingItem) return;
        const reason = prompt("Por favor, informe o motivo da recusa:");
        if (reason === null) return;
        
        setSaving(true);
        try {
            await supabase.from('chaves').update({ 
                status: 'analise', // Volta para análise para que o gestor possa reatribuir
                motivo_recusa: reason 
            }).eq('id', editingItem.id);
            await fetchData();
            setIsModalOpen(false);
            alert('Tarefa recusada. O gestor será notificado para reatribuição.');
        } catch (error: any) {
            alert(error.message);
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
            case 'concluido': return 'bg-gray-100 text-gray-700 border-gray-200';
            case 'cancelado': return 'bg-red-100 text-red-900 border-red-200';
            case 'reprovado': return 'bg-red-50 text-red-700 border-red-100';
            default: return 'bg-gray-100 text-gray-900 border-gray-200';
        }
    };

    const availableProfessionals = useMemo(() => {
        if (!editingItem) return [];
        return professionals.filter(p => p.cidade === editingItem.cidade && p.atividade?.includes(editingItem.atividade));
    }, [professionals, editingItem]);

    return (
        <div className="min-h-screen bg-ios-bg pb-20">
            <div className="bg-white/80 backdrop-blur-md px-5 pt-12 pb-4 sticky top-0 z-40 border-b border-gray-200">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Chamados</h1>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Gestão Operacional</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="px-3 py-1 bg-gray-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest">{currentUserRole}</div>
                        <div className="relative" ref={notificationRef}>
                            <button onClick={() => setShowNotifications(!showNotifications)} className="p-2.5 bg-gray-100 rounded-full text-gray-700 relative">
                                <Bell size={20} />
                                {notifications.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-2">
                    {visibleTabs.map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id as TabType)} 
                            className={`flex items-center px-5 py-2.5 rounded-full text-xs font-black border transition-all whitespace-nowrap gap-2 ${activeTab === tab.id ? 'bg-black text-white border-black shadow-lg scale-105' : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'}`}
                        >
                            <tab.icon size={14} className={activeTab === tab.id ? 'text-white' : tab.color} />
                            <span>{tab.label}</span>
                            <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                {filterCounts[tab.id as keyof typeof filterCounts]}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-5 max-w-7xl mx-auto space-y-6">
                <div className="relative group">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-ios-blue transition-colors" />
                    <input 
                        type="text" 
                        placeholder="ID, Cliente ou Serviço..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="w-full bg-white border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold shadow-sm focus:ring-4 focus:ring-ios-blue/5 outline-none transition-all" 
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {loading ? (
                        <div className="col-span-full flex justify-center py-20"><Loader2 className="animate-spin text-ios-blue" size={40}/></div>
                    ) : getFilteredTickets().length > 0 ? getFilteredTickets().map(t => (
                        <div key={t.id} onClick={() => handleEdit(t)} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden group">
                            <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl text-[9px] font-black uppercase tracking-widest border-b border-l ${getStatusColor(t.status)}`}>
                                {t.status.replace('_',' ')}
                            </div>
                            
                            <div className="flex items-center space-x-4 mb-6">
                                <div className="w-14 h-14 bg-gray-50 rounded-2xl overflow-hidden shadow-inner flex-shrink-0">
                                    {t.geral?.imagem ? <img src={t.geral.imagem} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-gray-300"><FileText size={24}/></div>}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-black text-gray-900 text-lg leading-none truncate group-hover:text-ios-blue transition-colors">{t.geral?.nome}</h3>
                                    <div className="inline-flex items-center mt-2 bg-gray-50 px-2 py-0.5 rounded border border-gray-100"><Hash size={10} className="text-gray-400 mr-1" /><span className="text-[10px] font-black text-gray-500 font-mono tracking-tighter">{t.chaveunica}</span></div>
                                </div>
                            </div>

                            <div className="bg-gray-50/50 p-4 rounded-2xl flex items-center space-x-3 mb-5 border border-gray-100">
                                <div className="w-10 h-10 rounded-full bg-white overflow-hidden border border-gray-200 shadow-sm">
                                    <img src={t.clienteData?.fotoperfil || `https://ui-avatars.com/api/?name=${t.clienteData?.nome || 'U'}`} className="w-full h-full object-cover"/>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Solicitante</p>
                                    <p className="text-xs font-black text-gray-900 truncate">{t.clienteData?.nome}</p>
                                </div>
                            </div>

                            {activeTab === 'historico' && (
                                <div className="mb-4 flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${getStatusColor(t.status).split(' ')[1].replace('text-', 'bg-')}`}></div>
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status: {t.status.replace('_', ' ')}</span>
                                </div>
                            )}

                            <div className="flex justify-between items-end pt-4 border-t border-gray-50">
                                <div className="space-y-1.5">
                                    <div className="flex items-center text-gray-400 text-[9px] font-black uppercase tracking-widest"><Calendar size={12} className="mr-1.5 text-gray-300"/> {new Date(t.created_at).toLocaleDateString('pt-BR')}</div>
                                    {t.planejamento?.[0]?.execucao && (
                                        <div className="flex items-center font-black text-ios-blue text-[10px] uppercase tracking-widest"><Clock size={12} className="mr-1.5 opacity-60"/> {new Date(t.planejamento[0].execucao).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}</div>
                                    )}
                                </div>
                                {t.orcamentos?.[0]?.preco && (
                                    <div className="bg-green-50 px-3 py-1.5 rounded-xl border border-green-100">
                                        <span className="text-[10px] font-black text-green-700">R$ {t.orcamentos[0].preco.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )) : (
                        <div className="col-span-full py-24 bg-white rounded-[3rem] border-2 border-dashed border-gray-100 flex flex-col items-center text-center">
                            <Box size={48} className="text-gray-200 mb-4" />
                            <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Nenhum chamado nesta categoria</p>
                            <p className="text-gray-300 text-[10px] font-bold mt-1">Experimente alterar os filtros ou a busca</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL DE EDIÇÃO / DETALHES */}
            {isModalOpen && editingItem && (
                 <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                            <div>
                                <h3 className="font-black text-gray-900 text-lg leading-tight">
                                    {isPlanejista || (isGestor && formData.status === 'pendente') ? 'Planejamento - ' : 
                                     isOrcamentista || (isGestor && formData.status !== 'pendente') ? 'Orçamento - ' : ''}
                                    {editingItem.geral?.nome}
                                </h3>
                                <div className="flex items-center mt-1">
                                    <span className="bg-gray-100 text-gray-900 px-2 py-1 rounded-md text-[10px] font-black font-mono flex items-center border border-gray-200">
                                        <Hash size={10} className="mr-1 opacity-50"/> {editingItem.chaveunica}
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 transition-colors"><X size={20} /></button>
                        </div>

                        <div className="flex border-b border-gray-100 bg-white overflow-x-auto no-scrollbar h-14 shrink-0">
                            {(['status', 'consumidor', 'profissional'] as ModalTab[]).map(tab => (
                                <button key={tab} onClick={() => setModalSubTab(tab)} className={`flex-1 min-w-[80px] h-full flex flex-col items-center justify-center transition-all relative group`}>
                                    <span className={`text-[10px] font-black uppercase tracking-widest leading-none ${modalSubTab === tab ? 'text-ios-blue' : 'text-gray-400'}`}>{tab === 'status' ? 'Geral' : tab}</span>
                                    {modalSubTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}
                                </button>
                            ))}
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-6 flex-1 no-scrollbar bg-white">
                            {modalSubTab === 'status' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <StatusSection 
                                        formData={formData} 
                                        setFormData={setFormData} 
                                        isGestor={isGestor} 
                                        isOrcamentista={isOrcamentista}
                                        isProfessional={isProfessional}
                                        editingItem={editingItem}
                                        setShowBudgetForm={setShowBudgetForm} 
                                    />

                                    {(isOrcamentista || (isGestor && formData.status !== 'pendente')) && (
                                        <PaymentInfoSection 
                                            editingItem={editingItem} 
                                            installments={extractInstallments(editingItem.planejamento?.[0]?.descricao)}
                                        />
                                    )}

                                    {(isPlanejista || (isGestor && formData.status === 'pendente')) && (
                                        <FlexibilitySection 
                                            flexibility={extractFlexibility(editingItem.planejamento?.[0]?.descricao)} 
                                        />
                                    )}

                                    <PlanningSection 
                                        formData={formData} 
                                        setFormData={setFormData} 
                                        availableProfessionals={availableProfessionals} 
                                        isGestor={isGestor} 
                                        isPlanejista={isPlanejista} 
                                    />

                                    <BudgetSection 
                                        formData={formData} 
                                        setFormData={setFormData} 
                                        showBudgetForm={showBudgetForm} 
                                    />
                                </div>
                            )}

                            {modalSubTab === 'consumidor' && (
                                <ConsumerTab 
                                    editingItem={editingItem} 
                                    extractOriginalDesc={extractOriginalDesc} 
                                    isMediaVideo={isMediaVideo} 
                                />
                            )}

                            {modalSubTab === 'profissional' && (
                                <ProfessionalTab 
                                    formData={formData} 
                                    editingItem={editingItem}
                                    isMediaVideo={isMediaVideo} 
                                />
                            )}
                        </div>
                        
                        <div className="p-6 border-t border-gray-100 bg-gray-50 mt-auto flex gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-white border border-gray-200 text-gray-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95">Voltar</button>
                            
                            {isProfessional && formData.status === 'aguardando_profissional' ? (
                                <>
                                    <button 
                                        onClick={handleReject} 
                                        disabled={saving} 
                                        className="flex-1 bg-red-50 text-red-600 border border-red-100 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2"
                                    >
                                        {saving ? <Loader2 className="animate-spin" size={18} /> : <><ThumbsDown size={18} /><span>Recusar</span></>}
                                    </button>
                                    <button 
                                        onClick={handleAccept} 
                                        disabled={saving} 
                                        className="flex-[2] bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-200 flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {saving ? <Loader2 className="animate-spin" size={18} /> : <><ThumbsUp size={18} /><span>Aceitar Tarefa</span></>}
                                    </button>
                                </>
                            ) : isProfessional && formData.status === 'aprovado' ? (
                                <button 
                                    onClick={handleStartExecution} 
                                    disabled={saving} 
                                    className="flex-[2] bg-ios-blue text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200 flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="animate-spin" size={18} /> : <><Play size={18} /><span>Iniciar Execução</span></>}
                                </button>
                            ) : isProfessional && formData.status === 'executando' ? (
                                <button 
                                    onClick={handleFinishTask} 
                                    disabled={saving} 
                                    className="flex-[2] bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-200 flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle2 size={18} /><span>Finalizar Tarefa</span></>}
                                </button>
                            ) : (
                                <button onClick={handleSave} disabled={saving} className="flex-[2] bg-black text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                                    {saving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /><span>Salvar Alterações</span></>}
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
