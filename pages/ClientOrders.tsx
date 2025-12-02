
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { User, Geral, Chave, Orcamento, Planejamento, Avaliacao } from '../types';
import { Loader2, FileText, DollarSign, Calendar, Clock, CheckCircle, ChevronRight, Package, User as UserIcon, X, Ban, Eye, CreditCard, Send, AlertTriangle, Star, ThumbsUp, Hash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from "jspdf";

interface OrderExtended extends Chave {
  geral: Geral;
  profissional: User | null;
  orcamentos: Orcamento[];
  planejamento: Planejamento[];
  avaliacao?: Avaliacao; // Field to store existing review
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

  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
         // Demo fallback
         const { data: demoUsers } = await supabase.from('users').select('*').eq('ativo', true).limit(1);
         if (!demoUsers || demoUsers.length === 0) return;
         const demoId = demoUsers[0].uuid;
         
         await loadData(demoId);
      } else {
         await loadData(user.id);
      }
    } catch (error: any) {
      console.error('Error fetching orders:', error.message || error);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async (uuid: string) => {
    try {
      // 1. Fetch Chaves (Orders) - Tabela Base
      const { data: chavesData, error: chavesError } = await supabase
        .from('chaves')
        .select('*')
        .eq('cliente', uuid)
        .order('id', { ascending: false });

      if (chavesError) throw chavesError;

      if (!chavesData || chavesData.length === 0) {
        setOrders([]);
        return;
      }

      // 2. Coletar IDs para buscas em lote
      const chavesIds = chavesData.map(c => c.id);
      const serviceIds = new Set<number>();
      const proUuids = new Set<string>();

      chavesData.forEach((c) => {
        if (c.atividade) serviceIds.add(c.atividade);
        if (c.profissional) proUuids.add(c.profissional);
      });

      // 3. Buscas Paralelas (Manual Join)
      const [servicesRes, prosRes, orcamentosRes, planRes, reviewsRes] = await Promise.all([
        // Serviços
        serviceIds.size > 0 
          ? supabase.from('geral').select('*').in('id', Array.from(serviceIds)) 
          : { data: [] },
        
        // Profissionais
        proUuids.size > 0 
          ? supabase.from('users').select('*').in('uuid', Array.from(proUuids)) 
          : { data: [] },
        
        // Orçamentos vinculados
        supabase.from('orcamentos').select('*').in('chave', chavesIds),
        
        // Planejamentos vinculados
        supabase.from('planejamento').select('*').in('chave', chavesIds),

        // Avaliações já realizadas para esses pedidos
        supabase.from('avaliacoes').select('*').in('chave', chavesIds)
      ]);

      // 4. Mapeamento dos Dados (Indexação)
      const servicesMap: Record<number, Geral> = {};
      servicesRes.data?.forEach((s: any) => servicesMap[s.id] = s);

      const prosMap: Record<string, User> = {};
      prosRes.data?.forEach((u: any) => prosMap[u.uuid] = u);

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

      // 5. Hidratação Final
      const fullOrders = chavesData.map((order) => {
        // Fallback for Professional Object if ID exists but Data is missing (e.g. RLS blocked)
        let proObject = null;
        if (order.profissional) {
            proObject = prosMap[order.profissional] || { 
                id: 0, 
                uuid: order.profissional, 
                nome: 'Profissional', 
                email: '', 
                fotoperfil: '', 
                tipo: 'profissional', 
                cidade: 0, 
                estado: 0 
            } as User;
        }

        return {
            ...order,
            geral: servicesMap[order.atividade] || { nome: 'Serviço' },
            profissional: proObject,
            orcamentos: budgetsMap[order.id] || [],
            planejamento: plansMap[order.id] || [],
            avaliacao: reviewsMap[order.id] || null
        };
      });

      // 6. Ordenação por Data de Execução (Decrescente)
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

  // --- PDF GENERATOR HELPER ---
  const generateAndUploadPDF = async (order: OrderExtended): Promise<string> => {
      // ... (PDF Generation Logic - Unchanged)
      console.log("Inicializando jsPDF...");
      let doc;
      try {
        doc = new jsPDF();
      } catch (err) {
        console.error("Failed to initialize jsPDF:", err);
        throw new Error("Erro ao inicializar gerador de PDF. Tente recarregar a página.");
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
      
      doc.text(`Profissional Responsável: ${order.profissional?.nome || 'A definir'}`, 20, 56);
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

      if (uploadError) {
          throw new Error("Falha ao salvar PDF no Storage: " + uploadError.message);
      }

      const { data } = supabase.storage.from('os').getPublicUrl(fileName);
      return data.publicUrl;
  };

  // --- APPROVAL FLOW ---
  const handleApproveClick = async () => {
    // ... (Approval Logic - Unchanged)
    if (!selectedOrder) return;
    const confirmed = window.confirm('Confirma a aprovação deste orçamento? Uma ordem de serviço será gerada.');
    if (!confirmed) return;
    
    setProcessingId(selectedOrder.id);
    try {
        let pdfUrl = '';
        try {
            pdfUrl = await generateAndUploadPDF(selectedOrder);
        } catch (pdfErr: any) {
            alert("Aviso: O PDF da Ordem de Serviço não pôde ser gerado. O processo continuará sem o PDF.");
        }

        const plan = selectedOrder.planejamento[0];

        const osPayload: any = {
            chave: selectedOrder.id,
            status: 'pendente',
            datainicio: plan?.execucao || null,
            pdf: pdfUrl || null
        };

        const { data: osData, error: osError } = await supabase.from('ordemservico').insert(osPayload).select().single();

        if (osError) throw new Error("Erro ao criar registro de Ordem de Serviço: " + osError.message);

        if (plan?.execucao && selectedOrder.profissional?.uuid) {
            await supabase.from('agenda').insert({
                execucao: plan.execucao,
                profissional: selectedOrder.profissional.uuid,
                cliente: selectedOrder.cliente,
                chave: selectedOrder.id,
                observacoes: `Serviço Aprovado: ${selectedOrder.geral?.nome}`
            });
        }

        const { error: keyError } = await supabase.from('chaves').update({ status: 'aprovado' }).eq('id', selectedOrder.id);

        if (keyError) throw keyError;

        updateLocalStatus(selectedOrder.id, 'aprovado');
        setIsModalOpen(false);
        alert('Orçamento Aprovado com sucesso! Ordem de Serviço #' + osData.id + ' gerada.');

    } catch (error: any) {
        alert('Erro ao processar aprovação: ' + (error.message || JSON.stringify(error)));
    } finally {
        setProcessingId(null);
    }
  };

  // --- RATING FLOW ---
  const handleRateClick = (e: React.MouseEvent, order: OrderExtended) => {
      // ... (Rating Logic - Unchanged)
      if(e) e.stopPropagation(); 
      setIsModalOpen(false);
      setRatingOrder(order);
      setRatingScore(0);
      setRatingComment('');
      setIsRatingModalOpen(true);
  };

  const submitRating = async () => {
      // ... (Submit Rating Logic - Unchanged)
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

  // --- REJECTION FLOW ---
  const handleRejectClick = () => {
    setRejectionReason('');
    setIsRejectModalOpen(true);
  };

  const confirmRejection = async () => {
      // ... (Rejection Logic - Unchanged)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-ios-bg flex items-center justify-center">
        <Loader2 className="animate-spin text-ios-blue" size={32} />
      </div>
    );
  }

  // Helper to get formatted date
  const formatDate = (dateStr: string) => {
      if(!dateStr) return 'Data a definir';
      return new Date(dateStr).toLocaleDateString('pt-BR') + ' às ' + new Date(dateStr).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
  };

  return (
    <div className="min-h-screen bg-ios-bg pb-20">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md px-5 pt-12 pb-4 sticky top-0 z-20 border-b border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Meus Pedidos</h1>
        <p className="text-gray-500 text-sm mt-1">Acompanhe seus orçamentos e serviços.</p>
      </div>

      <div className="p-5 space-y-6 max-w-4xl mx-auto">
        {orders.length === 0 ? (
           <div className="text-center py-20 bg-white rounded-[2.5rem] shadow-sm border border-dashed border-gray-200">
             <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                 <FileText size={32} />
             </div>
             <h3 className="font-bold text-lg text-gray-800">Nenhum pedido encontrado</h3>
             <button 
                onClick={() => navigate('/search')}
                className="mt-4 text-ios-blue font-bold text-sm hover:underline"
             >
                Fazer um novo pedido
             </button>
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
                  
                  {/* Professional Info */}
                  <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-2xl">
                     <div className="w-10 h-10 rounded-full bg-white flex-shrink-0 overflow-hidden border border-gray-100">
                        <img src={order.profissional?.fotoperfil || `https://ui-avatars.com/api/?name=${order.profissional?.nome || 'P'}`} alt="" className="w-full h-full object-cover"/>
                     </div>
                     <div>
                        <p className="text-xs text-gray-400 font-bold uppercase">Profissional</p>
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
                           {isWaitingApproval && (
                               <button className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-xl text-xs font-bold animate-pulse">
                                   Ação Necessária
                               </button>
                           )}
                           
                           {/* RATING BUTTON IF COMPLETED */}
                           {isCompleted && (
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

                           {!isWaitingApproval && !isCompleted && (
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
                
                {/* Modal Header */}
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

                <div className="p-6 overflow-y-auto space-y-6">
                    
                    {/* Status Banner */}
                    <div className={`p-4 rounded-2xl border text-center ${getStatusColor(selectedOrder.status)}`}>
                        <span className="font-bold uppercase text-sm tracking-wide">{getStatusLabel(selectedOrder.status)}</span>
                    </div>

                    {/* Professional Section */}
                    <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center">
                            <UserIcon size={12} className="mr-1"/> Profissional Responsável
                        </h4>
                        <div className="flex items-center space-x-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <div className="w-12 h-12 rounded-full bg-white flex-shrink-0 overflow-hidden border-2 border-white shadow-sm">
                                <img src={selectedOrder.profissional?.fotoperfil || `https://ui-avatars.com/api/?name=${selectedOrder.profissional?.nome || 'P'}`} alt="" className="w-full h-full object-cover"/>
                            </div>
                            <div>
                                <p className="font-bold text-gray-900">{selectedOrder.profissional?.nome || 'Ainda não atribuído'}</p>
                                <p className="text-xs text-gray-500">{selectedOrder.profissional ? 'Verificado' : 'Aguardando confirmação'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Planning Details */}
                    {selectedOrder.planejamento && selectedOrder.planejamento.length > 0 && (
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center">
                                <FileText size={12} className="mr-1"/> Detalhes do Serviço
                            </h4>
                            
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3 text-sm">
                                <div>
                                    <span className="text-gray-500 text-xs block mb-0.5">Descrição do Problema:</span>
                                    <p className="text-gray-800 font-medium italic">"{selectedOrder.planejamento[0].descricao}"</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dashed border-gray-200">
                                    <div>
                                        <span className="text-gray-500 text-xs block mb-0.5">Execução:</span>
                                        <p className="font-bold text-gray-900">{formatDate(selectedOrder.planejamento[0].execucao)}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 text-xs block mb-0.5">Visita Técnica:</span>
                                        <p className="font-bold text-gray-900">{selectedOrder.planejamento[0].visita ? formatDate(selectedOrder.planejamento[0].visita) : 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {selectedOrder.planejamento[0].recursos && selectedOrder.planejamento[0].recursos.length > 0 && (
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Materiais Solicitados</span>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedOrder.planejamento[0].recursos.map((res: string, i: number) => (
                                            <span key={i} className="bg-white border border-gray-200 px-3 py-1 rounded-lg text-xs font-medium text-gray-600 flex items-center shadow-sm">
                                                <Package size={10} className="mr-1.5 opacity-50"/> {res}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* BUDGET DETAILS (Highlight) */}
                    {selectedOrder.orcamentos && selectedOrder.orcamentos.length > 0 && (
                        <div className="bg-blue-50/50 p-5 rounded-3xl border border-blue-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-100 rounded-bl-full opacity-50 -mr-4 -mt-4"></div>
                            
                            <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-4 flex items-center relative z-10">
                                <DollarSign size={14} className="mr-1"/> Orçamento Proposto
                            </h4>

                            <div className="space-y-4 relative z-10">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-sm text-gray-500">Valor Total</p>
                                        <p className="text-3xl font-bold text-gray-900 tracking-tight">R$ {selectedOrder.orcamentos[0].preco.toFixed(2)}</p>
                                    </div>
                                    <div className="text-right">
                                         <p className="text-xs text-gray-500 mb-1">Condição de Pagamento</p>
                                         <span className="bg-white px-3 py-1 rounded-lg text-xs font-bold border border-blue-100 capitalize flex items-center">
                                            <CreditCard size={10} className="mr-1"/>
                                            {selectedOrder.orcamentos[0].tipopagmto}
                                         </span>
                                    </div>
                                </div>
                                
                                {selectedOrder.orcamentos[0].observacaocliente && (
                                    <div className="bg-white/80 p-3 rounded-xl text-xs text-gray-600 border border-blue-100/50">
                                        <span className="font-bold block mb-0.5">Nota do Profissional:</span>
                                        {selectedOrder.orcamentos[0].observacaocliente}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 mt-auto">
                    {selectedOrder.status === 'aguardando_aprovacao' ? (
                        <div className="flex space-x-3">
                            <button 
                                onClick={handleRejectClick}
                                disabled={processingId === selectedOrder.id}
                                className="flex-1 bg-white border border-red-100 text-red-600 hover:bg-red-50 py-3.5 rounded-2xl font-bold shadow-sm transition-all flex justify-center items-center"
                            >
                                {processingId === selectedOrder.id ? <Loader2 className="animate-spin" size={20}/> : (
                                    <>
                                        <Ban size={18} className="mr-2"/> Reprovar
                                    </>
                                )}
                            </button>
                            <button 
                                onClick={handleApproveClick}
                                disabled={processingId === selectedOrder.id}
                                className="flex-[2] bg-green-600 text-white hover:bg-green-700 py-3.5 rounded-2xl font-bold shadow-lg shadow-green-200 transition-all flex justify-center items-center"
                            >
                                {processingId === selectedOrder.id ? <Loader2 className="animate-spin" size={20}/> : (
                                    <>
                                        <CheckCircle size={18} className="mr-2"/> Aprovar Orçamento
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        // Logic Update: Show Rating button if Completed and not rated yet
                        selectedOrder.status === 'concluido' && !selectedOrder.avaliacao ? (
                            <div className="flex space-x-3">
                                <button 
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 bg-white border border-gray-200 text-gray-700 py-3.5 rounded-2xl font-bold hover:bg-gray-50 transition-colors"
                                >
                                    Fechar
                                </button>
                                <button 
                                    onClick={(e) => handleRateClick(e, selectedOrder)}
                                    className="flex-[2] bg-gray-900 text-white py-3.5 rounded-2xl font-bold shadow-lg hover:bg-gray-800 transition-all flex justify-center items-center"
                                >
                                    <Star size={18} className="mr-2"/> Avaliar Profissional
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="w-full bg-white border border-gray-200 text-gray-700 py-3.5 rounded-2xl font-bold hover:bg-gray-50 transition-colors"
                            >
                                Fechar
                            </button>
                        )
                    )}
                </div>

            </div>
        </div>
      )}

      {/* --- RATING MODAL --- */}
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
                              <button
                                  key={star}
                                  onClick={() => setRatingScore(star)}
                                  className="transition-transform hover:scale-110 active:scale-95"
                              >
                                  <Star 
                                      size={32} 
                                      className={`${star <= ratingScore ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                                  />
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
                          <button 
                              onClick={() => setIsRatingModalOpen(false)}
                              className="flex-1 bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl font-bold hover:bg-gray-50 transition-colors"
                          >
                              Cancelar
                          </button>
                          <button 
                              onClick={submitRating}
                              disabled={processingId === ratingOrder.id || ratingScore === 0}
                              className="flex-1 bg-black text-white py-3 rounded-2xl font-bold shadow-lg transition-colors hover:bg-gray-800 disabled:opacity-70 disabled:scale-100"
                          >
                              {processingId === ratingOrder.id ? <Loader2 className="animate-spin mx-auto" size={20}/> : 'Enviar'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- REJECTION MODAL --- */}
      {isRejectModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-6 relative overflow-hidden">
                  <div className="text-center mb-5">
                      <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
                          <AlertTriangle size={28} />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">Motivo da Reprovação</h3>
                      <p className="text-sm text-gray-500">Ajude-nos a entender o que não ficou bom.</p>
                  </div>

                  <textarea 
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-red-100 outline-none resize-none min-h-[100px] mb-4"
                      placeholder="Ex: Valor muito alto, prazo não atende..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                  />

                  <div className="flex space-x-3">
                      <button 
                          onClick={() => setIsRejectModalOpen(false)}
                          className="flex-1 bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                      >
                          Cancelar
                      </button>
                      <button 
                          onClick={confirmRejection}
                          className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-red-200 hover:bg-red-600 transition-colors"
                      >
                          Confirmar
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default ClientOrders;
