
import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import {
    X, Star, Calendar, Clock, Banknote, AlertCircle, ThumbsUp, ThumbsDown,
    Smartphone, CreditCard, MessageSquare, Sparkles, Send, Loader2, Ban, Check, UserCheck, Camera, PlayCircle
} from 'lucide-react';
import ConsumerTab from './ConsumerTab';

interface ConsumerOrderModalProps {
    order: any;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => Promise<void>;
    userUuid: string;
}

const ConsumerOrderModal: React.FC<ConsumerOrderModalProps> = ({
    order,
    isOpen,
    onClose,
    onUpdate,
    userUuid
}) => {
    const [activeTab, setActiveTab] = useState<'geral' | 'consumidor' | 'fotos' | 'avaliacao'>('geral');
    const [processingAction, setProcessingAction] = useState(false);
    const [paymentChoice, setPaymentChoice] = useState<'original' | 'suggested'>('original');
    const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [ratingScore, setRatingScore] = useState(order?.avaliacao?.nota || 0);
    const [ratingComment, setRatingComment] = useState(order?.avaliacao?.comentario || '');
    const [hoverRating, setHoverRating] = useState(0);
    const [submittingRating, setSubmittingRating] = useState(false);

    if (!isOpen || !order) return null;

    const isMediaVideo = (url: string) => {
        if (!url) return false;
        const cleanPath = url.split('?')[0].toLowerCase();
        const videoExtensions = ['.mp4', '.mov', '.webm', '.quicktime', '.m4v', '.3gp', '.mkv'];
        return videoExtensions.some(ext => cleanPath.endsWith(ext)) || url.toLowerCase().includes('video');
    };

    const extractOriginalDesc = (desc: string | undefined | null) => {
        if (!desc) return "";
        const firstMarkerIndex = desc.indexOf('\n\n[');
        if (firstMarkerIndex !== -1) return desc.substring(0, firstMarkerIndex).trim();
        return desc.trim();
    };

    const handleProposalDecision = async (approved: boolean, reason: string = '') => {
        if (processingAction) return;
        setProcessingAction(true);
        try {
            const plan = order.planejamento?.[0];
            const budget = order.orcamentos?.[0];
            const rawPro = order.profissional;
            const proUuid = typeof rawPro === 'string' ? rawPro : (rawPro as any)?.uuid;

            if (approved && (!plan || !proUuid)) {
                throw new Error("Dados de agendamento incompletos no sistema.");
            }

            if (approved && budget) {
                const finalType = paymentChoice === 'suggested' ? budget.tipopagmto_sugerido : budget.tipopagmto;
                const finalParcelas = paymentChoice === 'suggested' ? budget.parcelas_sugerido : budget.parcelas;
                let finalPrice = budget.preco;
                if (paymentChoice === 'suggested' && (budget.desconto_sugerido || 0) > 0) {
                    finalPrice = budget.preco * (1 - (budget.desconto_sugerido || 0) / 100);
                }
                await supabase.from('orcamentos').update({
                    tipopagmto: finalType,
                    parcelas: finalParcelas,
                    preco: finalPrice
                }).eq('id', budget.id);
            }

            const newStatus = approved ? 'aprovado' : 'reprovado';
            const updatePayload: any = { status: newStatus };
            if (!approved && reason) updatePayload.motivo_recusa = reason;

            const { error: updateError } = await supabase.from('chaves').update(updatePayload).eq('id', order.id);
            if (updateError) throw updateError;

            if (approved && plan && proUuid) {
                const { data: existingAgenda } = await supabase.from('agenda').select('id').eq('chave', order.id).maybeSingle();
                const agendaPayload = {
                    chave: order.id,
                    cliente: order.cliente,
                    profissional: proUuid,
                    execucao: plan.execucao,
                    observacoes: ''
                };
                if (existingAgenda) await supabase.from('agenda').update(agendaPayload).eq('id', existingAgenda.id);
                else await supabase.from('agenda').insert(agendaPayload);
            }

            await onUpdate();
            onClose();
            setIsRejectionModalOpen(false);
            setRejectionReason('');
            alert(approved ? "Serviço agendado com sucesso!" : "Proposta recusada.");
        } catch (e: any) {
            alert("Erro: " + (e.message || "Erro desconhecido"));
        } finally {
            setProcessingAction(false);
        }
    };

    const handleSubmitRating = async () => {
        if (!ratingScore) return;
        setSubmittingRating(true);
        try {
            const rawPro = order.profissional;
            const proUuid = typeof rawPro === 'string' ? rawPro : (rawPro as any)?.uuid;
            const { error } = await supabase.from('avaliacoes').insert({
                chave: order.id,
                profissional: proUuid,
                cliente: userUuid,
                nota: ratingScore,
                comentario: ratingComment
            });
            if (error) throw error;
            alert("Avaliação enviada!");
            await onUpdate();
            onClose();
        } catch (e: any) { alert(e.message); } finally { setSubmittingRating(false); }
    };

    const getStatusColor = (s: string | undefined) => {
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
            default: return s?.replace('_', ' ') || '';
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg leading-tight">{(order.geral as any)?.nome || order.geralData?.nome}</h3>
                        <p className="text-xs font-mono font-black text-gray-400 uppercase tracking-wider">#{order.chaveunica}</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 transition-colors"><X size={20} /></button>
                </div>

                <div className="flex border-b border-gray-100 bg-white overflow-x-auto no-scrollbar h-14 shrink-0">
                    <button onClick={() => setActiveTab('geral')} className={`flex-1 min-w-[100px] h-full flex flex-col items-center justify-center transition-all relative group`}><span className={`text-xs font-black uppercase tracking-widest leading-none ${activeTab === 'geral' ? 'text-ios-blue' : 'text-gray-400'}`}>Informações</span>{activeTab === 'geral' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}</button>
                    <button onClick={() => setActiveTab('consumidor')} className={`flex-1 min-w-[100px] h-full flex flex-col items-center justify-center transition-all relative group`}><span className={`text-xs font-black uppercase tracking-widest leading-none ${activeTab === 'consumidor' ? 'text-ios-blue' : 'text-gray-400'}`}>Consumidor</span>{activeTab === 'consumidor' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}</button>
                    <button onClick={() => setActiveTab('fotos')} className={`flex-1 min-w-[100px] h-full flex flex-col items-center justify-center transition-all relative group`}><span className={`text-xs font-black uppercase tracking-widest leading-none ${activeTab === 'fotos' ? 'text-ios-blue' : 'text-gray-400'}`}>Mídia</span>{activeTab === 'fotos' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}</button>
                    {order.status === 'concluido' && (<button onClick={() => setActiveTab('avaliacao')} className={`flex-1 min-w-[100px] h-full flex flex-col items-center justify-center transition-all relative group`}><span className={`text-xs font-black uppercase tracking-widest leading-none ${activeTab === 'avaliacao' ? 'text-ios-blue' : 'text-gray-400'}`}>Avaliação</span>{activeTab === 'avaliacao' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}</button>)}
                </div>

                <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white no-scrollbar">
                    {activeTab === 'geral' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 shadow-inner">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-4 block">Status do Pedido</label>
                                <div className={`inline-flex px-5 py-2 rounded-xl text-xs font-black border uppercase mb-6 ${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</div>

                                <div className="grid grid-cols-1 gap-6 mt-6">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-blue-50 rounded-2xl text-ios-blue shadow-sm border border-blue-100"><Calendar size={20} /></div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Visita Técnica</p>
                                            <p className="text-sm font-bold text-gray-900">{order.planejamento?.[0]?.visita ? new Date(order.planejamento[0].visita).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Não agendada'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-purple-50 rounded-2xl text-purple-600 shadow-sm border border-purple-100"><Clock size={20} /></div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Execução Prevista</p>
                                            <p className="text-sm font-bold text-gray-900">{order.planejamento?.[0]?.execucao ? new Date(order.planejamento[0].execucao).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'A definir'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4 pt-4 border-t border-gray-100">
                                        <div className="p-3 bg-green-50 rounded-2xl text-green-600 shadow-sm border border-green-100"><Banknote size={20} /></div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Valor Total</p>
                                            <p className="text-base font-black text-gray-900">{order.orcamentos?.[0]?.preco && order.status.toLowerCase() !== 'aguardando_profissional' ? `R$ ${order.orcamentos[0].preco.toFixed(2)}` : 'Calculando...'}</p>
                                        </div>
                                    </div>
                                </div>

                                {order.orcamentos?.[0] && order.status === 'aguardando_aprovacao' && (
                                    <div className="mt-8 pt-8 border-t border-gray-200 animate-in fade-in duration-500">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1"><Banknote size={12} /> Escolha a Forma de Pagamento</p>
                                        <div className="grid grid-cols-1 gap-3">
                                            <button onClick={() => setPaymentChoice('original')} className={`p-5 rounded-3xl border-2 text-left transition-all relative overflow-hidden ${paymentChoice === 'original' ? 'border-ios-blue bg-blue-50/50 shadow-md ring-4 ring-blue-50' : 'border-gray-200 bg-white'}`}>
                                                <div className="flex justify-between items-start">
                                                    <div className="flex gap-3">
                                                        <div className={`p-2 rounded-xl ${paymentChoice === 'original' ? 'bg-ios-blue text-white' : 'bg-gray-100 text-gray-400'}`}>{order.orcamentos[0].tipopagmto === 'PIX' || order.orcamentos[0].tipopagmto === 'Dinheiro' ? <Smartphone size={20} /> : <CreditCard size={20} />}</div>
                                                        <div>
                                                            <p className="text-xs font-black text-gray-900 uppercase">Sua Escolha Inicial</p>
                                                            <h4 className="text-sm font-bold text-gray-700">{order.orcamentos[0].tipopagmto}</h4>
                                                            {order.orcamentos[0].tipopagmto === 'Cartão de Crédito' && <p className="text-[10px] font-bold text-gray-400">{order.orcamentos[0].parcelas}x no cartão</p>}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-black text-gray-900">R$ {order.orcamentos[0].preco.toFixed(2)}</p>
                                                        {paymentChoice === 'original' && <div className="inline-block bg-ios-blue text-white p-1 rounded-full mt-2"><Check size={12} /></div>}
                                                    </div>
                                                </div>
                                            </button>

                                            {order.orcamentos[0].tipopagmto_sugerido && (
                                                <button onClick={() => setPaymentChoice('suggested')} className={`p-5 rounded-3xl border-2 text-left transition-all relative overflow-hidden ${paymentChoice === 'suggested' ? 'border-blue-600 bg-blue-50 shadow-md ring-4 ring-blue-50' : 'border-gray-200 bg-white'}`}>
                                                    <div className="absolute top-0 right-0 bg-blue-600 text-white px-3 py-1 text-[8px] font-black uppercase rounded-bl-xl flex items-center gap-1 shadow-sm"><Sparkles size={8} /> Sugestão UAI Fix</div>
                                                    <div className="flex justify-between items-start mt-1">
                                                        <div className="flex gap-3">
                                                            <div className={`p-2 rounded-xl ${paymentChoice === 'suggested' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>{order.orcamentos[0].tipopagmto_sugerido === 'PIX' || order.orcamentos[0].tipopagmto_sugerido === 'Dinheiro' ? <Smartphone size={20} /> : <CreditCard size={20} />}</div>
                                                            <div>
                                                                <p className="text-xs font-black text-gray-900 uppercase">Oferta Alternativa</p>
                                                                <h4 className="text-sm font-bold text-gray-700">{order.orcamentos[0].tipopagmto_sugerido}</h4>
                                                                {order.orcamentos[0].tipopagmto_sugerido === 'Cartão de Crédito' && <p className="text-[10px] font-bold text-gray-400">{order.orcamentos[0].parcelas_sugerido}x no cartão</p>}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            {(order.orcamentos[0].desconto_sugerido || 0) > 0 ? (
                                                                <div className="space-y-0.5">
                                                                    <p className="text-[10px] text-gray-400 line-through">R$ {order.orcamentos[0].preco.toFixed(2)}</p>
                                                                    <p className="text-sm font-black text-green-600">R$ {(order.orcamentos[0].preco * (1 - (order.orcamentos[0].desconto_sugerido || 0) / 100)).toFixed(2)}</p>
                                                                    <div className="bg-green-100 text-green-700 px-2 py-0.5 rounded-md text-[8px] font-black uppercase inline-block">-{(order.orcamentos[0].desconto_sugerido || 0)}% OFF</div>
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs font-black text-gray-900">R$ {order.orcamentos[0].preco.toFixed(2)}</p>
                                                            )}
                                                            {paymentChoice === 'suggested' && <div className="inline-block bg-blue-600 text-white p-1 rounded-full mt-2"><Check size={12} /></div>}
                                                        </div>
                                                    </div>
                                                    {order.orcamentos[0].justificativa_sugerido && order.orcamentos[0].tipopagmto_sugerido !== order.orcamentos[0].tipopagmto && (
                                                        <div className="mt-4 p-3 bg-blue-100/50 rounded-2xl border border-blue-200">
                                                            <p className="text-[9px] font-black text-blue-600 uppercase mb-1 flex items-center gap-1"><MessageSquare size={10} /> Por que sugerimos?</p>
                                                            <p className="text-xs font-bold text-blue-900 italic leading-relaxed">"{order.orcamentos[0].justificativa_sugerido}"</p>
                                                        </div>
                                                    )}
                                                </button>
                                            )}
                                        </div>

                                        {order.orcamentos?.[0].observacaocliente && (
                                            <div className="mt-6 p-5 bg-blue-600 rounded-3xl text-white shadow-xl relative animate-in slide-in-from-left-4">
                                                <div className="flex items-center gap-2 mb-2"><MessageSquare size={14} className="text-blue-100" /><p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Mensagem do Orçamentista</p></div>
                                                <p className="text-sm font-medium leading-relaxed italic">"{order.orcamentos[0].observacaocliente}"</p>
                                                <div className="absolute -top-2 left-8 w-4 h-4 bg-blue-600 rotate-45"></div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {order.status === 'aguardando_aprovacao' && (
                                    <div className="mt-8 p-6 bg-white rounded-3xl border border-orange-100 space-y-5 shadow-sm animate-in slide-in-from-bottom-4">
                                        <div className="flex items-center gap-3 text-orange-700"><AlertCircle size={20} className="flex-shrink-0" /><p className="text-xs font-bold leading-tight">Ao aprovar, o serviço será oficialmente agendado com a forma de pagamento e valor escolhidos.</p></div>
                                        <div className="flex flex-col gap-2">
                                            <button onClick={() => handleProposalDecision(true)} disabled={processingAction} className="w-full bg-black text-white py-4 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">{processingAction ? <Loader2 className="animate-spin" size={18} /> : <><ThumbsUp size={18} /><span>Aprovar Orçamento</span></>}</button>
                                            <button onClick={() => setIsRejectionModalOpen(true)} disabled={processingAction} className="w-full bg-white border border-red-100 text-red-500 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"><ThumbsDown size={14} /><span>Recusar Proposta</span></button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'consumidor' && (
                        <ConsumerTab
                            editingItem={order}
                            extractOriginalDesc={extractOriginalDesc}
                            isMediaVideo={isMediaVideo}
                        />
                    )}

                    {activeTab === 'fotos' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">Antes (Fotos/Vídeos)</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {(order.fotoantes || []).length > 0 ? order.fotoantes.map((url: string, i: number) => (
                                        <div key={i} className="aspect-video bg-gray-100 rounded-2xl overflow-hidden relative group border border-gray-200">{isMediaVideo(url) ? (<video src={url} className="w-full h-full object-cover" controls playsInline preload="metadata" />) : (<img src={url} className="w-full h-full object-cover" />)}</div>
                                    )) : <div className="col-span-2 py-6 text-center text-gray-300 text-[10px] font-black uppercase tracking-widest">Nenhuma mídia registrada.</div>}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">Conclusão (Fotos/Vídeos)</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {(order.fotodepois || []).length > 0 ? order.fotodepois.map((url: string, i: number) => (
                                        <div key={i} className="aspect-video bg-gray-100 rounded-2xl overflow-hidden relative group border border-gray-200">{isMediaVideo(url) ? (<video src={url} className="w-full h-full object-cover" controls playsInline preload="metadata" />) : (<img src={url} className="w-full h-full object-cover" />)}</div>
                                    )) : <div className="col-span-2 py-6 text-center text-gray-300 text-[10px] font-black uppercase tracking-widest">Nenhuma mídia registrada.</div>}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'avaliacao' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {!order.avaliacao ? (
                                <div className="space-y-8">
                                    <div className="text-center space-y-2 mt-4"><h4 className="text-xl font-black text-gray-900">Como foi o serviço?</h4><p className="text-xs text-gray-500 font-medium">Sua avaliação ajuda a manter a qualidade.</p></div>
                                    <div className="flex justify-center space-x-3">{[1, 2, 3, 4, 5].map((star) => (<button key={star} type="button" onClick={() => setRatingScore(star)} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)} className="transition-all active:scale-90"><Star size={44} className={`${(hoverRating || ratingScore) >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} /></button>))}</div>
                                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.1em] ml-1">Comentário Adicional</label><textarea value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} placeholder="Descreva sua experiência..." className="w-full bg-gray-50 border border-gray-200 rounded-[1.5rem] p-5 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30 min-h-[120px] resize-none" /></div>
                                    <button onClick={handleSubmitRating} disabled={submittingRating || !ratingScore} className="w-full bg-black text-white py-4 rounded-2xl font-bold shadow-xl flex items-center justify-center space-x-2 disabled:opacity-50">{submittingRating ? <Loader2 className="animate-spin" size={20} /> : <><Send size={18} /><span>Enviar Avaliação</span></>}</button>
                                </div>
                            ) : (
                                <div className="bg-green-50 p-8 rounded-[2.5rem] border border-green-100 text-center space-y-4">
                                    <div className="flex justify-center items-center gap-2 mb-2"><div className="bg-white p-2 rounded-full shadow-sm"><UserCheck size={20} className="text-green-600" /></div><h5 className="font-black text-green-900 text-sm uppercase tracking-wider">Serviço Avaliado</h5></div>
                                    <div className="flex justify-center space-x-1">{[1, 2, 3, 4, 5].map((star) => (<Star key={star} size={28} className={star <= (order.avaliacao?.nota || 0) ? 'fill-green-500 text-green-500' : 'text-green-200'} />))}</div>
                                    <p className="text-base font-bold text-green-800 leading-relaxed italic mt-4">"{order.avaliacao?.comentario}"</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 mt-auto">
                    <button onClick={onClose} className="w-full bg-white border border-gray-200 text-gray-900 py-4 rounded-2xl font-bold shadow-sm active:scale-95 transition-all">Fechar</button>
                </div>
            </div>

            {isRejectionModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-sm rounded-[2.5rem] shadow-2xl p-6 flex flex-col gap-6">
                        <div className="text-center space-y-2">
                            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2"><Ban size={28} /></div>
                            <h3 className="text-xl font-bold text-gray-900">Recusar Proposta</h3>
                            <p className="text-xs text-gray-500">Por favor, conte-nos por que você está recusando este orçamento.</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Motivo da Recusa</label>
                            <textarea className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-red-200 min-h-[120px] resize-none" placeholder="Ex: Valor muito alto, data indisponível, etc..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-2">
                            <button disabled={processingAction || !rejectionReason.trim()} onClick={() => handleProposalDecision(false, rejectionReason)} className="w-full bg-black text-white py-4 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-30">{processingAction ? <Loader2 className="animate-spin" size={18} /> : 'Confirmar Recusa'}</button>
                            <button onClick={() => setIsRejectionModalOpen(false)} className="w-full bg-gray-50 text-gray-600 py-3 rounded-2xl font-black text-xs active:scale-95 transition-all">Voltar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConsumerOrderModal;
