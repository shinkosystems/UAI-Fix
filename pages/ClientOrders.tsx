
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { User, Geral, Chave, Orcamento, Planejamento, Avaliacao, Agenda, OrdemServico } from '../types';
import { Loader2, X, Star, Calendar, Clock, ChevronRight, Send, Plus } from 'lucide-react';
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

  const normalizedUserType = userType.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const isConsumer = normalizedUserType === 'consumidor';
  const isManager = normalizedUserType === 'gestor';
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
    if (normRole === 'profissional') query = query.eq('profissional', uuid); else query = query.eq('cliente', uuid);

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
    
    setOrders(chavesData.map(c => ({
        ...c,
        geral: sMap[c.atividade],
        profissional: uMap[normRole === 'profissional' ? c.cliente : c.profissional],
        orcamentos: budgets.data?.filter(b => b.chave === c.id) || [],
        planejamento: plans.data?.filter(p => p.chave === c.id) || [],
        avaliacao: reviews.data?.find(r => r.chave === c.id),
        agenda: agenda.data?.filter(a => a.chave === c.id) || [],
        ordemServico: os.data?.filter(o => o.chave === c.id) || []
    })));
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
    
    // Se o pedido está concluído e sou o cliente sem avaliação, vai direto pra aba avaliação
    if (order.status === 'concluido' && isConsumer && !order.avaliacao) {
        setActiveTab('avaliacao');
    } else {
        setActiveTab('geral');
    }
    
    setIsModalOpen(true);
  };

  const handleSubmitRating = async () => {
      if (!selectedOrder || !ratingScore) return;
      setSubmittingRating(true);
      try {
          const { error } = await supabase.from('avaliacoes').insert({
              chave: selectedOrder.id,
              profissional: selectedOrder.profissional?.uuid,
              cliente: currentUserId,
              nota: ratingScore,
              comentario: ratingComment
          });
          if (error) throw error;
          alert("Avaliação enviada com sucesso! Obrigado pelo feedback.");
          await loadData(currentUserId, userType);
          setIsModalOpen(false);
      } catch (e: any) { alert(e.message); } finally { setSubmittingRating(false); }
  };

  const getStatusColor = (s: string) => {
    switch (s?.toLowerCase()) {
      case 'concluido': return 'bg-green-100 text-green-900 border-green-200';
      case 'executando': return 'bg-purple-100 text-purple-900 border-purple-200';
      case 'cancelado': return 'bg-red-100 text-red-900 border-red-200';
      default: return 'bg-blue-100 text-blue-900 border-blue-200';
    }
  };

  return (
    <div className="min-h-screen bg-ios-bg pb-20">
      <div className="bg-white/80 backdrop-blur-md px-5 pt-12 pb-4 sticky top-0 z-20 border-b border-gray-200 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Meus Pedidos</h1>
        {canCreateOrder && (
            <button 
                onClick={() => navigate('/search')}
                className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-gray-200 active:scale-95 transition-all"
            >
                <Plus size={16} />
                <span>Novo Pedido</span>
            </button>
        )}
      </div>

      <div className="p-5 space-y-6 max-w-4xl mx-auto">
        {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ios-blue"/></div> : orders.length === 0 ? <div className="text-center py-20 bg-white rounded-3xl border-dashed border-2 border-gray-100 text-gray-400 font-bold">Nenhum pedido encontrado.</div> : (
          orders.map(order => (
            <div key={order.id} onClick={() => handleOpenDetails(order)} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 transition-all cursor-pointer hover:shadow-md active:scale-[0.98]">
              <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-3"><div className="w-10 h-10 bg-gray-100 rounded-xl overflow-hidden shadow-inner">{order.geral?.imagem && <img src={order.geral.imagem} className="w-full h-full object-cover"/>}</div><div><h3 className="font-bold text-gray-900 leading-tight">{order.geral?.nome}</h3><p className="text-[10px] font-mono font-black text-gray-400 uppercase">#{order.chaveunica}</p></div></div>
                  <span className={`px-3 py-1 text-[10px] font-bold rounded-full border uppercase ${getStatusColor(order.status)}`}>{order.status}</span>
              </div>
              <div className="flex justify-between items-end mt-4">
                  <div className="flex items-center space-x-2"><img src={order.profissional?.fotoperfil || `https://ui-avatars.com/api/?name=${order.profissional?.nome}`} className="w-6 h-6 rounded-full border border-gray-100"/><span className="text-xs font-bold text-gray-900">{order.profissional?.nome}</span></div>
                  {order.orcamentos?.length > 0 && <span className="text-lg font-black text-gray-900">R$ {order.orcamentos[0].preco.toFixed(2)}</span>}
              </div>
              {order.status === 'concluido' && isConsumer && !order.avaliacao && (
                  <div className="mt-4 pt-3 border-t border-yellow-100 flex items-center text-yellow-600 justify-between">
                      <div className="flex items-center space-x-2">
                        <Star size={14} className="fill-yellow-600 animate-pulse"/>
                        <span className="text-xs font-black uppercase">Avaliação Pendente</span>
                      </div>
                      <div className="bg-yellow-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase shadow-sm">Avaliar Agora</div>
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
                    <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-900 transition-colors"><X size={20} /></button>
                </div>

                {/* Tabs Row - Custom Design for iOS Feel */}
                <div className="flex border-b border-gray-100 bg-white">
                    <button 
                        onClick={() => setActiveTab('geral')} 
                        className={`flex-1 py-4 text-sm font-bold transition-all relative ${activeTab === 'geral' ? 'text-ios-blue' : 'text-gray-400'}`}
                    >
                        Informações
                        {activeTab === 'geral' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}
                    </button>
                    
                    {!isConsumer && (
                        <>
                            <button 
                                onClick={() => setActiveTab('fotos')} 
                                className={`flex-1 py-4 text-sm font-bold transition-all relative ${activeTab === 'fotos' ? 'text-ios-blue' : 'text-gray-400'}`}
                            >
                                Fotos
                                {activeTab === 'fotos' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}
                            </button>
                            <button 
                                onClick={() => setActiveTab('obs')} 
                                className={`flex-1 py-4 text-sm font-bold transition-all relative ${activeTab === 'obs' ? 'text-ios-blue' : 'text-gray-400'}`}
                            >
                                Anotações
                                {activeTab === 'obs' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}
                            </button>
                        </>
                    )}
                    
                    {selectedOrder.status === 'concluido' && (
                        <button 
                            onClick={() => setActiveTab('avaliacao')} 
                            className={`flex-1 py-4 text-sm font-bold transition-all relative ${activeTab === 'avaliacao' ? 'text-ios-blue' : 'text-gray-400'}`}
                        >
                            Avaliação
                            {activeTab === 'avaliacao' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}
                        </button>
                    )}
                </div>

                <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white no-scrollbar">
                    {activeTab === 'geral' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                             <div className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-4 block">Status do Serviço</label>
                                <div className={`inline-flex px-5 py-2 rounded-xl text-xs font-black border uppercase mb-6 ${getStatusColor(selectedOrder.status)}`}>{selectedOrder.status}</div>
                                
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Início</p>
                                        <p className="text-sm font-bold text-gray-900">
                                            {selectedOrder.ordemServico?.[0]?.datainicio ? new Date(selectedOrder.ordemServico[0].datainicio).toLocaleString('pt-BR') : 'Aguardando'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Fim / Conclusão</p>
                                        <p className="text-sm font-bold text-gray-900">
                                            {selectedOrder.ordemServico?.[0]?.datafim ? new Date(selectedOrder.ordemServico[0].datafim).toLocaleString('pt-BR') : 'Em andamento'}
                                        </p>
                                    </div>
                                </div>
                             </div>

                             <div className="bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100">
                                 <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-[0.15em] mb-4">Profissional Atribuído</h4>
                                 <div className="flex items-center space-x-4">
                                     <div className="w-14 h-14 rounded-full border-2 border-white shadow-sm overflow-hidden bg-gray-200">
                                         <img src={selectedOrder.profissional?.fotoperfil || `https://ui-avatars.com/api/?name=${selectedOrder.profissional?.nome}`} className="w-full h-full object-cover"/>
                                     </div>
                                     <div>
                                         <p className="text-base font-black text-blue-900 leading-tight">{selectedOrder.profissional?.nome}</p>
                                         <p className="text-xs text-blue-700 font-bold mt-0.5">Contatado via UAI Fix</p>
                                     </div>
                                 </div>
                             </div>
                        </div>
                    )}

                    {activeTab === 'fotos' && !isConsumer && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">Fotos do 'Antes' (Profissional)</h4>
                                <div className="grid grid-cols-3 gap-2">
                                    {executionData.fotoantes.length > 0 ? executionData.fotoantes.map((url, i) => (
                                        <div key={i} className="aspect-square bg-gray-100 rounded-2xl overflow-hidden shadow-sm border border-gray-100"><img src={url} className="w-full h-full object-cover"/></div>
                                    )) : <div className="col-span-3 py-10 text-center text-gray-300 text-xs italic bg-gray-50 rounded-2xl border border-dashed">Nenhuma foto enviada.</div>}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">Fotos da Conclusão</h4>
                                <div className="grid grid-cols-3 gap-2">
                                    {executionData.fotodepois.length > 0 ? executionData.fotodepois.map((url, i) => (
                                        <div key={i} className="aspect-square bg-gray-100 rounded-2xl overflow-hidden shadow-sm border border-gray-100"><img src={url} className="w-full h-full object-cover"/></div>
                                    )) : <div className="col-span-3 py-10 text-center text-gray-300 text-xs italic bg-gray-50 rounded-2xl border border-dashed">Aguardando registro do profissional.</div>}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'obs' && !isConsumer && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Notas e Observações</label>
                            <div className="w-full bg-yellow-50 border border-yellow-100 rounded-2xl p-5 text-sm font-bold text-gray-900 min-h-[150px] leading-relaxed">
                                {executionData.observacoes || "O profissional ainda não registrou anotações para este serviço."}
                            </div>
                        </div>
                    )}

                    {activeTab === 'avaliacao' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="text-center space-y-2 mt-4">
                                <h4 className="text-xl font-black text-gray-900">Como foi o serviço?</h4>
                                <p className="text-xs text-gray-500 font-medium">Sua avaliação ajuda a manter a qualidade da plataforma.</p>
                            </div>

                            {!selectedOrder.avaliacao ? (
                                <div className="space-y-8">
                                    <div className="flex justify-center space-x-3">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                type="button"
                                                onClick={() => setRatingScore(star)}
                                                onMouseEnter={() => setHoverRating(star)}
                                                onMouseLeave={() => setHoverRating(0)}
                                                className="transition-all active:scale-90"
                                            >
                                                <Star
                                                    size={44}
                                                    className={`${
                                                        (hoverRating || ratingScore) >= star
                                                            ? 'fill-yellow-400 text-yellow-400'
                                                            : 'text-gray-200'
                                                    }`}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.1em] ml-1">Comentário Adicional</label>
                                        <textarea
                                            value={ratingComment}
                                            onChange={(e) => setRatingComment(e.target.value)}
                                            placeholder="Descreva sua experiência com o profissional..."
                                            className="w-full bg-gray-50 border border-gray-200 rounded-[1.5rem] p-5 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30 min-h-[120px] resize-none"
                                        />
                                    </div>

                                    <button
                                        onClick={handleSubmitRating}
                                        disabled={submittingRating || !ratingScore}
                                        className="w-full bg-black text-white py-4 rounded-2xl font-bold shadow-xl hover:shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                                    >
                                        {submittingRating ? <Loader2 className="animate-spin" size={20}/> : <><Send size={18}/><span>Enviar Avaliação</span></>}
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-green-50 p-8 rounded-[2.5rem] border border-green-100 text-center space-y-4">
                                    <div className="flex justify-center space-x-1">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <Star key={star} size={22} className={star <= (selectedOrder.avaliacao?.nota || 0) ? 'fill-green-500 text-green-500' : 'text-green-200'} />
                                        ))}
                                    </div>
                                    <h5 className="font-black text-green-900 text-sm uppercase tracking-wider">Avaliação Enviada</h5>
                                    <p className="text-sm font-bold text-green-800 leading-relaxed italic">"{selectedOrder.avaliacao?.comentario}"</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-white">
                    <button 
                        onClick={() => setIsModalOpen(false)} 
                        className="w-full bg-white border border-gray-200 text-gray-900 py-4 rounded-2xl font-bold shadow-sm active:scale-95 transition-all hover:bg-gray-50"
                    >
                        Fechar Detalhes
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ClientOrders;
