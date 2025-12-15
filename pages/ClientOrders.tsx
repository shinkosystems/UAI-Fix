
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { User, Geral, Chave, Orcamento, Planejamento, Avaliacao } from '../types';
import { Loader2, FileText, DollarSign, Calendar, Clock, CheckCircle, ChevronRight, Package, User as UserIcon, X, Ban, Eye, CreditCard, Send, AlertTriangle, Star, ThumbsUp, Hash, Bell, Plus, Calculator } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from "jspdf";

interface OrderExtended extends Chave {
  geral: Geral;
  profissional: User | null;
  orcamentos: Orcamento[];
  planejamento: Planejamento[];
  avaliacao?: Avaliacao;
}

interface NotificationItem {
  id: number;
  title: string;
  description: string;
  date: string;
  type: 'agenda' | 'planning';
  read: boolean;
}

const ClientOrders: React.FC = () => {
  const [orders, setOrders] = useState<OrderExtended[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal & Action States
  const [selectedOrder, setSelectedOrder] = useState<OrderExtended | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Rejection Logic
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Rating Logic
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingOrder, setRatingOrder] = useState<OrderExtended | null>(null);

  // Notification State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [userType, setUserType] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();

    // Close notifications when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      let uuid = user?.id;
      if (!uuid) {
         // Demo fallback
         const { data: demoUsers } = await supabase.from('users').select('*').eq('ativo', true).limit(1);
         if (demoUsers && demoUsers.length > 0) uuid = demoUsers[0].uuid;
      }

      if (uuid) {
         setCurrentUserId(uuid);
         // Fetch User Info first to determine logic
         const { data: userData } = await supabase.from('users').select('tipo').eq('uuid', uuid).single();
         const type = userData?.tipo || '';
         setUserType(type);
         
         await loadData(uuid, type);
         
         if (type) {
             fetchNotifications(type, uuid);
         }
      }

    } catch (error: any) {
      console.error('Error fetching orders:', error.message || error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async (role: string, uuid: string) => {
      const normalizedRole = role.toLowerCase();
      let notifs: NotificationItem[] = [];

      try {
          if (normalizedRole === 'planejista' || normalizedRole === 'orcamentista') {
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
          else if (normalizedRole === 'consumidor') {
              const { data } = await supabase
                  .from('agenda')
                  .select(`id, execucao, observacoes, chaves (geral (nome), status)`)
                  .eq('cliente', uuid)
                  .order('execucao', { ascending: false })
                  .limit(10);
                  
              if (data) {
                  notifs = data.map((item: any) => ({
                      id: item.id,
                      title: item.chaves?.geral?.nome || 'Serviço Agendado',
                      description: `Status: ${item.chaves?.status}. ${item.observacoes || ''}`,
                      date: new Date(item.execucao).toLocaleDateString('pt-BR'),
                      type: 'agenda',
                      read: false
                  }));
              }
          }
          else if (normalizedRole === 'profissional') {
              const { data } = await supabase
                  .from('agenda')
                  .select(`id, execucao, observacoes, chaves (geral (nome), status)`)
                  .eq('profissional', uuid)
                  .order('execucao', { ascending: false })
                  .limit(10);
              
              if (data) {
                   notifs = data.map((item: any) => ({
                      id: item.id,
                      title: 'Novo Agendamento',
                      description: `${item.chaves?.geral?.nome} - Status: ${item.chaves?.status}`,
                      date: new Date(item.execucao).toLocaleDateString('pt-BR'),
                      type: 'agenda',
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
      const type = userType.toLowerCase();
      if (type === 'planejista' || type === 'orcamentista') navigate('/chamados');
      else if (type === 'consumidor') navigate('/orders');
      else navigate('/calendar');
  };

  const loadData = async (uuid: string, role: string) => {
    try {
      const normalizedRole = role.toLowerCase();
      
      // 1. Fetch Chaves (Orders) - Tabela Base
      let query = supabase
        .from('chaves')
        .select('*')
        .order('id', { ascending: false });

      if (normalizedRole === 'profissional') {
          query = query.eq('profissional', uuid);
      } else {
          query = query.eq('cliente', uuid);
      }

      const { data: chavesData, error: chavesError } = await query;

      if (chavesError) throw chavesError;

      if (!chavesData || chavesData.length === 0) {
        setOrders([]);
        return;
      }

      const chavesIds = chavesData.map(c => c.id);
      const serviceIds = new Set<number>();
      const userUuids = new Set<string>();

      chavesData.forEach((c) => {
        if (c.atividade) serviceIds.add(c.atividade);
        if (c.profissional) userUuids.add(c.profissional);
        if (c.cliente) userUuids.add(c.cliente);
      });

      const [servicesRes, usersRes, orcamentosRes, planRes, reviewsRes] = await Promise.all([
        serviceIds.size > 0 ? supabase.from('geral').select('*').in('id', Array.from(serviceIds)) : { data: [] },
        userUuids.size > 0 ? supabase.from('users').select('*').in('uuid', Array.from(userUuids)) : { data: [] },
        supabase.from('orcamentos').select('*').in('chave', chavesIds),
        supabase.from('planejamento').select('*').in('chave', chavesIds),
        supabase.from('avaliacoes').select('*').in('chave', chavesIds)
      ]);

      const servicesMap: Record<number, Geral> = {};
      servicesRes.data?.forEach((s: any) => servicesMap[s.id] = s);

      const usersMap: Record<string, User> = {};
      usersRes.data?.forEach((u: any) => usersMap[u.uuid] = u);

      const budgetsMap: Record<number, Orcamento[]> = {};
      orcamentosRes.data?.forEach((o: any) => {
        if (!budgetsMap[o.chave]) budgetsMap[o.chave] = [];
        budgetsMap[o.chave].push(o);
      });

      const plansMap: Record<number, Planejamento[]> = {};
      planRes.data?.forEach((p: any) => {
        if (!plansMap[p.chave]) plansMap[p.chave] = [];
        plansMap[p.chave].push(p);
      });

      const reviewsMap: Record<number, Avaliacao> = {};
      reviewsRes.data?.forEach((r: any) => {
          reviewsMap[r.chave] = r;
      });

      const fullOrders = chavesData.map((order) => {
        let displayUserUuid = normalizedRole === 'profissional' ? order.cliente : order.profissional;
        
        let displayUserObject = null;
        if (displayUserUuid) {
            displayUserObject = usersMap[displayUserUuid] || { 
                id: 0, uuid: displayUserUuid, nome: normalizedRole === 'profissional' ? 'Cliente' : 'Profissional', email: '', fotoperfil: '', tipo: '', cidade: 0, estado: 0 
            } as User;
        }

        return {
            ...order,
            geral: servicesMap[order.atividade] || { nome: 'Serviço' },
            profissional: displayUserObject,
            orcamentos: budgetsMap[order.id] || [],
            planejamento: plansMap[order.id] || [],
            avaliacao: reviewsMap[order.id] || null
        };
      });

      fullOrders.sort((a, b) => {
          const dateA = a.planejamento?.[0]?.execucao ? new Date(a.planejamento[0].execucao).getTime() : 0;
          const dateB = b.planejamento?.[0]?.execucao ? new Date(b.planejamento[0].execucao).getTime() : 0;
          return dateB - dateA;
      });

      setOrders(fullOrders as OrderExtended[]);

    } catch (error: any) {
      console.error("Erro ao carregar dados manuais:", error.message || error);
      throw error;
    }
  };

  const handleOpenDetails = (order: OrderExtended) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const generateAndUploadPDF = async (order: OrderExtended): Promise<string> => {
      // Tentar resolver jsPDF de forma segura
      let jsPDFConstructor = jsPDF;
      if ((jsPDF as any).default) {
          jsPDFConstructor = (jsPDF as any).default;
      }
      
      if (!jsPDFConstructor) {
          throw new Error("Biblioteca jsPDF não foi carregada corretamente.");
      }

      let doc;
      try {
        // @ts-ignore - Ignore type check for dynamic constructor
        doc = new jsPDFConstructor();
      } catch (err) {
        console.error("Failed to initialize jsPDF:", err);
        throw new Error("Erro ao inicializar gerador de PDF.");
      }

      const budget = order.orcamentos[0];
      const plan = order.planejamento[0];
      
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("ORDEM DE SERVIÇO", 105, 20, { align: "center" });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString()}`, 105, 28, { align: "center" });
      doc.text(`Chave do Pedido: ${order.chaveunica}`, 105, 33, { align: "center" });

      doc.setLineWidth(0.5);
      doc.line(20, 38, 190, 38);

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("DADOS DO SERVIÇO", 20, 48);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Profissional Responsável: ${userType.toLowerCase() === 'profissional' ? 'Você' : (order.profissional?.nome || 'A definir')}`, 20, 56);
      doc.text(`Tipo de Serviço: ${order.geral?.nome}`, 20, 62);

      if (plan) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("O QUE DEVE SER FEITO (ESCOPO)", 20, 80);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        
        const descLines = doc.splitTextToSize(plan.descricao || "Descrição detalhada não fornecida.", 170);
        doc.text(descLines, 20, 90);
        
        let yOffset = 90 + (descLines.length * 5);
        
        doc.setFont("helvetica", "bold");
        doc.text("Previsão de Execução:", 20, yOffset + 10);
        doc.setFont("helvetica", "normal");
        doc.text(new Date(plan.execucao).toLocaleString(), 60, yOffset + 10);
        
        if (plan.recursos && plan.recursos.length > 0) {
             yOffset += 20;
             doc.setFontSize(12);
             doc.setFont("helvetica", "bold");
             doc.text("MATERIAIS E RECURSOS NECESSÁRIOS", 20, yOffset);
             
             doc.setFontSize(10);
             doc.setFont("helvetica", "normal");
             plan.recursos.forEach((res, idx) => {
                 doc.text(`• ${res}`, 25, yOffset + 10 + (idx * 5));
             });
             yOffset += 10 + (plan.recursos.length * 5);
        } else {
            yOffset += 15;
        }

        if (budget) {
            yOffset += 10;
            doc.line(20, yOffset, 190, yOffset);
            yOffset += 10;

            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("VALORES E CONDIÇÕES", 20, yOffset);
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.text(`Valor Total Aprovado: R$ ${budget.preco.toFixed(2)}`, 20, yOffset + 10);
            doc.text(`Forma de Pagamento: ${budget.tipopagmto}`, 20, yOffset + 16);
            
            if (budget.parcelas > 1) {
                doc.text(`Parcelamento: ${budget.parcelas}x`, 20, yOffset + 22);
            }
        }
      }

      doc.setFontSize(8);
      doc.text("Este documento foi gerado automaticamente pelo sistema UAI Fix.", 105, 280, { align: "center" });

      const pdfBlob = doc.output('blob');
      const fileName = `os/${order.chaveunica}_${Date.now()}.pdf`; 

      const { error: uploadError } = await supabase.storage
        .from('os') 
        .upload(fileName, pdfBlob, {
            contentType: 'application/pdf',
            upsert: false
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('os').getPublicUrl(fileName);
      return data.publicUrl;
  };

  const handleApproveClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!selectedOrder) return;
    
    // REMOVIDO: window.confirm para ação imediata
    
    setProcessingId(selectedOrder.id);
    
    try {
        let pdfUrl = '';
        
        try {
            pdfUrl = await generateAndUploadPDF(selectedOrder);
        } catch (pdfErr: any) {
            console.error("PDF generation skipped (non-fatal):", pdfErr);
        }

        const plan = selectedOrder.planejamento[0];

        const osPayload: any = {
            chave: selectedOrder.id,
            status: 'pendente',
            datainicio: plan?.execucao || null,
            pdf: pdfUrl || null
        };

        const { data: osData, error: osError } = await supabase.from('ordemservico').insert(osPayload).select().single();

        if (osError) {
            // Se já existe (pode acontecer em cliques duplos rápidos), tentar update ou ignorar
            console.warn("Possível duplicação de OS:", osError);
        }

        const { data: chaveOriginal } = await supabase.from('chaves').select('cliente, profissional').eq('id', selectedOrder.id).single();

        if (plan?.execucao && chaveOriginal?.profissional) {
            await supabase.from('agenda').insert({
                execucao: plan.execucao,
                profissional: chaveOriginal.profissional,
                cliente: chaveOriginal.cliente,
                chave: selectedOrder.id,
                observacoes: `Serviço Aprovado: ${selectedOrder.geral?.nome}`
            });
        }

        const { error: keyError } = await supabase.from('chaves').update({ status: 'aprovado' }).eq('id', selectedOrder.id);

        if (keyError) throw keyError;

        updateLocalStatus(selectedOrder.id, 'aprovado');
        setIsModalOpen(false);
        alert('Orçamento Aprovado! Serviço iniciado.');

    } catch (error: any) {
        alert('Erro ao processar aprovação: ' + (error.message || "Erro desconhecido"));
    } finally {
        setProcessingId(null);
    }
  };

  const handleRateClick = (e: React.MouseEvent, order: OrderExtended) => {
      e.stopPropagation(); 
      setIsModalOpen(false);
      setRatingOrder(order);
      setRatingScore(0);
      setRatingComment('');
      setIsRatingModalOpen(true);
  };

  const submitRating = async () => {
      if (!ratingOrder || !ratingOrder.profissional?.uuid) return;
      if (ratingScore === 0) return alert("Selecione uma nota.");

      setProcessingId(ratingOrder.id);
      
      try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Usuário não autenticado.");

          const payload = {
              chave: ratingOrder.id,
              profissional: ratingOrder.profissional.uuid,
              cliente: user.id,
              nota: Math.round(Number(ratingScore)),
              comentario: ratingComment || ''
          };

          const { data, error } = await supabase.from('avaliacoes').insert(payload).select().single();
          if (error) throw error;

          setOrders(prev => prev.map(o => o.id === ratingOrder.id ? { ...o, avaliacao: data } : o));
          if (selectedOrder?.id === ratingOrder.id) {
              setSelectedOrder(prev => prev ? { ...prev, avaliacao: data } : null);
          }
          
          setIsRatingModalOpen(false);
          alert("Avaliação enviada com sucesso!");

      } catch (error: any) {
          alert("Erro ao enviar avaliação: " + error.message);
      } finally {
          setProcessingId(null);
      }
  };

  const handleRejectClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRejectionReason('');
    setIsRejectModalOpen(true);
  };

  const confirmRejection = async () => {
      if (!selectedOrder) return;
      if (!rejectionReason.trim()) return alert("Informe o motivo.");

      setProcessingId(selectedOrder.id);
      try {
          const budget = selectedOrder.orcamentos[0];
          if (budget) {
              const currentObs = budget.observacaocliente || '';
              const newObs = currentObs 
                ? `${currentObs}\n\n[REPROVADO PELO CLIENTE]: ${rejectionReason}` 
                : `[REPROVADO PELO CLIENTE]: ${rejectionReason}`;
              
              await supabase.from('orcamentos').update({ observacaocliente: newObs }).eq('id', budget.id);
          }

          const { error } = await supabase.from('chaves').update({ status: 'reprovado' }).eq('id', selectedOrder.id);
          if (error) throw error;

          updateLocalStatus(selectedOrder.id, 'reprovado');
          setIsRejectModalOpen(false);
          setIsModalOpen(false);
          alert('Orçamento reprovado.');

      } catch (error: any) {
          alert('Erro ao reprovar: ' + error.message);
      } finally {
          setProcessingId(null);
      }
  };

  const updateLocalStatus = (id: number, status: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    if (selectedOrder && selectedOrder.id === id) {
        setSelectedOrder({ ...selectedOrder, status });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pendente': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'aguardando_aprovacao': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'aprovado': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'executando': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'concluido': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelado': return 'bg-red-100 text-red-800 border-red-200';
      case 'reprovado': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pendente': return 'Análise Pendente';
      case 'aguardando_aprovacao': return 'Aprovação Necessária';
      case 'aprovado': return 'Aprovado';
      case 'executando': return 'Em Execução';
      case 'concluido': return 'Concluído';
      case 'cancelado': return 'Cancelado';
      case 'reprovado': return 'Reprovado';
      default: return status;
    }
  };

  const formatDate = (dateStr: string) => {
      if(!dateStr) return 'Data a definir';
      return new Date(dateStr).toLocaleDateString('pt-BR') + ' às ' + new Date(dateStr).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
  };

  const normUserType = userType?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
  const canCreateOrder = normUserType === 'gestor' || normUserType === 'consumidor';

  return (
    <div className="min-h-screen bg-ios-bg pb-20">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md px-5 pt-12 pb-4 sticky top-0 z-20 border-b border-gray-200">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Meus Pedidos</h1>
                <p className="text-gray-500 text-sm mt-1">Acompanhe seus orçamentos e serviços.</p>
            </div>
            
            <div className="flex items-center space-x-3">
                {canCreateOrder && (
                    <button 
                        onClick={() => navigate('/search')}
                        className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center shadow-lg hover:bg-gray-800 transition-all active:scale-95"
                    >
                        <Plus size={16} className="mr-1" />
                        Novo
                    </button>
                )}

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

      <div className="p-5 space-y-6 max-w-4xl mx-auto">
        {orders.length === 0 ? (
           <div className="text-center py-20 bg-white rounded-[2.5rem] shadow-sm border border-dashed border-gray-200">
             <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                 <FileText size={32} />
             </div>
             <h3 className="font-bold text-lg text-gray-800">Nenhum pedido encontrado</h3>
             {canCreateOrder && (
                 <button 
                    onClick={() => navigate('/search')}
                    className="mt-4 text-ios-blue font-bold text-sm hover:underline"
                 >
                    Fazer um novo pedido
                 </button>
             )}
           </div>
        ) : (
          orders.map(order => {
            const hasBudget = order.orcamentos && order.orcamentos.length > 0;
            const budget = hasBudget ? order.orcamentos[0] : null;
            const hasPlan = order.planejamento && order.planejamento.length > 0;
            const plan = hasPlan ? order.planejamento[0] : null;
            const isWaitingApproval = order.status === 'aguardando_aprovacao';
            const isCompleted = order.status === 'concluido';

            return (
              <div 
                key={order.id} 
                onClick={() => handleOpenDetails(order)}
                className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all cursor-pointer"
              >
                
                {/* Header Card */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex-shrink-0 overflow-hidden">
                       {order.geral?.imagem ? (
                         <img src={order.geral.imagem} alt="" className="w-full h-full object-cover" />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center text-gray-300"><FileText size={20}/></div>
                       )}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg leading-tight">{order.geral?.nome || 'Serviço Personalizado'}</h3>
                      
                      {/* CHAVE UNICA BADGE */}
                      <div className="inline-flex items-center mt-1.5 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">
                         <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mr-1.5">Chave:</span>
                         <span className="text-xs font-black text-gray-800 font-mono tracking-wide">{order.chaveunica || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getStatusColor(order.status)}`}>
                    {getStatusLabel(order.status)}
                  </span>
                </div>

                <div className="border-t border-dashed border-gray-100 my-4"></div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Partner Info (Cliente or Profissional) */}
                  <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-2xl">
                     <div className="w-10 h-10 rounded-full bg-white flex-shrink-0 overflow-hidden border border-gray-100">
                        <img src={order.profissional?.fotoperfil || `https://ui-avatars.com/api/?name=${order.profissional?.nome || 'U'}`} alt="" className="w-full h-full object-cover"/>
                     </div>
                     <div>
                        <p className="text-xs text-gray-400 font-bold uppercase">{normUserType === 'profissional' ? 'Cliente' : 'Profissional'}</p>
                        <p className="text-sm font-bold text-gray-900">{order.profissional?.nome || 'Ainda não atribuído'}</p>
                     </div>
                  </div>

                  {/* Date Info */}
                  {plan && (
                      <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-2xl">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-blue-500 border border-gray-100">
                            <Calendar size={18} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase">Data de Execução</p>
                            <p className="text-sm font-bold text-gray-900 truncate">
                                {formatDate(plan.execucao)}
                            </p>
                        </div>
                    </div>
                  )}
                </div>

                {/* Budget Preview / Action */}
                {hasBudget && budget ? (
                   <div className="mt-4 flex justify-between items-end">
                       <div>
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Orçamento</p>
                           <p className="text-xl font-bold text-gray-900">R$ {budget.preco?.toFixed(2)}</p>
                       </div>
                       
                       <div className="flex space-x-2">
                           {isWaitingApproval && (normUserType === 'consumidor' || normUserType === 'gestor') && (
                               <button className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-xl text-xs font-bold animate-pulse">
                                   Ação Necessária
                               </button>
                           )}
                           
                           {isCompleted && normUserType === 'consumidor' && (
                               order.avaliacao ? (
                                   <div className="bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center border border-yellow-100">
                                       <Star size={12} className="fill-yellow-500 text-yellow-500 mr-1"/>
                                       Avaliado ({order.avaliacao.nota})
                                   </div>
                               ) : (
                                   <button 
                                       onClick={(e) => handleRateClick(e, order)}
                                       className="bg-gray-900 text-white px-4 py-1.5 rounded-xl text-xs font-bold flex items-center shadow-lg hover:scale-105 transition-transform"
                                   >
                                       <Star size={12} className="mr-1.5"/>
                                       Avaliar Profissional
                                   </button>
                               )
                           )}

                           {(!isWaitingApproval || normUserType !== 'consumidor') && !isCompleted && (
                               <button className="text-ios-blue text-xs font-bold flex items-center bg-blue-50 px-3 py-1.5 rounded-lg">
                                   <Eye size={12} className="mr-1"/> Ver Detalhes
                               </button>
                           )}
                       </div>
                   </div>
                ) : (
                    <div className="mt-4 flex justify-end">
                        <button className="text-gray-400 text-xs font-medium flex items-center">
                            <ChevronRight size={14} className="mr-1"/> Ver detalhes do pedido
                        </button>
                    </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* --- ORDER DETAILS MODAL --- */}
      {isModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg">{selectedOrder.geral?.nome}</h3>
                        <div className="flex items-center mt-1">
                             <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mr-1">Chave:</span>
                             <span className="text-xs font-black text-gray-600 font-mono bg-gray-100 px-1.5 rounded">{selectedOrder.chaveunica}</span>
                        </div>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                {/* ... existing modal content ... */}
                <div className="p-6 overflow-y-auto space-y-6">
                    <div className={`p-4 rounded-2xl border text-center ${getStatusColor(selectedOrder.status)}`}>
                        <span className="font-bold uppercase text-sm tracking-wide">{getStatusLabel(selectedOrder.status)}</span>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center">
                            <UserIcon size={12} className="mr-1"/> {normUserType === 'profissional' ? 'Cliente' : 'Profissional Responsável'}
                        </h4>
                        <div className="flex items-center space-x-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <div className="w-12 h-12 rounded-full bg-white flex-shrink-0 overflow-hidden border-2 border-white shadow-sm">
                                <img src={selectedOrder.profissional?.fotoperfil || `https://ui-avatars.com/api/?name=${selectedOrder.profissional?.nome || 'U'}`} alt="" className="w-full h-full object-cover"/>
                            </div>
                            <div>
                                <p className="font-bold text-gray-900">{selectedOrder.profissional?.nome || 'Ainda não atribuído'}</p>
                                <p className="text-xs text-gray-500">{selectedOrder.profissional ? 'Verificado' : 'Aguardando confirmação'}</p>
                            </div>
                        </div>
                    </div>
                    
                    {/* BUDGET DETAILS (Highlight) */}
                    {selectedOrder.orcamentos && selectedOrder.orcamentos.length > 0 && (
                        <div className="bg-blue-50/50 p-5 rounded-3xl border border-blue-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-100 rounded-bl-full opacity-50 -mr-4 -mt-4"></div>
                            <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-4 flex items-center relative z-10">
                                <DollarSign size={14} className="mr-1"/> Orçamento Proposto
                            </h4>
                            
                            <div className="space-y-4 relative z-10">
                                {/* Total Value */}
                                <div>
                                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Valor Total</p>
                                    <p className="text-4xl font-black text-gray-900 tracking-tight mt-1">
                                        R$ {selectedOrder.orcamentos[0].preco.toFixed(2)}
                                    </p>
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-blue-200/50 w-full"></div>

                                {/* Payment Details Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Forma de Pagamento</p>
                                        <div className="bg-white px-3 py-2.5 rounded-xl border border-blue-100 flex items-center shadow-sm">
                                            <CreditCard size={14} className="text-blue-500 mr-2 flex-shrink-0"/>
                                            <span className="text-xs font-bold text-gray-800 capitalize truncate">
                                                {selectedOrder.orcamentos[0].tipopagmto}
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Parcelamento</p>
                                        <div className="bg-white px-3 py-2.5 rounded-xl border border-blue-100 flex items-center shadow-sm">
                                            <Calculator size={14} className="text-blue-500 mr-2 flex-shrink-0"/>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-gray-800">
                                                    {selectedOrder.orcamentos[0].parcelas}x
                                                </span>
                                                {selectedOrder.orcamentos[0].parcelas > 1 && (
                                                    <span className="text-[10px] font-medium text-gray-500 leading-tight">
                                                        de R$ {(selectedOrder.orcamentos[0].preco / selectedOrder.orcamentos[0].parcelas).toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 mt-auto">
                    {selectedOrder.status === 'aguardando_aprovacao' && (normUserType === 'consumidor' || normUserType === 'gestor' || currentUserId === selectedOrder.cliente) ? (
                        <div className="flex space-x-3">
                            <button 
                                onClick={(e) => handleRejectClick(e)}
                                disabled={processingId === selectedOrder.id}
                                className="flex-1 bg-white border border-red-100 text-red-600 hover:bg-red-50 py-3.5 rounded-2xl font-bold shadow-sm transition-all flex justify-center items-center"
                            >
                                {processingId === selectedOrder.id ? <Loader2 className="animate-spin" size={20}/> : <><Ban size={18} className="mr-2"/> Reprovar</>}
                            </button>
                            <button 
                                onClick={(e) => handleApproveClick(e)}
                                disabled={processingId === selectedOrder.id}
                                className="flex-[2] bg-green-600 text-white hover:bg-green-700 py-3.5 rounded-2xl font-bold shadow-lg shadow-green-200 transition-all flex justify-center items-center"
                            >
                                {processingId === selectedOrder.id ? <Loader2 className="animate-spin" size={20}/> : <><CheckCircle size={18} className="mr-2"/> Aprovar Orçamento</>}
                            </button>
                        </div>
                    ) : (
                        selectedOrder.status === 'concluido' && !selectedOrder.avaliacao && normUserType === 'consumidor' ? (
                            <div className="flex space-x-3">
                                <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-white border border-gray-200 text-gray-700 py-3.5 rounded-2xl font-bold hover:bg-gray-50 transition-colors">Fechar</button>
                                <button onClick={(e) => handleRateClick(e, selectedOrder)} className="flex-[2] bg-gray-900 text-white py-3.5 rounded-2xl font-bold shadow-lg hover:bg-gray-800 transition-all flex justify-center items-center"><Star size={18} className="mr-2"/> Avaliar Profissional</button>
                            </div>
                        ) : (
                            <button onClick={() => setIsModalOpen(false)} className="w-full bg-white border border-gray-200 text-gray-700 py-3.5 rounded-2xl font-bold hover:bg-gray-50 transition-colors">Fechar</button>
                        )
                    )}
                </div>
            </div>
        </div>
      )}

      {/* Rejection Modal */}
      {isRejectModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-6">
                  <div className="text-center mb-4">
                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 text-red-500">
                          <Ban size={24} />
                      </div>
                      <h3 className="font-bold text-gray-900 text-lg">Reprovar Orçamento</h3>
                      <p className="text-sm text-gray-500">Informe o motivo para o profissional.</p>
                  </div>
                  <textarea 
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm min-h-[100px] mb-4 focus:ring-2 focus:ring-red-100 outline-none"
                      placeholder="Ex: Valor muito alto..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                  />
                  <div className="flex space-x-3">
                      <button onClick={() => setIsRejectModalOpen(false)} className="flex-1 bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-bold">Cancelar</button>
                      <button onClick={confirmRejection} className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-red-200">Confirmar</button>
                  </div>
              </div>
          </div>
      )}
      
      {/* Rating Modal */}
      {isRatingModalOpen && ratingOrder && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden">
                  <div className="bg-yellow-50 p-6 text-center border-b border-yellow-100">
                      <div className="w-16 h-16 bg-white rounded-full mx-auto mb-3 shadow-sm border border-yellow-100 flex items-center justify-center">
                          <ThumbsUp size={32} className="text-yellow-500" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">Avaliar Serviço</h3>
                      <p className="text-sm text-gray-500 mt-1">Como foi sua experiência com<br/><strong>{ratingOrder.profissional?.nome}</strong>?</p>
                  </div>
                  <div className="p-6">
                      <div className="flex justify-center space-x-2 mb-6">
                          {[1, 2, 3, 4, 5].map((star) => (
                              <button key={star} onClick={() => setRatingScore(star)} className="transition-transform hover:scale-110 active:scale-95">
                                  <Star size={32} className={`${star <= ratingScore ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                              </button>
                          ))}
                      </div>
                      <textarea 
                          className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-yellow-200 outline-none resize-none min-h-[100px] mb-4"
                          placeholder="Escreva um comentário (opcional)..."
                          value={ratingComment}
                          onChange={(e) => setRatingComment(e.target.value)}
                      />
                      <div className="flex space-x-3">
                          <button onClick={() => setIsRatingModalOpen(false)} className="flex-1 bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl font-bold hover:bg-gray-50 transition-colors">Cancelar</button>
                          <button onClick={submitRating} disabled={processingId === ratingOrder.id} className="flex-1 bg-yellow-500 text-white py-3 rounded-2xl font-bold shadow-lg shadow-yellow-200 hover:bg-yellow-600 transition-colors flex justify-center items-center">
                              {processingId === ratingOrder.id ? <Loader2 className="animate-spin" size={20}/> : "Enviar"}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ClientOrders;
