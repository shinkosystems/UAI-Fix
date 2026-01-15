
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { User, Geral, Chave, Orcamento, Planejamento, Avaliacao, Agenda, OrdemServico } from '../types';
import { Loader2, X, Star, Calendar, Clock, ChevronRight, Send, Plus, Check, Ban, AlertCircle, Camera, Save, Trash2, ThumbsUp, ThumbsDown, Lock, Banknote, MapPin, UserCheck } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface OrderExtended extends Chave {
  geral: Geral;
  profissional: User | null;
  orcamentos: Orcamento[];
  planejamento: Planejamento[];
  avaliacao?: Avaliacao;
  agenda?: Agenda[];
  ordemServico?: OrdemServico[];
}

type ModalTab = 'geral' | 'fotos' | 'obs' | 'avaliacao';

const ClientOrders: React.FC = () => {
  const [orders, setOrders] = useState<OrderExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderExtended | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>('geral');
  const [userType, setUserType] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [processingAction, setProcessingAction] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [executionData, setExecutionData] = useState({
      status: '',
      datainicio: '',
      datafim: '',
      observacoes: '',
      fotoantes: [] as string[],
      fotodepois: [] as string[]
  });

  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [hoverRating, setHoverRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { fetchOrders(); }, []);

  useEffect(() => {
      if (!loading && location.state?.ratingOrderId && orders.length > 0) {
          const order = orders.find(o => o.id === location.state.ratingOrderId);
          if (order) {
              handleOpenDetails(order);
          }
      }
  }, [loading, location.state, orders]);

  const normalizedUserType = (userType || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const isConsumer = normalizedUserType === 'consumidor';
  const isProfessional = normalizedUserType === 'profissional';
  const isManager = normalizedUserType === 'gestor';
  
  const canActAsClient = true; // Na tela Meus Pedidos, o usuário age como dono do pedido
  const canCreateOrder = isConsumer || isManager;

  const toLocalISOString = (s: string) => { 
      if (!s) return ''; 
      const d = new Date(s); 
      return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0, 16); 
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
         setCurrentUserId(user.id);
         const { data } = await supabase.from('users').select('tipo').eq('uuid', user.id).single();
         setUserType(data?.tipo || '');
         await loadData(user.id, data?.tipo || '');
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const loadData = async (uuid: string, role: string) => {
    const normRole = role.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let query = supabase.from('chaves').select('*').order('id', { ascending: false });
    
    // REGRA DE OURO: Profissionais veem onde trabalham, todos os outros veem apenas onde são clientes (incluindo Gestores)
    if (normRole === 'profissional') {
        // Profissional só vê o chamado quando ele precisa agir (Aceite/Recusa) ou já está executando.
        // ADICIONADO: 'aguardando_aprovacao' agora também oculta o pedido para o profissional.
        query = query.eq('profissional', uuid).not('status', 'in', '("pendente","analise","aguardando_aprovacao")'); 
    } else {
        // Gestores, Consumidores e Equipe Interna veem apenas os seus próprios pedidos pessoais nesta tela
        query = query.eq('cliente', uuid);
    }

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
        const rawPro = c.profissional;
        const proUuid = typeof rawPro === 'string' ? rawPro : (rawPro as any)?.uuid;
        const otherUserUuid = normRole === 'profissional' ? c.cliente : proUuid;
        
        return {
            ...c,
            geral: sMap[c.atividade],
            profissional: uMap[otherUserUuid] || null,
            orcamentos: budgets.data?.filter(b => b.chave === c.id) || [],
            planejamento: plans.data?.filter(p => p.chave === c.id) || [],
            avaliacao: reviews.data?.find(r => r.chave === c.id),
            agenda: agenda.data?.filter(a => a.chave === c.id) || [],
            ordemServico: os.data?.filter(o => o.chave === c.id) || []
        };
    }));
  };

  const handleOpenDetails = (order: OrderExtended) => {
    setSelectedOrder(order);
    const os = order.ordemServico?.[0];
    const ag = order.agenda?.[0];
    setExecutionData({
        status: order.status || 'pendente',
        datainicio: toLocalISOString(os?.datainicio || ag?.execucao || ''),
        datafim: toLocalISOString(os?.datafim || ''),
        observacoes: ag?.observacoes || '',
        fotoantes: order.fotoantes || [],
        fotodepois: order.fotodepois || [],
    });
    
    setRatingScore(order.avaliacao?.nota || 0);
    setRatingComment(order.avaliacao?.comentario || '');
    
    // REGRA: Somente o cliente é direcionado automaticamente para a aba de avaliação ao abrir um pedido concluído não avaliado
    if (order.status === 'concluido' && !order.avaliacao && currentUserId === order.cliente) {
        setActiveTab('avaliacao');
    } else {
        setActiveTab('geral');
    }
    
    setIsModalOpen(true);
  };

  const handleProposalDecision = async (orderId: number, approved: boolean) => {
      if (!selectedOrder || processingAction) return;
      
      // SEGURANÇA: Apenas o cliente do chamado pode aprovar o orçamento
      if (currentUserId !== selectedOrder.cliente) {
          alert("Apenas o cliente que solicitou o serviço pode aprovar o orçamento.");
          return;
      }
      
      setProcessingAction(true);
      try {
          const plan = selectedOrder.planejamento?.[0];
          const rawPro = selectedOrder.profissional;
          const proUuid = typeof rawPro === 'string' ? rawPro : (rawPro as any)?.uuid;

          if (approved && (!plan || !proUuid)) {
              throw new Error("Dados de agendamento incompletos no sistema.");
          }

          const newStatus = approved ? 'aguardando_profissional' : 'reprovado';
          
          const { error: updateError } = await supabase
            .from('chaves')
            .update({ status: newStatus })
            .eq('id', orderId);
          
          if (updateError) throw updateError;
          
          if (approved && plan && proUuid) {
              const { data: existingAgenda } = await supabase.from('agenda').select('id').eq('chave', orderId).maybeSingle();
              
              const agendaPayload = {
                  chave: orderId,
                  cliente: selectedOrder.cliente,
                  profissional: proUuid,
                  execucao: plan.execucao,
                  observacoes: plan.descricao || 'Serviço aprovado pelo cliente.'
              };

              if (existingAgenda) {
                  await supabase.from('agenda').update(agendaPayload).eq('id', existingAgenda.id);
              } else {
                  await supabase.from('agenda').insert(agendaPayload);
              }
          }
          
          await fetchOrders();
          setIsModalOpen(false);
          if (!approved) alert("Proposta recusada.");
      } catch (e: any) {
          console.error("Erro ao processar:", e);
          alert("Erro: " + (e.message || "Erro desconhecido"));
      } finally {
          setProcessingAction(false);
      }
  };

  const handleProfessionalDecision = async (order: OrderExtended, accept: boolean) => {
      if (processingAction) return;
      
      setProcessingAction(true);
      try {
          if (accept) {
              const { error } = await supabase.from('chaves').update({ status: 'aprovado' }).eq('id', order.id);
              if (error) throw error;
          } else {
              const { error: chaveError } = await supabase.from('chaves').update({ status: 'pendente', profissional: null }).eq('id', order.id);
              if (chaveError) throw chaveError;
              if (order.agenda && order.agenda.length > 0) {
                  await supabase.from('agenda').delete().eq('id', order.agenda[0].id);
              }
          }
          await fetchOrders();
          setIsModalOpen(false);
      } catch (e: any) { 
          alert("Erro ao processar decisão: " + e.message); 
      } finally { 
          setProcessingAction(false); 
      }
  };

  const handleSaveProfessionalEdits = async () => {
      if (!selectedOrder || !isProfessional) return;
      setProcessingAction(true);
      try {
          const { error: chaveError } = await supabase.from('chaves').update({ 
              status: executionData.status,
              fotoantes: executionData.fotoantes,
              fotodepois: executionData.fotodepois
          }).eq('id', selectedOrder.id);
          if (chaveError) throw chaveError;

          if (selectedOrder.agenda?.length) {
              const { error: agendaError } = await supabase.from('agenda').update({ 
                  observacoes: executionData.observacoes 
              }).eq('id', selectedOrder.agenda[0].id);
              if (agendaError) throw agendaError;
          }

          alert("Dados atualizados!");
          await fetchOrders();
          setIsModalOpen(false);
      } catch (error: any) {
          alert("Erro ao salvar: " + error.message);
      } finally {
          setProcessingAction(false);
      }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'antes' | 'depois') => {
      if (!isProfessional || !e.target.files?.length) return;
      setUploading(true);
      try {
          const file = e.target.files[0];
          const path = `pedidos/${selectedOrder?.chaveunica || 'order'}_${target}_${Date.now()}.${file.name.split('.').pop()}`;
          const { error } = await supabase.storage.from('imagens').upload(path, file);
          if (error) throw error;
          const { data } = supabase.storage.from('imagens').getPublicUrl(path);
          setExecutionData(prev => ({
              ...prev,
              [target === 'antes' ? 'fotoantes' : 'fotodepois']: [...prev[target === 'antes' ? 'fotoantes' : 'fotodepois'], data.publicUrl]
          }));
      } catch (error: any) { alert(error.message); } finally { setUploading(false); }
  };

  const handleDeleteImage = (index: number, target: 'antes' | 'depois') => {
      if (!isProfessional || !window.confirm("Remover imagem?")) return;
      setExecutionData(prev => ({
          ...prev,
          [target === 'antes' ? 'fotoantes' : 'fotodepois']: prev[target === 'antes' ? 'fotoantes' : 'fotodepois'].filter((_, i) => i !== index)
      }));
  };

  const handleSubmitRating = async () => {
      if (!selectedOrder || !ratingScore) return;
      // Segurança extra: verificar se quem avalia é o cliente
      if (currentUserId !== selectedOrder.cliente) return alert("Apenas o cliente pode avaliar este serviço.");
      
      setSubmittingRating(true);
      try {
          const rawPro = selectedOrder.profissional;
          const proUuid = typeof rawPro === 'string' ? rawPro : (rawPro as any)?.uuid;
          const { error } = await supabase.from('avaliacoes').insert({
              chave: selectedOrder.id,
              profissional: proUuid,
              cliente: currentUserId,
              nota: ratingScore,
              comentario: ratingComment
          });
          if (error) throw error;
          alert("Avaliação enviada!");
          await fetchOrders();
          setIsModalOpen(false);
      } catch (e: any) { alert(e.message); } finally { setSubmittingRating(false); }
  };

  const getStatusColor = (s: string) => {
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

  const isConcluded = selectedOrder?.status?.toLowerCase() === 'concluido';
  const isTicketOwner = currentUserId === selectedOrder?.cliente;

  return (
    <div className="min-h-screen bg-ios-bg pb-20">
      <div className="bg-white/80 backdrop-blur-md px-5 pt-12 pb-4 sticky top-0 z-20 border-b border-gray-200 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Meus Pedidos</h1>
        {canCreateOrder && (
            <button onClick={() => navigate('/search')} className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all"><Plus size={16} /><span>Novo Pedido</span></button>
        )}
      </div>

      <div className="p-5 space-y-6 max-w-4xl mx-auto">
        {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ios-blue"/></div> : orders.length === 0 ? <div className="text-center py-20 bg-white rounded-3xl border-dashed border-2 border-gray-100 text-gray-400 font-bold">Nenhum pedido encontrado.</div> : (
          orders.map(order => (
            <div key={order.id} onClick={() => handleOpenDetails(order)} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 transition-all cursor-pointer hover:shadow-md active:scale-[0.98] relative overflow-hidden group">
              <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl text-[10px] font-black uppercase tracking-wider border-l border-b transition-colors ${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</div>
              <div className="flex items-center space-x-4 mt-2 mb-4">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl overflow-hidden shadow-inner flex-shrink-0">{order.geral?.imagem ? <img src={order.geral.imagem} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-gray-300"><Calendar size={24}/></div>}</div>
                  <div className="min-w-0 flex-1"><h3 className="font-bold text-gray-900 text-lg leading-tight truncate group-hover:text-ios-blue transition-colors">{order.geral?.nome}</h3><p className="text-[10px] font-mono font-black text-gray-400 uppercase mt-0.5 tracking-widest">ID: {order.chaveunica}</p></div>
              </div>
              <div className="flex justify-between items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                  <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-white border border-gray-200 overflow-hidden"><img src={order.profissional?.fotoperfil || `https://ui-avatars.com/api/?name=${order.profissional?.nome || 'U'}`} className="w-full h-full object-cover"/></div>
                      <div className="min-w-0"><p className="text-[9px] font-black text-gray-400 uppercase leading-none mb-1">{currentUserId === order.cliente ? 'Profissional' : 'Cliente'}</p><p className="text-xs font-bold text-gray-900 truncate">{order.profissional?.nome || 'Não definido'}</p></div>
                  </div>
                  {currentUserId === order.cliente && (
                      <div className="text-right">{order.orcamentos?.length > 0 ? <span className="text-base font-black text-gray-900">R$ {order.orcamentos[0].preco.toFixed(2)}</span> : <span className="text-[10px] font-black text-gray-400 uppercase">Aguardando Orçamento</span>}</div>
                  )}
              </div>
              {/* REGRA: Selo "Decidir Agora" aparece apenas para o CLIENTE do pedido */}
              {order.status === 'aguardando_aprovacao' && currentUserId === order.cliente && (
                  <div className="mt-4 pt-3 border-t border-orange-100 flex items-center justify-between">
                      <p className="text-[10px] font-black text-orange-600 uppercase flex items-center gap-1"><AlertCircle size={12}/> Orçamento pronto!</p>
                      <div className="bg-orange-500 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg animate-pulse">Decidir Agora</div>
                  </div>
              )}
            </div>
          ))
        )}
      </div>

      {isModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div><h3 className="font-bold text-gray-900 text-lg leading-tight">{selectedOrder.geral?.nome}</h3><p className="text-xs font-mono font-black text-gray-400 uppercase tracking-wider">#{selectedOrder.chaveunica}</p></div>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 transition-colors"><X size={20} /></button>
                </div>

                <div className="flex border-b border-gray-100 bg-white overflow-x-auto no-scrollbar">
                    <button onClick={() => setActiveTab('geral')} className={`flex-1 min-w-[100px] py-4 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'geral' ? 'text-ios-blue' : 'text-gray-400'}`}>Informações{activeTab === 'geral' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}</button>
                    {(isProfessional || isManager) && (<><button onClick={() => setActiveTab('fotos')} className={`flex-1 min-w-[100px] py-4 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'fotos' ? 'text-ios-blue' : 'text-gray-400'}`}>Fotos{activeTab === 'fotos' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}</button><button onClick={() => setActiveTab('obs')} className={`flex-1 min-w-[100px] py-4 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'obs' ? 'text-ios-blue' : 'text-gray-400'}`}>Anotações{activeTab === 'obs' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}</button></>)}
                    {(selectedOrder.status === 'concluido' && (isTicketOwner || isProfessional)) && (<button onClick={() => setActiveTab('avaliacao')} className={`flex-1 min-w-[100px] py-4 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'avaliacao' ? 'text-ios-blue' : 'text-gray-400'}`}>Avaliação{activeTab === 'avaliacao' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}</button>)}
                </div>

                <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white no-scrollbar">
                    {activeTab === 'geral' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                             <div className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 shadow-inner">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-4 block">Status Atual</label>
                                {isProfessional ? (
                                    <div className="space-y-4">
                                        <select 
                                            disabled={isConcluded || processingAction}
                                            className="w-full bg-white border border-gray-200 rounded-xl p-4 text-sm font-black text-gray-900 outline-none disabled:opacity-50 appearance-none shadow-sm"
                                            value={executionData.status}
                                            onChange={(e) => setExecutionData({...executionData, status: e.target.value})}
                                        >
                                            <option value="pendente">Pendente</option>
                                            <option value="aprovado">Aprovado</option>
                                            <option value="executando">Executando</option>
                                            <option value="concluido">Concluído</option>
                                            <option value="cancelado">Cancelado</option>
                                        </select>
                                        {isConcluded && <p className="text-[9px] font-bold text-gray-400 uppercase text-center flex items-center justify-center gap-1"><Lock size={10}/> Status travado (Concluído)</p>}
                                    </div>
                                ) : (
                                    <div className={`inline-flex px-5 py-2 rounded-xl text-xs font-black border uppercase mb-6 ${getStatusColor(selectedOrder.status)}`}>{getStatusLabel(selectedOrder.status)}</div>
                                )}
                                
                                <div className={`grid ${isProfessional ? 'grid-cols-1' : 'grid-cols-2'} gap-6 mt-6`}>
                                    <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Data Sugerida</p><p className="text-sm font-bold text-gray-900">{selectedOrder.planejamento?.[0]?.execucao ? new Date(selectedOrder.planejamento[0].execucao).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}) : 'Não definida'}</p></div>
                                    {!isProfessional && (
                                        <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Valor Total</p><p className="text-sm font-black text-gray-900">{selectedOrder.orcamentos?.[0]?.preco ? `R$ ${selectedOrder.orcamentos[0].preco.toFixed(2)}` : 'Calculando...'}</p></div>
                                    )}
                                </div>

                                {/* REGRA: Botões de aprovação de orçamento aparecem apenas para o CLIENTE */}
                                {selectedOrder.status === 'aguardando_aprovacao' && currentUserId === selectedOrder.cliente && (
                                    <div className="mt-8 p-6 bg-white rounded-3xl border border-orange-100 space-y-5 shadow-sm animate-in slide-in-from-bottom-4">
                                        <div className="flex items-center gap-3 text-orange-700"><AlertCircle size={20} className="flex-shrink-0"/><p className="text-xs font-bold leading-tight">Deseja aprovar este valor para agendar o serviço?</p></div>
                                        <div className="flex flex-col gap-2">
                                            <button onClick={() => handleProposalDecision(selectedOrder.id, true)} disabled={processingAction} className="w-full bg-black text-white py-4 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">{processingAction ? <Loader2 className="animate-spin" size={18}/> : <><ThumbsUp size={18}/><span>Aprovar Orçamento</span></>}</button>
                                            <button onClick={() => handleProposalDecision(selectedOrder.id, false)} disabled={processingAction} className="w-full bg-white border border-red-100 text-red-500 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"><ThumbsDown size={14}/><span>Recusar Proposta</span></button>
                                        </div>
                                    </div>
                                )}

                                {/* REGRA: O Profissional decide sobre o serviço apenas APÓS a aprovação do orçamento pelo cliente */}
                                {selectedOrder.status === 'aguardando_profissional' && isProfessional && (
                                    <div className="mt-6 p-6 bg-cyan-50 rounded-[2.5rem] border border-cyan-100 space-y-5 shadow-sm animate-in zoom-in duration-300">
                                        <div className="flex items-center gap-3 text-cyan-800">
                                            <AlertCircle size={20} className="flex-shrink-0"/>
                                            <p className="text-sm font-black leading-tight">O CLIENTE APROVOU!<br/><span className="font-medium opacity-80 uppercase text-[10px]">Confirme os dados abaixo para aceitar o serviço.</span></p>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 gap-3">
                                            <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-cyan-100 shadow-sm flex items-center space-x-3">
                                                <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center"><Banknote size={24}/></div>
                                                <div>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase">Valor a Receber</p>
                                                    <p className="text-lg font-black text-gray-900">R$ {selectedOrder.orcamentos?.[0]?.preco.toFixed(2) || '0.00'}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-cyan-100 shadow-sm space-y-2">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center flex-shrink-0"><MapPin size={24}/></div>
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-black text-gray-400 uppercase">Local do Serviço</p>
                                                        <p className="text-xs font-bold text-gray-900 truncate">
                                                            {selectedOrder.profissional?.rua}, {selectedOrder.profissional?.numero}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="pl-[52px] border-t border-cyan-50/50 pt-2">
                                                    <p className="text-[10px] text-gray-500 font-medium">{selectedOrder.profissional?.bairro} • {selectedOrder.profissional?.complemento || 'Sem compl.'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            <button onClick={() => handleProfessionalDecision(selectedOrder, true)} disabled={processingAction} className="flex-[2] bg-black text-white py-4 rounded-2xl font-black text-xs shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">{processingAction ? <Loader2 className="animate-spin" size={18}/> : <><Check size={16}/> ACEITAR SERVIÇO</>}</button>
                                            <button onClick={() => handleProfessionalDecision(selectedOrder, false)} disabled={processingAction} className="flex-1 bg-white border border-red-100 text-red-500 py-4 rounded-2xl font-black text-xs active:scale-95 transition-all flex items-center justify-center gap-2"><Ban size={16}/> RECUSAR</button>
                                        </div>
                                    </div>
                                )}
                             </div>
                        </div>
                    )}

                    {activeTab === 'fotos' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">Fotos do 'Antes'</h4>
                                <div className="grid grid-cols-3 gap-2">
                                    {executionData.fotoantes.map((url, i) => (
                                        <div key={i} className="aspect-square bg-gray-100 rounded-2xl overflow-hidden relative group">
                                            <img src={url} className="w-full h-full object-cover"/>
                                            {isProfessional && !isConcluded && <button onClick={() => handleDeleteImage(i, 'antes')} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full"><Trash2 size={12}/></button>}
                                        </div>
                                    ))}
                                    {isProfessional && !isConcluded && (
                                        <label className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors">
                                            {uploading ? <Loader2 className="animate-spin text-ios-blue"/> : <Camera size={20} className="text-gray-300"/>}
                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'antes')} />
                                        </label>
                                    )}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">Fotos da Conclusão</h4>
                                <div className="grid grid-cols-3 gap-2">
                                    {executionData.fotodepois.map((url, i) => (
                                        <div key={i} className="aspect-square bg-gray-100 rounded-2xl overflow-hidden relative group">
                                            <img src={url} className="w-full h-full object-cover"/>
                                            {isProfessional && !isConcluded && <button onClick={() => handleDeleteImage(i, 'depois')} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full"><Trash2 size={12}/></button>}
                                        </div>
                                    ))}
                                    {isProfessional && !isConcluded && (
                                        <label className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors">
                                            {uploading ? <Loader2 className="animate-spin text-ios-blue"/> : <Camera size={20} className="text-gray-300"/>}
                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'depois')} />
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'obs' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Notas e Observações</label>
                            {isProfessional ? (
                                <textarea 
                                    disabled={isConcluded || processingAction}
                                    className="w-full bg-yellow-50 border border-yellow-100 rounded-2xl p-5 text-sm font-bold text-gray-900 min-h-[150px] leading-relaxed outline-none focus:ring-2 focus:ring-yellow-200 disabled:opacity-70"
                                    value={executionData.observacoes}
                                    onChange={(e) => setExecutionData({...executionData, observacoes: e.target.value})}
                                    placeholder="Suas anotações sobre o serviço..."
                                />
                            ) : (
                                <div className="w-full bg-yellow-50 border border-yellow-100 rounded-2xl p-5 text-sm font-bold text-gray-900 min-h-[150px] leading-relaxed">{executionData.observacoes || "Nenhuma anotação registrada."}</div>
                            )}
                        </div>
                    )}

                    {activeTab === 'avaliacao' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {isTicketOwner && !selectedOrder.avaliacao && (
                                <div className="text-center space-y-2 mt-4">
                                    <h4 className="text-xl font-black text-gray-900">Como foi o serviço?</h4>
                                    <p className="text-xs text-gray-500 font-medium">Sua avaliação ajuda a manter a qualidade.</p>
                                </div>
                            )}
                            
                            {isTicketOwner && !selectedOrder.avaliacao ? (
                                <div className="space-y-8">
                                    <div className="flex justify-center space-x-3">{[1, 2, 3, 4, 5].map((star) => (<button key={star} type="button" onClick={() => setRatingScore(star)} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)} className="transition-all active:scale-90"><Star size={44} className={`${(hoverRating || ratingScore) >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`}/></button>))}</div>
                                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.1em] ml-1">Comentário Adicional</label><textarea value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} placeholder="Descreva sua experiência..." className="w-full bg-gray-50 border border-gray-200 rounded-[1.5rem] p-5 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30 min-h-[120px] resize-none"/></div>
                                    <button onClick={handleSubmitRating} disabled={submittingRating || !ratingScore} className="w-full bg-black text-white py-4 rounded-2xl font-bold shadow-xl flex items-center justify-center space-x-2 disabled:opacity-50">{submittingRating ? <Loader2 className="animate-spin" size={20}/> : <><Send size={18}/><span>Enviar Avaliação</span></>}</button>
                                </div>
                            ) : selectedOrder.avaliacao ? (
                                <div className="bg-green-50 p-8 rounded-[2.5rem] border border-green-100 text-center space-y-4">
                                    <div className="flex justify-center items-center gap-2 mb-2">
                                        <div className="bg-white p-2 rounded-full shadow-sm"><UserCheck size={20} className="text-green-600"/></div>
                                        <h5 className="font-black text-green-900 text-sm uppercase tracking-wider">Serviço Avaliado</h5>
                                    </div>
                                    <div className="flex justify-center space-x-1">
                                        {[1, 2, 3, 4, 5].map((star) => (<Star key={star} size={28} className={star <= (selectedOrder.avaliacao?.nota || 0) ? 'fill-green-500 text-green-500' : 'text-green-200'} />))}
                                    </div>
                                    <p className="text-base font-bold text-green-800 leading-relaxed italic mt-4">"{selectedOrder.avaliacao?.comentario}"</p>
                                    {isProfessional && (
                                        <div className="mt-4 pt-4 border-t border-green-100/50">
                                            <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Feedback do Cliente</p>
                                        </div>
                                    )}
                                </div>
                            ) : isProfessional ? (
                                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                                    <div className="bg-gray-100 p-6 rounded-full text-gray-400">
                                        <Clock size={48} />
                                    </div>
                                    <div className="text-center">
                                        <h4 className="text-lg font-black text-gray-900">Aguardando Avaliação</h4>
                                        <p className="text-sm text-gray-500 max-w-[200px] mx-auto mt-1">O cliente ainda não enviou o feedback sobre este serviço.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-10 text-gray-400 font-bold">Apenas o cliente pode avaliar este pedido.</div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 mt-auto flex gap-3">
                    <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-white border border-gray-200 text-gray-900 py-4 rounded-2xl font-bold shadow-sm active:scale-95 transition-all">Fechar</button>
                    {isProfessional && !isConcluded && (
                        <button 
                            onClick={handleSaveProfessionalEdits} 
                            disabled={processingAction} 
                            className="flex-[2] bg-black text-white py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex justify-center items-center gap-2"
                        >
                            {processingAction ? <Loader2 className="animate-spin" size={20}/> : <><Save size={18}/><span>Salvar Alterações</span></>}
                        </button>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ClientOrders;
