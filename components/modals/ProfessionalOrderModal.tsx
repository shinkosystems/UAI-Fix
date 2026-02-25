
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
    X, Save, Hash, Loader2, ThumbsUp, ThumbsDown,
    Play, CheckCircle2, Star
} from 'lucide-react';
import StatusSection from './StatusSection';
import PlanningSection from './PlanningSection';
import BudgetSection from './BudgetSection';
import ConsumerTab from './ConsumerTab';
import ProfessionalTab from './ProfessionalTab';
import PaymentInfoSection from './PaymentInfoSection';
import FlexibilitySection from './FlexibilitySection';
import { User, ChamadoExtended } from '../../types';

interface ProfessionalOrderModalProps {
    order: any;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => Promise<void>;
    userRole: string;
    userUuid: string;
}

type ModalTab = 'status' | 'consumidor' | 'profissional';

const ProfessionalOrderModal: React.FC<ProfessionalOrderModalProps> = ({
    order,
    isOpen,
    onClose,
    onUpdate,
    userRole,
    userUuid
}) => {
    const [saving, setSaving] = useState(false);
    const [modalSubTab, setModalSubTab] = useState<ModalTab>('status');
    const [showBudgetForm, setShowBudgetForm] = useState(false);
    const [availableProfessionals, setAvailableProfessionals] = useState<User[]>([]);

    const [formData, setFormData] = useState({
        profissionalUuid: '',
        status: '',
        orcamentoPreco: 0,
        orcamentoCusto: 0,
        orcamentoHH: 0,
        orcamentoImposto: 0,
        orcamentoLucro: 0,
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

    const isProfessional = userRole === 'profissional';
    const isGestor = userRole === 'gestor';
    const isPlanejista = userRole === 'planejista';
    const isOrcamentista = userRole === 'orcamentista';

    useEffect(() => {
        if (order && isOpen) {
            initializeForm(order);
            if (isGestor || isPlanejista) {
                fetchProfessionals();
            }
        }
    }, [order, isOpen]);

    const toLocalISOString = (s: string) => {
        const date = new Date(s);
        const tzOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    };

    const extractInstallments = (desc: string | undefined | null) => {
        if (!desc) return 1;
        const match = desc.match(/\[PARCELAS:\s*(\d+)\]/i);
        return match ? parseInt(match[1]) : 1;
    };

    const extractFlexibility = (desc: string | undefined | null) => {
        if (!desc) return null;
        const match = desc.match(/\[FLEXIBILIDADE:\s*([^\]]+)\]/i);
        return match ? match[1].trim() : null;
    };

    const initializeForm = (ticket: any) => {
        const budget = ticket.orcamentoData || ticket.orcamentos?.[0];
        const plan = ticket.planejamentoData || ticket.planejamento?.[0];
        const status = (ticket.status || ticket.chaveData?.status || 'pendente').toLowerCase();

        const shouldShowBudget = (isGestor && status !== 'pendente') || isOrcamentista || (!!(ticket.orcamentos?.length || ticket.orcamentoData) && !isProfessional && !isPlanejista);
        setShowBudgetForm(shouldShowBudget);

        const consumerRequestedDate = plan?.execucao ? toLocalISOString(plan.execucao) : '';
        const initialVisita = plan?.visita ? toLocalISOString(plan.visita) : consumerRequestedDate;
        const consumerInstallments = extractInstallments(plan?.descricao);

        // Normalize professional identification
        let profUuid = '';
        if (ticket.profissional) {
            profUuid = typeof ticket.profissional === 'string' ? ticket.profissional : (ticket.profissional as any).uuid;
        } else if (ticket.chaveData?.profissional) {
            profUuid = typeof ticket.chaveData.profissional === 'string' ? ticket.chaveData.profissional : (ticket.chaveData.profissional as any).uuid;
        }

        setFormData({
            profissionalUuid: profUuid,
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
            fotoantes: ticket.fotoantes || ticket.chaveData?.fotoantes || [],
            fotodepois: ticket.fotodepois || ticket.chaveData?.fotodepois || [],
            agendaObs: ticket.agendaObs || ticket.agenda?.[0]?.observacoes || ticket.observacoes || ''
        });
    };

    const fetchProfessionals = async () => {
        try {
            const { data } = await supabase.from('users').select('*').eq('tipo', 'profissional').eq('ativo', true).order('nome');
            if (data) setAvailableProfessionals(data);
        } catch (error) {
            console.error('Erro ao buscar profissionais:', error);
        }
    };

    const isMediaVideo = (url: string) => {
        if (!url) return false;
        const cleanPath = url.split('?')[0].toLowerCase();
        const videoExtensions = ['.mp4', '.mov', '.webm', '.quicktime', '.m4v', '.3gp', '.mkv'];
        return videoExtensions.some(ext => cleanPath.endsWith(ext)) || url.toLowerCase().includes('video');
    };

    const extractOriginalDesc = (desc: string | undefined | null) => {
        if (!desc) return "";
        const marker = '\n\n[';
        const index = desc.indexOf(marker);
        return index !== -1 ? desc.substring(0, index).trim() : desc.trim();
    };

    const handleAccept = async () => {
        setSaving(true);
        try {
            const ticketId = order.id || order.chaveData?.id;
            await supabase.from('chaves').update({ status: 'aguardando_aprovacao' }).eq('id', ticketId);
            await onUpdate();
            onClose();
            alert('Tarefa aceita com sucesso! Aguardando aprovação do cliente.');
        } catch (error: any) {
            alert(error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleReject = async () => {
        const reason = prompt("Por favor, informe o motivo da recusa:");
        if (reason === null) return;

        setSaving(true);
        try {
            const ticketId = order.id || order.chaveData?.id;
            await supabase.from('chaves').update({
                status: 'analise',
                motivo_recusa: reason
            }).eq('id', ticketId);
            await onUpdate();
            onClose();
            alert('Tarefa recusada. O gestor será notificado para reatribuição.');
        } catch (error: any) {
            alert(error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleStartExecution = async () => {
        setSaving(true);
        try {
            const ticketId = order.id || order.chaveData?.id;
            await supabase.from('chaves').update({ status: 'executando' }).eq('id', ticketId);
            await onUpdate();
            onClose();
            alert('Execução iniciada com sucesso!');
        } catch (error: any) {
            alert(error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleFinishTask = async () => {
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
            const ticketId = order.id || order.chaveData?.id;
            const updatesChave: any = {
                status: 'concluido',
                fotoantes: formData.fotoantes,
                fotodepois: formData.fotodepois
            };

            await supabase.from('chaves').update(updatesChave).eq('id', ticketId);

            const agendaId = order.agenda?.[0]?.id || (order.execucao ? order.id : null);

            if (agendaId) {
                await supabase.from('agenda').update({ observacoes: formData.agendaObs }).eq('id', agendaId);
            } else {
                // If opening from Calendar and no agenda found in order
                const { data: agendaRecords } = await supabase.from('agenda').select('id').eq('chave', ticketId);
                if (agendaRecords && agendaRecords.length > 0) {
                    await supabase.from('agenda').update({ observacoes: formData.agendaObs }).eq('id', agendaRecords[0].id);
                } else {
                    await supabase.from('agenda').insert({
                        chave: ticketId,
                        cliente: order.cliente || order.clienteData?.uuid,
                        profissional: userUuid,
                        observacoes: formData.agendaObs,
                        execucao: new Date().toISOString()
                    });
                }
            }

            await onUpdate();
            onClose();
            alert('Tarefa concluída com sucesso!');
        } catch (error: any) {
            alert(error.message);
        } finally {
            setSaving(false);
        }
    };

    const isBudgetReadOnly = ['aprovado', 'executando', 'concluido'].includes(formData.status);

    const handleSave = async () => {
        setSaving(true);
        try {
            const ticketId = order.id || order.chaveData?.id;
            let finalStatus = formData.status;

            if ((isGestor || isPlanejista) && formData.status === 'pendente') {
                if (formData.profissionalUuid && formData.planejamentoVisita && formData.planejamentoData) {
                    finalStatus = 'analise';
                } else {
                    alert("Por favor, preencha o Profissional Responsável, Visita Técnica e Execução Prevista para enviar para orçamento.");
                    setSaving(false);
                    return;
                }
            }

            if ((isGestor || isOrcamentista) && finalStatus === 'analise') {
                if (formData.orcamentoPreco > 0) {
                    finalStatus = 'aguardando_profissional';
                }
            }

            if ((isGestor || isOrcamentista) && formData.status === 'reprovado') {
                finalStatus = 'aguardando_aprovacao';
            }

            const updatesChave: any = { status: finalStatus };
            if (isProfessional) {
                updatesChave.fotoantes = formData.fotoantes;
                updatesChave.fotodepois = formData.fotodepois;

                const agendaId = order.agenda?.[0]?.id || (order.execucao ? order.id : null);
                if (agendaId) {
                    await supabase.from('agenda').update({ observacoes: formData.agendaObs }).eq('id', agendaId);
                }
            } else if (isGestor || isPlanejista) {
                updatesChave.profissional = formData.profissionalUuid || null;
            }

            await supabase.from('chaves').update(updatesChave).eq('id', ticketId);

            if (showBudgetForm && (isGestor || isOrcamentista) && !isBudgetReadOnly) {
                const b: any = {
                    chave: ticketId,
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

                const budgetId = order.orcamentoData?.id || order.orcamentos?.[0]?.id;
                if (budgetId) {
                    await supabase.from('orcamentos').update(b).eq('id', budgetId);
                } else {
                    await supabase.from('orcamentos').insert(b);
                }
            }

            if (isGestor || isPlanejista) {
                const p: any = {
                    chave: ticketId,
                    descricao: formData.planejamentoDesc,
                    recursos: formData.planejamentoRecursos,
                    pagamento: formData.planejamentoPagamento,
                    ativo: true
                };
                if (formData.planejamentoData) p.execucao = new Date(formData.planejamentoData).toISOString();
                if (formData.planejamentoVisita) p.visita = new Date(formData.planejamentoVisita).toISOString(); else p.visita = null;

                const planId = order.planejamentoData?.id || order.planejamento?.[0]?.id;
                if (planId) {
                    await supabase.from('planejamento').update(p).eq('id', planId);
                } else {
                    await supabase.from('planejamento').insert(p);
                }
            }

            await onUpdate();
            onClose();
            const statusMsg = finalStatus !== formData.status ? ` e status atualizado para ${finalStatus.replace('_', ' ')}` : '';
            alert(`Salvo com sucesso${statusMsg}!`);
        } catch (error: any) { alert(error.message); } finally { setSaving(false); }
    };

    if (!isOpen || !order) return null;

    // Adapt order/editingItem for sub-components
    const normalizedItem: ChamadoExtended = {
        ...order,
        ...order.chaveData,
        geral: order.geral || order.geralData || order.chaveData?.geral,
        clienteData: order.clienteData || order.chaveData?.clienteData,
        profissionalData: order.profissionalData || order.chaveData?.profissionalData,
        orcamentos: order.orcamentos || (order.orcamentoData ? [order.orcamentoData] : []),
        planejamento: order.planejamento || (order.planejamentoData ? [order.planejamentoData] : []),
        agenda: order.agenda || (order.execucao ? [order] : [])
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div>
                        <h3 className="font-black text-gray-900 text-lg leading-tight">
                            {isPlanejista || (isGestor && formData.status === 'pendente') ? 'Planejamento - ' :
                                isOrcamentista || (isGestor && formData.status !== 'pendente') ? 'Orçamento - ' : ''}
                            {normalizedItem.geral?.nome}
                        </h3>
                        <div className="flex items-center mt-1">
                            <span className="bg-gray-100 text-gray-900 px-2 py-1 rounded-md text-[10px] font-black font-mono flex items-center border border-gray-200">
                                <Hash size={10} className="mr-1 opacity-50" /> {normalizedItem.chaveunica}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 transition-colors"><X size={20} /></button>
                </div>

                <div className="flex border-b border-gray-100 bg-white overflow-x-auto no-scrollbar h-14 shrink-0">
                    {(['status', 'consumidor', 'profissional'] as const).map(tab => (
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
                                editingItem={normalizedItem}
                                setShowBudgetForm={setShowBudgetForm}
                            />

                            {(isOrcamentista || (isGestor && formData.status !== 'pendente')) && (
                                <PaymentInfoSection
                                    editingItem={normalizedItem}
                                    installments={extractInstallments(normalizedItem.planejamento?.[0]?.descricao)}
                                />
                            )}

                            {(isPlanejista || (isGestor && formData.status === 'pendente')) && (
                                <FlexibilitySection
                                    flexibility={extractFlexibility(normalizedItem.planejamento?.[0]?.descricao)}
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
                                isReadOnly={isBudgetReadOnly}
                            />

                            {normalizedItem.avaliacao && (
                                <div className="bg-green-50 p-6 rounded-[2.5rem] border border-green-100 space-y-4 shadow-sm animate-in fade-in zoom-in duration-500">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-green-500 text-white rounded-xl shadow-lg">
                                                <Star size={16} fill="currentColor" />
                                            </div>
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-green-900 leading-none">Avaliação do Cliente</h4>
                                        </div>
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star
                                                    key={star}
                                                    size={14}
                                                    className={star <= normalizedItem.avaliacao!.nota ? 'text-green-500' : 'text-green-200'}
                                                    fill={star <= normalizedItem.avaliacao!.nota ? 'currentColor' : 'none'}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-white/80 p-4 rounded-2xl border border-green-100/50 text-sm font-bold text-green-900 italic leading-relaxed shadow-inner">
                                        "{normalizedItem.avaliacao?.comentario || "O cliente não deixou um comentário."}"
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {modalSubTab === 'consumidor' && (
                        <ConsumerTab
                            editingItem={normalizedItem}
                            extractOriginalDesc={extractOriginalDesc}
                            isMediaVideo={isMediaVideo}
                        />
                    )}

                    {modalSubTab === 'profissional' && (
                        <ProfessionalTab
                            formData={formData}
                            setFormData={setFormData}
                            saving={saving}
                            editingItem={normalizedItem}
                            isMediaVideo={isMediaVideo}
                        />
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 mt-auto flex gap-3">
                    <button onClick={onClose} className="flex-1 bg-white border border-gray-200 text-gray-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95">Voltar</button>

                    {isProfessional && formData.status === 'aguardando_profissional' ? (
                        <>
                            <button
                                onClick={handleReject}
                                disabled={saving}
                                className="flex-1 bg-red-50 text-red-600 border border-red-100 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                {saving ? <Loader2 className="animate-spin" size={18} /> : <span>Recusar</span>}
                            </button>
                            <button
                                onClick={handleAccept}
                                disabled={saving}
                                className="flex-[2] bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-200 flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="animate-spin" size={18} /> : <span>Aceitar Tarefa</span>}
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
                            {saving ? <Loader2 className="animate-spin" size={18} /> : (
                                <span>
                                    {(isGestor || isPlanejista) && formData.status === 'pendente'
                                        ? 'Enviar para Orçamento'
                                        : (isOrcamentista || (isGestor && formData.status !== 'pendente'))
                                            ? 'Salvar Orçamento'
                                            : 'Salvar Alterações'}
                                </span>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfessionalOrderModal;
