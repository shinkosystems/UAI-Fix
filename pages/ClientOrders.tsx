
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { User, Geral, Chave, Orcamento, Planejamento, Avaliacao, Agenda, OrdemServico } from '../types';
import { 
    Loader2, X, Star, Calendar, Clock, ChevronRight, Send, Plus, Check, Ban, 
    AlertCircle, Camera, Save, Trash2, ThumbsUp, ThumbsDown, Lock, Banknote, 
    MapPin, UserCheck, Play, CreditCard, Smartphone, MessageSquare 
} from 'lucide-react';
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

  const isMediaVideo = (url: string) => {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.mov', '.webm', '.quicktime'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext)) || url.toLowerCase().includes('video');
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

  const handleOpenDetails = (order: OrderExtended) => {
    setSelectedOrder(order);
    const os = order.ordemServico?.[0];
    const ag = order.agenda?.[0];
    setExecutionData({
        status: order.status || 'pendente',
        datainicio: os?.datainicio || ag?.execucao || '',
        datafim: os?.datafim || '',
        observacoes: ag?.observacoes || '',
        fotoantes: order.fotoantes || [],
        fotodepois: order.fotodepois || [],
    });
    
    setRatingScore(order.avaliacao?.nota || 0);
    setRatingComment(order.avaliacao?.comentario || '');
    
    if (order.status === 'concluido' && !order.avaliacao) {
        setActiveTab('avaliacao');
    } else {
        setActiveTab('geral');
    }
    
    setIsModalOpen(true);
  };

  const handleProposalDecision = async (orderId: number, approved: boolean) => {
      if (!selectedOrder || processingAction) return;
      
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

  const handleSubmitRating = async () => {
      if (!selectedOrder || !ratingScore) return;
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

  return (
    <div className="min-h-screen bg-ios-bg pb-20">
      <div className="bg-white/80 backdrop-blur-md px-5 pt-12 pb-4 sticky top-0 z-20 border-b border-gray-200 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Meus Pedidos</h1>
        <button onClick={() => navigate('/search')} className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all"><Plus size={16} /><span>Novo Pedido</span></button>
      </div>

      <div className="p-5 space-y-6 max-w-4xl mx-auto">
        {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ios-blue"/></div> : orders.length === 0 ? <div className="text-center py-20 bg-white rounded-3xl border-dashed border-2 border-gray-100 text-gray-400 font-bold">Nenhum pedido pessoal encontrado.</div> : (
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
                      <div className="min-w-0"><p className="text-[9px] font-black text-gray-400 uppercase leading-none mb-1">Profissional</p><p className="text-xs font-bold text-gray-900 truncate">{order.profissional?.nome || 'Não definido'}</p></div>
                  </div>
                  <div className="text-right">{order.orcamentos?.length > 0 ? <span className="text-base font-black text-gray-900">R$ {order.orcamentos[0].preco.toFixed(2)}</span> : <span className="text-[10px] font-black text-gray-400 uppercase">Aguardando Orçamento</span>}</div>
              </div>
              {order.status === 'aguardando_aprovacao' && (
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

                <div className="flex border-b border-gray-100 bg-white overflow-x-auto no-scrollbar h-14 shrink-0">
                    <button onClick={() => setActiveTab('geral')} className={`flex-1 min-w-[100px] h-full flex flex-col items-center justify-center transition-all relative group`}>
                      <span className={`text-xs font-black uppercase tracking-widest leading-none ${activeTab === 'geral' ? 'text-ios-blue' : 'text-gray-400'}`}>Informações</span>
                      {activeTab === 'geral' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}
                    </button>
                    <button onClick={() => setActiveTab('fotos')} className={`flex-1 min-w-[100px] h-full flex flex-col items-center justify-center transition-all relative group`}>
                      <span className={`text-xs font-black uppercase tracking-widest leading-none ${activeTab === 'fotos' ? 'text-ios-blue' : 'text-gray-400'}`}>Mídia</span>
                      {activeTab === 'fotos' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}
                    </button>
                    <button onClick={() => setActiveTab('obs')} className={`flex-1 min-w-[100px] h-full flex flex-col items-center justify-center transition-all relative group`}>
                      <span className={`text-xs font-black uppercase tracking-widest leading-none ${activeTab === 'obs' ? 'text-ios-blue' : 'text-gray-400'}`}>Notas</span>
                      {activeTab === 'obs' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}
                    </button>
                    {selectedOrder.status === 'concluido' && (
                      <button onClick={() => setActiveTab('avaliacao')} className={`flex-1 min-w-[100px] h-full flex flex-col items-center justify-center transition-all relative group`}>
                        <span className={`text-xs font-black uppercase tracking-widest leading-none ${activeTab === 'avaliacao' ? 'text-ios-blue' : 'text-gray-400'}`}>Avaliação</span>
                        {activeTab === 'avaliacao' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}
                      </button>
                    )}
                </div>

                <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white no-scrollbar">
                    {activeTab === 'geral' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                             <div className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 shadow-inner">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-4 block">Status do Pedido</label>
                                <div className={`inline-flex px-5 py-2 rounded-xl text-xs font-black border uppercase mb-6 ${getStatusColor(selectedOrder.status)}`}>{getStatusLabel(selectedOrder.status)}</div>
                                
                                <div className="grid grid-cols-1 gap-6 mt-6">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-blue-50 rounded-2xl text-ios-blue shadow-sm border border-blue-100">
                                            <Calendar size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Visita Técnica</p>
                                            <p className="text-sm font-bold text-gray-900">
                                                {selectedOrder.planejamento?.[0]?.visita 
                                                    ? new Date(selectedOrder.planejamento[0].visita).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}) 
                                                    : 'Não agendada'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-purple-50 rounded-2xl text-purple-600 shadow-sm border border-purple-100">
                                            <Clock size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Execução Prevista</p>
                                            <p className="text-sm font-bold text-gray-900">
                                                {selectedOrder.planejamento?.[0]?.execucao 
                                                    ? new Date(selectedOrder.planejamento[0].execucao).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}) 
                                                    : 'A definir'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4 pt-4 border-t border-gray-100">
                                        <div className="p-3 bg-green-50 rounded-2xl text-green-600 shadow-sm border border-green-100">
                                            <Banknote size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Valor Total</p>
                                            <p className="text-base font-black text-gray-900">
                                                {selectedOrder.orcamentos?.[0]?.preco ? `R$ ${selectedOrder.orcamentos[0].preco.toFixed(2)}` : 'Calculando...'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {selectedOrder.orcamentos?.[0] && (
                                    <div className="mt-6 pt-6 border-t border-gray-200 animate-in fade-in duration-500">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Banknote size={12}/> Forma de Pagamento Proposta</p>
                                        <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-50 rounded-lg text-ios-blue">
                                                    {selectedOrder.orcamentos[0].tipopagmto === 'PIX' || selectedOrder.orcamentos[0].tipopagmto === 'Dinheiro' ? <Smartphone size={18}/> : <CreditCard size={18}/>}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-gray-900">{selectedOrder.orcamentos[0].tipopagmto}</p>
                                                    {selectedOrder.orcamentos[0].tipopagmto === 'Cartão de Crédito' && (
                                                        <p className="text-[10px] font-bold text-gray-500">Parcelamento em até {selectedOrder.orcamentos[0].parcelas}x</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {selectedOrder.orcamentos[0].observacaocliente && (
                                            <div className="mt-4 p-5 bg-blue-600 rounded-3xl text-white shadow-xl relative animate-in slide-in-from-left-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <MessageSquare size={14} className="text-blue-100" />
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Mensagem do Orçamentista</p>
                                                </div>
                                                <p className="text-sm font-medium leading-relaxed italic">
                                                    "{selectedOrder.orcamentos[0].observacaocliente}"
                                                </p>
                                                <div className="absolute -top-2 left-8 w-4 h-4 bg-blue-600 rotate-45"></div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {selectedOrder.status === 'aguardando_aprovacao' && (
                                    <div className="mt-8 p-6 bg-white rounded-3xl border border-orange-100 space-y-5 shadow-sm animate-in slide-in-from-bottom-4">
                                        <div className="flex items-center gap-3 text-orange-700"><AlertCircle size={20} className="flex-shrink-0"/><p className="text-xs font-bold leading-tight">Deseja aprovar este valor para agendar o serviço?</p></div>
                                        <div className="flex flex-col gap-2">
                                            <button onClick={() => handleProposalDecision(selectedOrder.id, true)} disabled={processingAction} className="w-full bg-black text-white py-4 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">{processingAction ? <Loader2 className="animate-spin" size={18}/> : <><ThumbsUp size={18}/><span>Aprovar Orçamento</span></>}</button>
                                            <button onClick={() => handleProposalDecision(selectedOrder.id, false)} disabled={processingAction} className="w-full bg-white border border-red-100 text-red-500 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"><ThumbsDown size={14}/><span>Recusar Proposta</span></button>
                                        </div>
                                    </div>
                                )}
                             </div>
                        </div>
                    )}

                    {activeTab === 'fotos' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">Antes (Fotos/Vídeos)</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {executionData.fotoantes.length > 0 ? executionData.fotoantes.map((url, i) => (
                                        <div key={i} className="aspect-video bg-gray-100 rounded-2xl overflow-hidden relative group border border-gray-200">
                                            {isMediaVideo(url) ? (
                                                <video src={url} className="w-full h-full object-cover" controls playsInline />
                                            ) : (
                                                <img src={url} className="w-full h-full object-cover"/>
                                            )}
                                        </div>
                                    )) : <div className="col-span-2 py-6 text-center text-gray-300 text-[10px] font-black uppercase tracking-widest">Nenhuma mídia registrada.</div>}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">Conclusão (Fotos/Vídeos)</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {executionData.fotodepois.length > 0 ? executionData.fotodepois.map((url, i) => (
                                        <div key={i} className="aspect-video bg-gray-100 rounded-2xl overflow-hidden relative group border border-gray-200">
                                            {isMediaVideo(url) ? (
                                                <video src={url} className="w-full h-full object-cover" controls playsInline />
                                            ) : (
                                                <img src={url} className="w-full h-full object-cover"/>
                                            )}
                                        </div>
                                    )) : <div className="col-span-2 py-6 text-center text-gray-300 text-[10px] font-black uppercase tracking-widest">Nenhuma mídia registrada.</div>}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'obs' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Notas do Serviço</label>
                            <div className="w-full bg-yellow-50 border border-yellow-100 rounded-2xl p-5 text-sm font-bold text-gray-900 min-h-[150px] leading-relaxed">
                                {executionData.observacoes || "Nenhuma anotação registrada pelo profissional."}
                            </div>
                        </div>
                    )}

                    {activeTab === 'avaliacao' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {!selectedOrder.avaliacao ? (
                                <div className="space-y-8">
                                    <div className="text-center space-y-2 mt-4">
                                        <h4 className="text-xl font-black text-gray-900">Como foi o serviço?</h4>
                                        <p className="text-xs text-gray-500 font-medium">Sua avaliação ajuda a manter a qualidade.</p>
                                    </div>
                                    <div className="flex justify-center space-x-3">{[1, 2, 3, 4, 5].map((star) => (<button key={star} type="button" onClick={() => setRatingScore(star)} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)} className="transition-all active:scale-90"><Star size={44} className={`${(hoverRating || ratingScore) >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`}/></button>))}</div>
                                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.1em] ml-1">Comentário Adicional</label><textarea value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} placeholder="Descreva sua experiência..." className="w-full bg-gray-50 border border-gray-200 rounded-[1.5rem] p-5 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30 min-h-[120px] resize-none"/></div>
                                    <button onClick={handleSubmitRating} disabled={submittingRating || !ratingScore} className="w-full bg-black text-white py-4 rounded-2xl font-bold shadow-xl flex items-center justify-center space-x-2 disabled:opacity-50">{submittingRating ? <Loader2 className="animate-spin" size={20}/> : <><Send size={18}/><span>Enviar Avaliação</span></>}</button>
                                </div>
                            ) : (
                                <div className="bg-green-50 p-8 rounded-[2.5rem] border border-green-100 text-center space-y-4">
                                    <div className="flex justify-center items-center gap-2 mb-2">
                                        <div className="bg-white p-2 rounded-full shadow-sm"><UserCheck size={20} className="text-green-600"/></div>
                                        <h5 className="font-black text-green-900 text-sm uppercase tracking-wider">Serviço Avaliado</h5>
                                    </div>
                                    <div className="flex justify-center space-x-1">
                                        {[1, 2, 3, 4, 5].map((star) => (<Star key={star} size={28} className={star <= (selectedOrder.avaliacao?.nota || 0) ? 'fill-green-500 text-green-500' : 'text-green-200'} />))}
                                    </div>
                                    <p className="text-base font-bold text-green-800 leading-relaxed italic mt-4">"{selectedOrder.avaliacao?.comentario}"</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 mt-auto">
                    <button onClick={() => setIsModalOpen(false)} className="w-full bg-white border border-gray-200 text-gray-900 py-4 rounded-2xl font-bold shadow-sm active:scale-95 transition-all">Fechar</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ClientOrders;
