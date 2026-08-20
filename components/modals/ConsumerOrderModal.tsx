
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
    X, Star, Calendar, Clock, Banknote, AlertCircle, ThumbsUp, ThumbsDown,
    Smartphone, CreditCard, MessageSquare, Sparkles, Send, Loader2, Ban, Check, UserCheck, Camera, PlayCircle, Briefcase, Printer
} from 'lucide-react';
import ConsumerTab from './ConsumerTab';
import { SignatureModal } from './SignatureModal';
import { PrintOsModal } from './PrintOsModal';
import { OsPrintData } from '../../utils/osPrinter';

interface ConsumerOrderModalProps {
    order: any;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => Promise<void>;
    userUuid: string;
    initialTab?: 'geral' | 'consumidor' | 'fotos' | 'avaliacao';
}

const ConsumerOrderModal: React.FC<ConsumerOrderModalProps> = ({
    order,
    isOpen,
    onClose,
    onUpdate,
    userUuid,
    initialTab = 'geral'
}) => {
    const [activeTab, setActiveTab] = useState<'geral' | 'consumidor' | 'fotos' | 'avaliacao'>(initialTab);
    const [processingAction, setProcessingAction] = useState(false);
    const [paymentChoice, setPaymentChoice] = useState<'original' | 'suggested'>('original');
    const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [ratingScore, setRatingScore] = useState(order?.avaliacao?.nota || 0);
    const [ratingComment, setRatingComment] = useState(order?.avaliacao?.comentario || '');
    const [hoverRating, setHoverRating] = useState(0);

    const [platformRatingScore, setPlatformRatingScore] = useState(order?.avaliacaoPlataforma?.nota || 0);
    const [platformRatingComment, setPlatformRatingComment] = useState(order?.avaliacaoPlataforma?.comentario || '');
    const [hoverPlatformRating, setHoverPlatformRating] = useState(0);

    const [submittingRating, setSubmittingRating] = useState(false);
    const [discoverySource, setDiscoverySource] = useState('');
    const [discoveryOther, setDiscoveryOther] = useState('');
    const [proStats, setProStats] = useState<{ rating: number | null; serviceCount: number }>({
        rating: null,
        serviceCount: 0
    });

    const [userOrigin, setUserOrigin] = useState<string | null>(null);
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

    const buildOsPrintData = (): OsPrintData => {
        const plan = order.planejamento?.[0] || order.planejamentoData;
        const budget = order.orcamento || order.orcamentos?.[0] || order.orcamentoData;

        return {
            codigoOs: order.chaveunica || String(order.id),
            dataEmissao: order.created_at,
            status: getStatusLabel(order.status),
            cliente: {
                nome: order.cliente?.nome || order.clienteData?.nome || 'Cliente UAI Fix',
                cpf: order.cliente?.cpf || order.clienteData?.cpf,
                telefone: order.cliente?.whatsapp || order.clienteData?.whatsapp,
                enderecoCompleto: [order.cliente?.rua || order.clienteData?.rua, order.cliente?.numero || order.clienteData?.numero].filter(Boolean).join(', ') || 'Endereço não informado',
                bairro: order.cliente?.bairro || order.clienteData?.bairro,
                cidade: order.cliente?.cidadeNome || order.clienteData?.cidadeNome || '',
                cep: order.cliente?.cep || order.clienteData?.cep,
                complemento: order.cliente?.complemento || order.clienteData?.complemento
            },
            profissional: {
                nome: order.profissional?.nome || order.profissionalData?.nome || 'Profissional UAI Fix',
                telefone: order.profissional?.whatsapp || order.profissionalData?.whatsapp || '',
                especialidade: (order.geral as any)?.nome || order.geralData?.nome || 'Manutenção'
            },
            servico: {
                categoria: (order.geral as any)?.nome || order.geralData?.nome || 'Serviço Geral',
                descricaoPedido: plan?.descricao || '',
                recursosAlocados: plan?.recursos || [],
                dataExecucao: plan?.execucao || ''
            },
            financeiro: {
                precoTotal: budget?.preco || 0,
                formaPagamento: budget?.tipopagmto || 'PIX',
                parcelas: budget?.parcelas || 1,
                notaFiscal: budget?.notafiscal || false,
                observacoes: budget?.observacaocliente || ''
            },
            execucao: {
                fotoAntes: order.fotoantes || [],
                fotoDepois: order.fotodepois || []
            },
            assinatura: {
                assinaturaUrl: order.fina_assinatura || order.assinatura || undefined,
                cpfAssinante: order.cliente?.cpf || order.clienteData?.cpf,
                timestamp: order.updated_at
            }
        };
    };

    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab || 'geral');
            setRatingScore(order?.avaliacao?.nota || 0);
            setRatingComment(order?.avaliacao?.comentario || '');
            setPlatformRatingScore(order?.avaliacaoPlataforma?.nota || 0);
            setPlatformRatingComment(order?.avaliacaoPlataforma?.comentario || '');
        }
    }, [isOpen, initialTab, order]);

    useEffect(() => {
        const fetchProStatsAndUser = async () => {
            if (userUuid) {
                try {
                    const { data } = await supabase.from('users').select('origem').eq('uuid', userUuid).maybeSingle();
                    if (data) setUserOrigin(data.origem);
                } catch (error) {
                    console.error("Error fetching user origin:", error);
                }
            }

            const proUuid = typeof order.profissional === 'string' ? order.profissional : order.profissional?.uuid;
            if (!proUuid) return;

            try {
                const [{ data: rats }, { data: services }] = await Promise.all([
                    supabase.from('avaliacoes').select('nota').eq('profissional', proUuid),
                    supabase.from('agenda').select('id').eq('profissional', proUuid)
                ]);

                const rating = rats && rats.length > 0
                    ? rats.reduce((acc, curr) => acc + (curr.nota || 0), 0) / rats.length
                    : null;
                const serviceCount = services?.length || 0;

                setProStats({ rating, serviceCount });
            } catch (error) {
                console.error("Error fetching pro stats:", error);
            }
        };

        if (isOpen) {
            fetchProStatsAndUser();
        }
    }, [isOpen, order.profissional, userUuid]);

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

    const handleProposalDecision = async (approved: boolean, reason: string = '', sigData?: { signatureDataUrl: string; cpf: string; latitude: number | null; longitude: number | null; timestamp: string }) => {
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
                const updateOrcData: any = {
                    tipopagmto: finalType,
                    parcelas: finalParcelas,
                    preco: finalPrice
                };
                if (sigData) {
                    updateOrcData.assinatura_cliente = sigData.signatureDataUrl;
                    updateOrcData.assinatura_cpf = sigData.cpf;
                    updateOrcData.assinatura_data = sigData.timestamp;
                    updateOrcData.assinatura_lat = sigData.latitude;
                    updateOrcData.assinatura_lng = sigData.longitude;
                }
                await supabase.from('orcamentos').update(updateOrcData).eq('id', budget.id);
            }

            const newStatus = approved ? 'aprovado' : 'recusado';
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
            setIsSignatureModalOpen(false);
            setRejectionReason('');
            alert(approved ? "Orçamento aprovado com assinatura digital e serviço agendado com sucesso!" : "Proposta recusada.");
        } catch (e: any) {
            alert("Erro: " + (e.message || "Erro desconhecido"));
        } finally {
            setProcessingAction(false);
        }
    };

    const handleSubmitRating = async () => {
        if (!ratingScore && !platformRatingScore) return;
        setSubmittingRating(true);
        try {
            const rawPro = order.profissional;
            const proUuid = typeof rawPro === 'string' ? rawPro : (rawPro as any)?.uuid;

            const inserts = [];
            if (ratingScore && !order.avaliacao) {
                inserts.push({
                    chave: order.id,
                    profissional: proUuid,
                    cliente: userUuid,
                    nota: ratingScore,
                    comentario: ratingComment,
                    tipo_alvo: 'profissional'
                });
            }
            if (platformRatingScore && !order.avaliacaoPlataforma) {
                inserts.push({
                    chave: order.id,
                    profissional: proUuid || null,
                    cliente: userUuid,
                    nota: platformRatingScore,
                    comentario: platformRatingComment,
                    tipo_alvo: 'plataforma_uaifix'
                });
            }

            if (inserts.length > 0) {
                const { error } = await supabase.from('avaliacoes').insert(inserts);
                if (error) throw error;
            }

            if (discoverySource) {
                let finalSource = discoverySource;
                if (discoverySource === 'Outro') finalSource = discoveryOther;
                else if (discoverySource === 'Indicação') finalSource = discoveryOther ? `Indicação: ${discoveryOther}` : 'Indicação';

                if (finalSource) {
                   await supabase.from('users').update({ origem: finalSource }).eq('uuid', userUuid);
                }
            }

            alert("Avaliações enviadas com sucesso!");
            await onUpdate();
            onClose();
        } catch (e: any) { alert(e.message); } finally { setSubmittingRating(false); }
    };

    const getStatusColor = (s: string | undefined) => {
        switch (s?.toLowerCase()) {
            case 'concluido':
            case 'aguardando_gestor':
            case 'erro': return 'bg-green-100 text-green-900 border-green-200';
            case 'executando': return 'bg-purple-100 text-purple-900 border-purple-200';
            case 'aguardando_aprovacao': return 'bg-orange-100 text-orange-900 border-orange-200';
            case 'aguardando_profissional': return 'bg-cyan-100 text-cyan-900 border-cyan-200';
            case 'cancelado': return 'bg-red-100 text-red-900 border-red-200';
            case 'aprovado': return 'bg-green-50 text-green-700 border-green-100';
            case 'recusado':
            case 'reprovado': return 'bg-red-50 text-red-700 border-red-100';
            default: return 'bg-blue-100 text-blue-900 border-blue-200';
        }
    };

    const getStatusLabel = (s: string) => {
        switch (s?.toLowerCase()) {
            case 'aguardando_aprovacao': return 'Proposta Recebida';
            case 'aguardando_profissional': return 'Aguardando Profissional';
            case 'aprovado': return 'Aprovado (Agendado)';
            case 'recusado':
            case 'reprovado': return 'Recusado';
            case 'aguardando_gestor': return 'Concluído';
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
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsPrintModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 transition-all active:scale-95 shadow-xs"
                            title="Imprimir ou Salvar Ordem de Serviço em PDF"
                        >
                            <Printer size={14} />
                            <span className="hidden sm:inline">Imprimir OS</span>
                        </button>
                        <button onClick={onClose} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 transition-colors"><X size={20} /></button>
                    </div>
                </div>

                <div className="flex border-b border-gray-100 bg-white overflow-x-auto no-scrollbar h-14 shrink-0">
                    <button onClick={() => setActiveTab('geral')} className={`flex-1 min-w-[100px] h-full flex flex-col items-center justify-center transition-all relative group`}><span className={`text-xs font-black uppercase tracking-widest leading-none ${activeTab === 'geral' ? 'text-ios-blue' : 'text-gray-400'}`}>Informações</span>{activeTab === 'geral' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}</button>
                    <button onClick={() => setActiveTab('consumidor')} className={`flex-1 min-w-[100px] h-full flex flex-col items-center justify-center transition-all relative group`}><span className={`text-xs font-black uppercase tracking-widest leading-none ${activeTab === 'consumidor' ? 'text-ios-blue' : 'text-gray-400'}`}>Consumidor</span>{activeTab === 'consumidor' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}</button>
                    <button onClick={() => setActiveTab('fotos')} className={`flex-1 min-w-[100px] h-full flex flex-col items-center justify-center transition-all relative group`}><span className={`text-xs font-black uppercase tracking-widest leading-none ${activeTab === 'fotos' ? 'text-ios-blue' : 'text-gray-400'}`}>Mídia</span>{activeTab === 'fotos' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}</button>
                    {['concluido', 'aguardando_gestor', 'erro'].includes(order.status) && (<button onClick={() => setActiveTab('avaliacao')} className={`flex-1 min-w-[100px] h-full flex flex-col items-center justify-center transition-all relative group`}><span className={`text-xs font-black uppercase tracking-widest leading-none ${activeTab === 'avaliacao' ? 'text-ios-blue' : 'text-gray-400'}`}>Avaliação</span>{activeTab === 'avaliacao' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ios-blue rounded-t-full" />}</button>)}
                </div>

                <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white no-scrollbar">
                    {activeTab === 'geral' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 shadow-inner">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-4 block">Status do Pedido</label>
                                <div className={`inline-flex px-5 py-2 rounded-xl text-xs font-black border uppercase mb-6 ${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</div>

                                <div className="mt-4 p-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden shadow-inner flex-shrink-0">
                                            <img
                                                src={order.profissional?.fotoperfil || `https://ui-avatars.com/api/?name=${order.profissional?.nome || 'U'}`}
                                                className="w-full h-full object-cover"
                                                alt={order.profissional?.nome}
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Profissional Responsável</p>
                                            <h4 className="text-sm font-bold text-gray-900 truncate">
                                                {order.profissional?.nome || 'Aguardando atribuição'}
                                            </h4>
                                            {order.profissional && (
                                                <div className="flex flex-col gap-1 mt-1">
                                                    <div className="flex items-center gap-1">
                                                        <Star size={12} className="fill-yellow-400 text-yellow-400" />
                                                        <span className="text-xs font-black text-gray-700">
                                                            {proStats.rating ? proStats.rating.toFixed(1) : 'Novo'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-60">
                                                        <Briefcase size={10} className="text-gray-500" />
                                                        <span className="text-[10px] font-bold text-gray-600">
                                                            {proStats.serviceCount} {proStats.serviceCount === 1 ? 'atendimento' : 'atendimentos'}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {!order.profissional && <div className="p-2 bg-blue-50 text-ios-blue rounded-xl"><UserCheck size={20} /></div>}
                                </div>

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

                                 {order.orcamentos?.[0]?.assinatura_cliente && (
                                     <div className="mt-6 p-4 bg-white rounded-3xl border border-gray-100 space-y-3 shadow-sm">
                                         <div className="flex items-center justify-between">
                                             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Assinatura Digital Jurídica</p>
                                             <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-md text-[9px] font-black uppercase">Válida</span>
                                         </div>
                                         <div className="flex gap-4 items-center">
                                             <div className="bg-gray-50 p-2 rounded-2xl border border-gray-100">
                                                 <img src={order.orcamentos[0].assinatura_cliente} alt="Assinatura" className="h-14 object-contain" />
                                             </div>
                                             <div className="space-y-1 text-[11px] text-gray-600 font-medium">
                                                 {order.orcamentos[0].assinatura_cpf && <p><span className="font-bold text-gray-900">CPF:</span> {order.orcamentos[0].assinatura_cpf}</p>}
                                                 {order.orcamentos[0].assinatura_data && <p><span className="font-bold text-gray-900">Data/Hora:</span> {new Date(order.orcamentos[0].assinatura_data).toLocaleString('pt-BR')}</p>}
                                                 {order.orcamentos[0].assinatura_lat && order.orcamentos[0].assinatura_lng && (
                                                     <p><span className="font-bold text-gray-900">GPS:</span> {order.orcamentos[0].assinatura_lat.toFixed(4)}, {order.orcamentos[0].assinatura_lng.toFixed(4)}</p>
                                                 )}
                                             </div>
                                         </div>
                                     </div>
                                 )}

                                  {/* Estado: Aguardando Orçamento */}
                                  {(order.status === 'pendente' || order.status === 'analise') && (
                                      <div className="mt-8 p-6 bg-blue-50/80 rounded-3xl border border-blue-200/80 space-y-3 animate-in fade-in duration-300">
                                          <div className="flex items-center gap-2.5 text-ios-blue">
                                              <Clock size={18} className="text-ios-blue" />
                                              <h4 className="text-xs font-black uppercase tracking-wider">Orçamento em Elaboração</h4>
                                          </div>
                                          <p className="text-xs text-blue-700 font-medium leading-relaxed">
                                              Seu pedido está em análise técnica pela nossa equipe para dimensionamento de custos e materiais.
                                          </p>
                                      </div>
                                  )}

                                  {/* Estado: Aguardando Aceite do Profissional */}
                                  {order.status === 'aguardando_profissional' && (
                                      <div className="mt-8 p-6 bg-cyan-50/80 rounded-3xl border border-cyan-200/80 space-y-3 animate-in fade-in duration-300">
                                          <div className="flex items-center gap-2.5 text-cyan-800">
                                              <Clock size={18} className="animate-spin text-cyan-600" />
                                              <h4 className="text-xs font-black uppercase tracking-wider">Aguardando Aceite do Profissional</h4>
                                          </div>
                                          <p className="text-xs text-cyan-700 font-medium leading-relaxed">
                                              O orçamento deste serviço foi calculado com precisão e enviado para validação de agenda do profissional responsável.
                                          </p>
                                          <p className="text-[11px] text-cyan-600 font-semibold">
                                              Assim que o profissional confirmar o aceite, a proposta completa com opções de pagamento será liberada aqui para sua aprovação.
                                          </p>
                                      </div>
                                  )}

                                  {/* Estado: Aguardando Aprovação do Cliente (Orçamento Fechado e Aceito pelo Profissional) */}
                                  {order.orcamentos?.[0] && order.orcamentos[0].preco > 0 && order.status === 'aguardando_aprovacao' && (
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
                                                     {order.orcamentos[0].justificativa_sugerido && (
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

                                  {/* Botões de Ação do Cliente - Estritamente apenas após orçamento fechado e aceite do profissional */}
                                  {order.status === 'aguardando_aprovacao' && order.orcamentos?.[0] && order.orcamentos[0].preco > 0 && (
                                      <div className="mt-8 p-6 bg-white rounded-3xl border border-orange-100 space-y-5 shadow-sm animate-in slide-in-from-bottom-4">
                                          <div className="flex items-center gap-3 text-orange-700"><AlertCircle size={20} className="flex-shrink-0" /><p className="text-xs font-bold leading-tight">Ao aprovar, o serviço será oficialmente agendado com a forma de pagamento e valor escolhidos mediante assinatura digital.</p></div>
                                          <div className="flex flex-col gap-2">
                                              <button onClick={() => setIsSignatureModalOpen(true)} disabled={processingAction} className="w-full bg-black text-white py-4 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">{processingAction ? <Loader2 className="animate-spin" size={18} /> : <><ThumbsUp size={18} /><span>Assinar e Aprovar Orçamento</span></>}</button>
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
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {/* Service / Professional Rating Section */}
                            <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 space-y-4">
                                <div className="text-center space-y-1">
                                    <h4 className="text-base font-black text-gray-900">Avaliação do Serviço e Profissional</h4>
                                    <p className="text-[11px] text-gray-500 font-medium">Como foi o atendimento e a execução técnica?</p>
                                </div>
                                {!order.avaliacao ? (
                                    <div className="space-y-4">
                                        <div className="flex justify-center space-x-2">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button key={star} type="button" onClick={() => setRatingScore(star)} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)} className="transition-all active:scale-90">
                                                    <Star size={36} className={`${(hoverRating || ratingScore) >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                                                </button>
                                            ))}
                                        </div>
                                        <textarea value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} placeholder="Comentário sobre o profissional..." className="w-full bg-white border border-gray-200 rounded-2xl p-4 text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30 min-h-[80px] resize-none" />
                                    </div>
                                ) : (
                                    <div className="bg-white p-4 rounded-2xl border border-green-100 text-center space-y-2">
                                        <div className="flex justify-center space-x-1">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star key={star} size={20} className={star <= (order.avaliacao?.nota || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
                                            ))}
                                        </div>
                                        <p className="text-xs font-bold text-gray-700 italic">"{order.avaliacao?.comentario || 'Sem comentário'}"</p>
                                    </div>
                                )}
                            </div>

                            {/* UaiFix Platform Rating Section */}
                            <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 space-y-4">
                                <div className="text-center space-y-1">
                                    <h4 className="text-base font-black text-gray-900">Avaliação da Plataforma UaiFix</h4>
                                    <p className="text-[11px] text-gray-500 font-medium">Como foi sua experiência com o app, orçamentos e suporte?</p>
                                </div>
                                {!order.avaliacaoPlataforma ? (
                                    <div className="space-y-4">
                                        <div className="flex justify-center space-x-2">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button key={star} type="button" onClick={() => setPlatformRatingScore(star)} onMouseEnter={() => setHoverPlatformRating(star)} onMouseLeave={() => setHoverPlatformRating(0)} className="transition-all active:scale-90">
                                                    <Star size={36} className={`${(hoverPlatformRating || platformRatingScore) >= star ? 'fill-blue-500 text-blue-500' : 'text-gray-300'}`} />
                                                </button>
                                            ))}
                                        </div>
                                        <textarea value={platformRatingComment} onChange={(e) => setPlatformRatingComment(e.target.value)} placeholder="Feedback sobre a UaiFix..." className="w-full bg-white border border-gray-200 rounded-2xl p-4 text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30 min-h-[80px] resize-none" />
                                    </div>
                                ) : (
                                    <div className="bg-white p-4 rounded-2xl border border-blue-100 text-center space-y-2">
                                        <div className="flex justify-center space-x-1">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star key={star} size={20} className={star <= (order.avaliacaoPlataforma?.nota || 0) ? 'fill-blue-500 text-blue-500' : 'text-gray-200'} />
                                            ))}
                                        </div>
                                        <p className="text-xs font-bold text-gray-700 italic">"{order.avaliacaoPlataforma?.comentario || 'Sem comentário'}"</p>
                                    </div>
                                )}
                            </div>

                            {(!userOrigin || userOrigin === 'site') && (!order.avaliacao && !order.avaliacaoPlataforma) && (
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.1em] ml-1">Por onde conheceu a UAI Fix?</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['Instagram', 'Indicação', 'YouTube', 'Outro'].map(src => (
                                            <button 
                                                key={src} 
                                                onClick={() => setDiscoverySource(src)}
                                                className={`py-3 px-4 rounded-xl text-xs font-bold transition-all border ${discoverySource === src ? 'bg-ios-blue text-white border-ios-blue shadow-md' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                                            >
                                                {src}
                                            </button>
                                        ))}
                                    </div>
                                    {(discoverySource === 'Outro' || discoverySource === 'Indicação') && (
                                        <input 
                                            type="text" 
                                            placeholder={discoverySource === 'Indicação' ? "Nome, WhatsApp ou Email de quem te indicou..." : "Especifique..."}
                                            value={discoveryOther} 
                                            onChange={(e) => setDiscoveryOther(e.target.value)} 
                                            className="w-full mt-2 bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-ios-blue/30"
                                        />
                                    )}
                                </div>
                            )}

                            <p className="text-[10px] text-gray-400 text-center italic">* Você pode editar suas avaliações em até 7 dias após o envio.</p>

                            {(!order.avaliacao || !order.avaliacaoPlataforma) && (
                                <button onClick={handleSubmitRating} disabled={submittingRating || (!ratingScore && !platformRatingScore)} className="w-full bg-black text-white py-4 rounded-2xl font-bold shadow-xl flex items-center justify-center space-x-2 disabled:opacity-50">
                                    {submittingRating ? <Loader2 className="animate-spin" size={20} /> : <><Send size={18} /><span>Enviar Avaliações</span></>}
                                </button>
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

            <SignatureModal
                isOpen={isSignatureModalOpen}
                onClose={() => setIsSignatureModalOpen(false)}
                onConfirm={(sigData) => handleProposalDecision(true, '', sigData)}
                loading={processingAction}
            />

            <PrintOsModal
                isOpen={isPrintModalOpen}
                onClose={() => setIsPrintModalOpen(false)}
                osData={buildOsPrintData()}
            />
        </div>
    );
};

export default ConsumerOrderModal;
