
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { sendWhatsappText, sendWhatsappButtons, sendWhatsappOptionList } from '../../utils/whatsapp';
import {
    X, Save, Hash, Loader2, ThumbsUp, ThumbsDown,
    Play, CheckCircle2, Star, Camera, Copy, Check, Link2
} from 'lucide-react';
import StatusSection from './StatusSection';
import PlanningSection from './PlanningSection';
import BudgetSection from './BudgetSection';
import ConsumerTab from './ConsumerTab';
import ProfessionalTab from './ProfessionalTab';
import PaymentInfoSection from './PaymentInfoSection';
import FlexibilitySection from './FlexibilitySection';
import { User, ChamadoExtended, Geral, City } from '../../types';

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
    const [allServices, setAllServices] = useState<Geral[]>([]);
    const [allCities, setAllCities] = useState<City[]>([]);

    const [isProblemModalOpen, setIsProblemModalOpen] = useState(false);
    const [problemDesc, setProblemDesc] = useState('');
    const [problemPhotoUrl, setProblemPhotoUrl] = useState<string | null>(null);
    const [problemUploading, setProblemUploading] = useState(false);

    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancelInputCode, setCancelInputCode] = useState('');
    const [codeCopied, setCodeCopied] = useState(false);

    const [formData, setFormData] = useState({
        atividade: 0 as number | string,
        cidade: 0 as number | string,
        clienteRua: '',
        clienteNumero: '',
        clienteBairro: '',
        clienteComplemento: '',
        clienteCep: '',
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
        planejamentoJustificativaData: '',
        fotoantes: [] as string[],
        fotodepois: [] as string[],
        agendaObs: '',
        motivo_recusa: '',
        relato_problema: '',
        solucao_problema: ''
    });

    const isProfessional = userRole === 'profissional';
    const isGestor = userRole === 'gestor';
    const isPlanejista = userRole === 'planejista';
    const isOrcamentista = userRole === 'orcamentista';

    useEffect(() => {
        if (isOpen) {
            fetchServicesAndCities();
        }
    }, [isOpen]);

    const fetchServicesAndCities = async () => {
        try {
            const [servRes, cityRes] = await Promise.all([
                supabase.from('geral').select('*').order('nome'),
                supabase.from('cidades').select('*').order('cidade')
            ]);
            if (servRes.data) setAllServices(servRes.data);
            if (cityRes.data) setAllCities(cityRes.data);
        } catch (err) {
            console.error('Erro ao buscar serviços/cidades:', err);
        }
    };

    const handleAtividadeCidadeChange = (newAtividade?: number | string, newCidade?: number | string) => {
        const ativ = newAtividade !== undefined ? newAtividade : formData.atividade;
        const cid = newCidade !== undefined ? newCidade : formData.cidade;
        setFormData(prev => ({
            ...prev,
            atividade: ativ,
            cidade: cid
        }));
        fetchProfessionals(ativ, cid);
    };

    const normalizeStr = (str: string) =>
        str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";

    const fetchCepData = async (cepValue: string, currentAtividade?: number | string) => {
        const cleanCep = cepValue ? cepValue.replace(/\D/g, '') : '';
        if (cleanCep.length !== 8) return;

        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const data = await response.json();
            if (!data.erro && data.localidade) {
                const rawLoc = data.localidade.trim();
                const normLoc = normalizeStr(rawLoc);

                let matchedCity: City | null = null;

                // 1. Tenta buscar no banco de dados via ilike primeiro
                const { data: dbExact } = await supabase
                    .from('cidades')
                    .select('*')
                    .ilike('cidade', `%${rawLoc}%`)
                    .limit(1);

                if (dbExact && dbExact.length > 0) {
                    matchedCity = dbExact[0];
                } else {
                    // Tenta fuzzy pelas palavras
                    const words = rawLoc.split(' ').filter(w => w.length > 3);
                    for (const w of words) {
                        const { data: dbFuzzy } = await supabase
                            .from('cidades')
                            .select('*')
                            .ilike('cidade', `%${w}%`)
                            .limit(1);
                        if (dbFuzzy && dbFuzzy.length > 0) {
                            matchedCity = dbFuzzy[0];
                            break;
                        }
                    }
                }

                // 2. Se não achou por ilike, tenta no array local
                if (!matchedCity && allCities.length > 0) {
                    matchedCity = allCities.find(c => {
                        const normC = normalizeStr(c.cidade);
                        return normC === normLoc || normC.includes(normLoc) || normLoc.includes(normC);
                    }) || null;
                }

                if (matchedCity) {
                    const foundCity = matchedCity;

                    // CRUCIAL: Garante que a cidade encontrada esteja presente no array allCities
                    // para que o elemento <select> consiga renderizar a <option> correspondente!
                    setAllCities(prev => {
                        if (!prev.some(c => c.id === foundCity.id)) {
                            return [...prev, foundCity].sort((a, b) => a.cidade.localeCompare(b.cidade));
                        }
                        return prev;
                    });

                    setFormData(prev => ({
                        ...prev,
                        cidade: foundCity.id,
                        clienteRua: data.logradouro || prev.clienteRua,
                        clienteBairro: data.bairro || prev.clienteBairro
                    }));

                    const ativ = currentAtividade !== undefined ? currentAtividade : formData.atividade;
                    fetchProfessionals(ativ, foundCity.id);
                } else {
                    setFormData(prev => ({
                        ...prev,
                        clienteRua: data.logradouro || prev.clienteRua,
                        clienteBairro: data.bairro || prev.clienteBairro
                    }));
                }
            }
        } catch (err) {
            console.error("Erro ao buscar CEP:", err);
        }
    };

    const ensureCityInList = async (cityId: number | string) => {
        if (!cityId) return;
        const idNum = typeof cityId === 'string' ? parseInt(cityId) : cityId;
        if (isNaN(idNum) || idNum <= 0) return;

        const { data: dbCity } = await supabase.from('cidades').select('*').eq('id', idNum).maybeSingle();
        if (dbCity) {
            setAllCities(prev => {
                if (!prev.some(c => c.id === dbCity.id)) {
                    return [...prev, dbCity].sort((a, b) => a.cidade.localeCompare(b.cidade));
                }
                return prev;
            });
        }
    };

    useEffect(() => {
        if (order && isOpen) {
            initializeForm(order);
            const clientUser = order.clienteData || order.chaveData?.clienteData;
            const atividadeId = order.atividade || order.chaveData?.atividade;
            const cidadeId = order.cidade || order.chaveData?.cidade || clientUser?.cidade;
            const clientCep = clientUser?.cep;

            if (cidadeId) {
                ensureCityInList(cidadeId);
            }

            if (isGestor || isPlanejista) {
                fetchProfessionals(atividadeId, cidadeId);
            }

            if (clientCep) {
                fetchCepData(clientCep, atividadeId);
            }
        }
    }, [order, isOpen]);

    useEffect(() => {
        if (['aprovado', 'executando', 'concluido'].includes(formData.status)) return;
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

    const toLocalISOString = (s: string) => {
        const date = new Date(s);
        const tzOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
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

    const extractInstallments = (desc: string | undefined | null) => {
        const val = extractMetadata(desc, "[PARCELAMENTO DESEJADO]:");
        if (!val) return 1;
        const num = parseInt(val.replace(/\D/g, ''));
        return isNaN(num) ? 1 : num;
    };

    const extractFlexibility = (desc: string | undefined | null) => extractMetadata(desc, "[FLEXIBILIDADE DE AGENDA]:");

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

        const clientUser = ticket.clienteData || ticket.chaveData?.clienteData;
        const atividadeId = ticket.atividade || ticket.chaveData?.atividade || 0;
        const cidadeId = ticket.cidade || ticket.chaveData?.cidade || clientUser?.cidade || 0;
        const clientCep = clientUser?.cep || '';

        const isOriginatedFromCanceled = !!(ticket.chave_vinculada_codigo || ticket.chaveData?.chave_vinculada_codigo);
        const relato = ticket.relato_problema || ticket.chaveData?.relato_problema;
        const effectiveDesc = isOriginatedFromCanceled && relato ? relato : (plan?.descricao || '');

        setFormData({
            atividade: atividadeId,
            cidade: cidadeId,
            clienteRua: clientUser?.rua || '',
            clienteNumero: clientUser?.numero || '',
            clienteBairro: clientUser?.bairro || '',
            clienteComplemento: clientUser?.complemento || '',
            clienteCep: clientCep,
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
            planejamentoDesc: effectiveDesc,
            planejamentoData: consumerRequestedDate,
            planejamentoRecursos: plan?.recursos || [],
            planejamentoPagamento: plan?.pagamento || 'Dinheiro',
            planejamentoVisita: initialVisita,
            planejamentoJustificativaData: plan?.justificativa_data_diferente || '',
            fotoantes: ticket.fotoantes || ticket.chaveData?.fotoantes || [],
            fotodepois: ticket.fotodepois || ticket.chaveData?.fotodepois || [],
            agendaObs: ticket.agendaObs || ticket.agenda?.[0]?.observacoes || ticket.observacoes || '',
            motivo_recusa: ticket.motivo_recusa || ticket.chaveData?.motivo_recusa || '',
            relato_problema: ticket.relato_problema || ticket.chaveData?.relato_problema || '',
            solucao_problema: ticket.solucao_problema || ticket.chaveData?.solucao_problema || '',
            foto_problema: ticket.foto_problema || ticket.chaveData?.foto_problema || null
        });

        if ((!cidadeId || cidadeId === 0) && clientCep) {
            fetchCepData(clientCep, atividadeId);
        }
    };

    const fetchProfessionals = async (atividadeId?: number | string, cidadeId?: number | string) => {
        try {
            let query = supabase.from('users').select('*').ilike('tipo', 'profissional').eq('ativo', true);

            if (atividadeId) {
                const id = typeof atividadeId === 'string' ? parseInt(atividadeId) : atividadeId;
                if (!isNaN(id)) {
                    query = query.contains('atividade', [id]);
                }
            }

            if (cidadeId) {
                const cid = typeof cidadeId === 'string' ? parseInt(cidadeId) : cidadeId;
                if (!isNaN(cid)) {
                    query = query.eq('cidade', cid);
                }
            }

            const { data } = await query.order('nome');
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

    const sendBudgetButtons = async (phone: string, data: any, ticketId: string) => {
        const precoStr = data.orcamentoPreco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        let paymentInfo = `Forma de Pagamento: ${data.orcamentoTipoPgto || 'Dinheiro'}`;
        let hasSuggested = false;
        let suggestedVal = data.orcamentoPreco;
        let suggestedMethod = data.orcamentoTipoPgto;

        if (data.orcamentoTipoPgtoSugerido) {
             paymentInfo = `Forma de Pagamento Sugerida: ${data.orcamentoTipoPgtoSugerido}`;
             suggestedMethod = data.orcamentoTipoPgtoSugerido;
             if (data.orcamentoTipoPgtoSugerido !== data.orcamentoTipoPgto) hasSuggested = true;
        }
        
        let descText = "";
        if (data.orcamentoDescontoSugerido > 0) {
            hasSuggested = true;
            const pct = data.orcamentoDescontoSugerido;
            const discountAmount = data.orcamentoPreco * (pct / 100);
            suggestedVal = data.orcamentoPreco - discountAmount;
            const val = suggestedVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            descText = `\nDesconto Sugerido: ${pct}%\nValor Atualizado: ${val}`;
        }

        let justText = "";
        if (data.orcamentoJustificativaSugerido) {
            justText = `\nJustificativa da Sugestão: ${data.orcamentoJustificativaSugerido}`;
        }

        const text = `Seu orçamento está pronto!\n\nValor Original: ${precoStr}\n${paymentInfo}${descText}${justText}\n\nVocê aceita o orçamento?`;
        
        const getButtonText = (method: string, val: number) => {
            let abbrev = (method || '').replace('Cartão de ', '').replace('Dinheiro', 'Dinh');
            if (abbrev.length > 7) abbrev = abbrev.substring(0, 7);
            const valStr = val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            let btn = `${abbrev}(${valStr})`;
            if (btn.length > 20) btn = `${abbrev.substring(0,3)}(${valStr})`;
            return btn.substring(0, 20);
        };

        const buttons = [];
        if (hasSuggested) {
            buttons.push({ id: `ACEITAR_SUG_${ticketId}`, label: getButtonText(suggestedMethod, suggestedVal) });
            buttons.push({ id: `ACEITAR_ORIG_${ticketId}`, label: getButtonText(data.orcamentoTipoPgto, data.orcamentoPreco) });
        } else {
            buttons.push({ id: `ACEITAR_ORIG_${ticketId}`, label: getButtonText(data.orcamentoTipoPgto, data.orcamentoPreco) });
        }
        buttons.push({ id: `RECUSAR_${ticketId}`, label: "Recusar" });

        await sendWhatsappButtons(
            phone,
            text,
            "Orçamento - UaiFix",
            "Responda nos botões abaixo",
            buttons
        );
    };

    const handleAccept = async () => {
        setSaving(true);
        try {
            const ticketId = order.chaveData?.id || order.chave || order.id;
            await supabase.from('chaves').update({ status: 'aguardando_aprovacao' }).eq('id', ticketId);
            
            const clientPhone = normalizedItem.clienteData?.whatsapp;
            if (clientPhone) {
                await sendBudgetButtons(clientPhone, formData, ticketId);
            }
            
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
            const ticketId = order.chaveData?.id || order.chave || order.id;
            await supabase.from('chaves').update({
                status: 'pendente',
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
            const ticketId = order.chaveData?.id || order.chave || order.id;
            await supabase.from('chaves').update({ status: 'executando' }).eq('id', ticketId);
            
            const clientPhone = normalizedItem?.clienteData?.whatsapp;
            if (clientPhone) {
                const msg = `O profissional responsável pelo seu chamado acaba de iniciar a execução do serviço! 🚀\n\nQualquer dúvida, estamos à disposição.`;
                await sendWhatsappText(clientPhone, msg);
            }

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
            const ticketId = order.chaveData?.id || order.chave || order.id;
            const updatesChave: any = {
                status: 'aguardando_gestor',
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

            // WhatsApp Notification for Conclusion
            const clientPhone = normalizedItem.clienteData?.whatsapp;
            const isWhatsappOS = normalizedItem.planejamento?.some((p: any) => p.descricao?.includes('WHATSAPP'));
            
            if (clientPhone) {
                if (isWhatsappOS) {
                    const title = `Serviço Concluído! ✅`;
                    const text = `Como você avalia o serviço prestado pelo nosso profissional?\n\nSua opinião é muito importante para mantermos a qualidade do nosso atendimento!`;
                    const btnLabel = "Avaliar Serviço";
                    const options = [
                        { id: `AVALIAR_5_${ticketId}`, title: "5 Estrelas", description: "Excelente" },
                        { id: `AVALIAR_4_${ticketId}`, title: "4 Estrelas", description: "Muito Bom" },
                        { id: `AVALIAR_3_${ticketId}`, title: "3 Estrelas", description: "Bom" },
                        { id: `AVALIAR_2_${ticketId}`, title: "2 Estrelas", description: "Ruim" },
                        { id: `AVALIAR_1_${ticketId}`, title: "1 Estrela", description: "Péssimo" },
                        { id: `AVALIAR_0_${ticketId}`, title: "0 Estrelas", description: "Inaceitável" }
                    ];
                    await sendWhatsappOptionList(clientPhone, text, title, btnLabel, options);
                } else {
                    const msg = `Seu serviço foi concluído com sucesso! ✅\n\nGostaríamos muito de saber como foi sua experiência. Por favor, acesse a plataforma UaiFix para avaliar o serviço prestado pelo profissional.\n\nSua opinião é muito importante para mantermos a qualidade do nosso atendimento!`;
                    await sendWhatsappText(clientPhone, msg);
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

    const handleRelatarProblema = async () => {
        const relato = prompt("Descreva o problema encontrado:");
        if (!relato || relato.trim() === '') return;

        setSaving(true);
        try {
            const ticketId = order.chaveData?.id || order.chave || order.id;
            await supabase.from('chaves').update({
                status: 'erro',
                relato_problema: relato.trim()
            }).eq('id', ticketId);
            
            await onUpdate();
            onClose();
            alert('Problema relatado com sucesso! O status foi alterado para ERRO!');
        } catch (error: any) {
            alert(error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleFileUploadProblem = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        
        if (file.size > 50 * 1024 * 1024) {
            alert('O arquivo é maior que 50MB.');
            return;
        }

        setProblemUploading(true);
        try {
            const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
            const ticketId = order.chaveData?.chaveunica || order.chaveunica || 'ticket';
            const path = `problemas/${ticketId}_problema_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage.from('imagens').upload(path, file, {
                contentType: file.type || undefined
            });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('imagens').getPublicUrl(path);
            setProblemPhotoUrl(data.publicUrl);
        } catch (error: any) {
            console.error('Erro no upload da foto do problema:', error);
            alert(`Erro ao carregar arquivo: ${error.message}`);
        } finally {
            setProblemUploading(false);
        }
    };

    const handleProfessionalRelatarProblema = async () => {
        if (!problemDesc || problemDesc.trim().length < 5) {
            alert("A descrição do problema é obrigatória e deve ter pelo menos 5 caracteres.");
            return;
        }

        setSaving(true);
        try {
            const ticketId = order.chaveData?.id || order.chave || order.id;
            const updates: any = {
                status: 'erro',
                relato_problema: problemDesc.trim()
            };
            if (problemPhotoUrl) {
                updates.foto_problema = problemPhotoUrl;
            }

            const { data, error: updateError } = await supabase.from('chaves').update(updates).eq('id', ticketId).select();
            if (updateError) throw updateError;
            if (!data || data.length === 0) {
                throw new Error("Falha ao atualizar: Você pode não ter permissão (RLS) ou o chamado não existe.");
            }
            
            // Atualiza o estado local para a UI refletir a mudança imediatamente
            setFormData(prev => ({
                ...prev,
                status: 'erro',
                relato_problema: problemDesc.trim(),
                foto_problema: problemPhotoUrl || prev.foto_problema
            }));

            // Enviar notificação WhatsApp para o Cliente
            const clientPhone = normalizedItem?.clienteData?.whatsapp;
            const serviceName = normalizedItem?.geral?.nome || 'Serviço';
            const ticketCode = normalizedItem?.chaveunica || ticketId;

            if (clientPhone) {
                const msgCliente = `Olá! Notificamos que ocorreu um imprevisto durante a execução do seu serviço (${serviceName} - #${ticketCode}). ⚠️\n\nNossa equipe de gestão já foi comunicada imediatamente e entrará em contato para alinhar os próximos passos e resolver a situação o mais rápido possível.`;
                await sendWhatsappText(clientPhone, msgCliente);
            }

            // Enviar notificação WhatsApp para o Gestor Responsável
            try {
                let gestorUuid = order.gestor_responsavel || order.chaveData?.gestor_responsavel;

                if (!gestorUuid) {
                    const { data: freshChave } = await supabase
                        .from('chaves')
                        .select('gestor_responsavel')
                        .eq('id', ticketId)
                        .maybeSingle();
                    if (freshChave?.gestor_responsavel) {
                        gestorUuid = freshChave.gestor_responsavel;
                    }
                }

                let targetGestor: { whatsapp?: string; nome?: string } | null = null;

                if (gestorUuid) {
                    const { data: gUser } = await supabase
                        .from('users')
                        .select('whatsapp, nome')
                        .eq('uuid', gestorUuid)
                        .maybeSingle();
                    if (gUser && gUser.whatsapp) {
                        targetGestor = gUser;
                    }
                }

                // Fallback: se ainda não houver gestor responsável vinculado, busca o primeiro gestor cadastrado
                if (!targetGestor) {
                    const { data: gestores } = await supabase
                        .from('users')
                        .select('whatsapp, nome')
                        .eq('tipo', 'gestor')
                        .limit(1);
                    if (gestores && gestores.length > 0 && gestores[0].whatsapp) {
                        targetGestor = gestores[0];
                    }
                }

                if (targetGestor?.whatsapp) {
                    const profName = normalizedItem?.profissionalData?.nome || 'Profissional';
                    const msgGestor = `🚨 *ALERTA DE PROBLEMA EM SERVIÇO* 🚨\n\n` +
                        `*Chamado:* #${ticketCode} - ${serviceName}\n` +
                        `*Profissional:* ${profName}\n` +
                        `*Relato do Problema:* "${problemDesc.trim()}"\n\n` +
                        `Acesse a plataforma UaiFix para verificar os detalhes e adotar a solução.`;

                    await sendWhatsappText(targetGestor.whatsapp, msgGestor);
                }
            } catch (gErr) {
                console.error("Erro ao notificar gestor responsável via WhatsApp:", gErr);
            }

            await onUpdate();
            onClose();
            setIsProblemModalOpen(false);
            setProblemDesc('');
            setProblemPhotoUrl(null);
            alert('Problema relatado com sucesso! O status foi alterado para ERRO!');
        } catch (error: any) {
            alert(error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCopyCode = () => {
        const targetCode = normalizedItem?.chaveunica || order.chaveunica || '';
        if (targetCode) {
            navigator.clipboard.writeText(targetCode);
            setCodeCopied(true);
            setTimeout(() => setCodeCopied(false), 2000);
        }
    };

    const handleGestorCancelService = async () => {
        const ticketId = order.chaveData?.id || order.chave || order.id;
        const targetCode = (normalizedItem?.chaveunica || order.chaveunica || '').trim().toUpperCase();
        if (cancelInputCode.trim().toUpperCase() !== targetCode) {
            alert("O código único inserido é incorreto.");
            return;
        }

        setSaving(true);
        try {
            const updates: any = { status: 'cancelado' };

            const currentGestor = order.gestor_responsavel || order.chaveData?.gestor_responsavel;
            if (isGestor && userUuid && !currentGestor) {
                updates.gestor_responsavel = userUuid;
            }

            const { data, error: updateError } = await supabase.from('chaves').update(updates).eq('id', ticketId).select();
            if (updateError) throw updateError;

            // Enviar notificação WhatsApp para o Cliente informando sobre o cancelamento
            const clientPhone = normalizedItem?.clienteData?.whatsapp;
            const serviceName = normalizedItem?.geral?.nome || 'Serviço';
            if (clientPhone) {
                const msgCliente = `Olá! Informamos que o seu chamado (${serviceName} - #${targetCode}) foi cancelado pelo gestor. Se precisar de ajuda ou tiver dúvidas, estamos à disposição!`;
                await sendWhatsappText(clientPhone, msgCliente);
            }

            await onUpdate();
            setIsCancelModalOpen(false);
            setCancelInputCode('');
            onClose();
            alert('Serviço cancelado com sucesso!');
        } catch (error: any) {
            alert(error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleGestorOpenLinkedService = async () => {
        const ticketId = order.chaveData?.id || order.chave || order.id;
        const targetCode = (normalizedItem?.chaveunica || order.chaveunica || '').trim().toUpperCase();
        if (cancelInputCode.trim().toUpperCase() !== targetCode) {
            alert("O código único inserido é incorreto.");
            return;
        }

        setSaving(true);
        try {
            const newUniqueKey = Math.random().toString(36).substring(2, 10).toUpperCase();
            const currentGestorUuid = userUuid || order.gestor_responsavel || order.chaveData?.gestor_responsavel || null;

            const oldPlan = normalizedItem.planejamento?.[0] || order.planejamentoData || order.planejamento?.[0];
            const oldRelato = normalizedItem.relato_problema || order.relato_problema;
            const oldFotoProblema = normalizedItem.foto_problema || order.foto_problema;

            const newDesc = oldRelato ? oldRelato : (oldPlan?.descricao || '');
            const newImagemPedido = oldFotoProblema || oldPlan?.imagem_pedido || null;

            // 1. Criar a nova Chave (OS) pre-preenchida e vinculada
            const { data: newChaveData, error: newChaveError } = await supabase
                .from('chaves')
                .insert({
                    cliente: normalizedItem.cliente || order.cliente,
                    atividade: normalizedItem.atividade || order.atividade,
                    cidade: normalizedItem.cidade || order.cidade,
                    gestor_responsavel: currentGestorUuid,
                    status: 'pendente',
                    chaveunica: newUniqueKey,
                    relato_problema: oldRelato || null,
                    foto_problema: oldFotoProblema || null,
                    fotoantes: [],
                    fotodepois: [],
                    whatsapp_chat_id: normalizedItem.whatsapp_chat_id || order.whatsapp_chat_id || null,
                    whatsapp_lead_cpf: normalizedItem.whatsapp_lead_cpf || order.whatsapp_lead_cpf || null,
                    chave_vinculada_id: ticketId,
                    chave_vinculada_codigo: targetCode
                })
                .select()
                .single();

            if (newChaveError) throw newChaveError;

            // 2. Copiar dados de planejamento da OS antiga para a nova OS
            await supabase.from('planejamento').insert({
                chave: newChaveData.id,
                descricao: newDesc,
                imagem_pedido: newImagemPedido,
                audio_pedido: oldPlan?.audio_pedido || null,
                recursos: oldPlan?.recursos || [],
                pagamento: oldPlan?.pagamento || 'Dinheiro',
                execucao: oldPlan?.execucao || null,
                visita: oldPlan?.visita || null,
                justificativa_data_diferente: oldPlan?.justificativa_data_diferente || null,
                ativo: true
            });

            // 3. Atualizar a OS antiga para 'cancelado' e vincular à nova OS
            const oldUpdates: any = {
                status: 'cancelado',
                chave_vinculada_id: newChaveData.id,
                chave_vinculada_codigo: newUniqueKey
            };
            if (isGestor && userUuid && (!order.gestor_responsavel && !order.chaveData?.gestor_responsavel)) {
                oldUpdates.gestor_responsavel = userUuid;
            }

            const { error: oldUpdateError } = await supabase
                .from('chaves')
                .update(oldUpdates)
                .eq('id', ticketId);

            if (oldUpdateError) throw oldUpdateError;

            // 4. Enviar mensagem via WhatsApp para o cliente
            const clientPhone = normalizedItem?.clienteData?.whatsapp;
            const serviceName = normalizedItem?.geral?.nome || 'Serviço';
            if (clientPhone) {
                const msgCliente = `Olá! Notificamos que o seu chamado #${targetCode} (${serviceName}) foi cancelado pelo gestor. Abrimos um novo chamado vinculado (#${newUniqueKey}) para dar continuidade ao serviço desde a etapa de planejamento. Em breve você receberá novos detalhes!`;
                await sendWhatsappText(clientPhone, msgCliente);
            }

            await onUpdate();
            setIsCancelModalOpen(false);
            setCancelInputCode('');
            onClose();
            alert(`Serviço #${targetCode} cancelado e novo serviço vinculado #${newUniqueKey} aberto com sucesso!`);
        } catch (error: any) {
            alert(`Erro ao abrir serviço vinculado: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleGestorFinalize = async (actionType: 'concluido' | 'concluido_from_erro') => {
        if (actionType === 'concluido_from_erro' && (!formData.solucao_problema || formData.solucao_problema.trim().length < 5)) {
            alert("É obrigatório preencher a solução do problema antes de concluir.");
            return;
        }

        setSaving(true);
        try {
            const ticketId = order.chaveData?.id || order.chave || order.id;
            const updates: any = { status: 'concluido' };
            if (actionType === 'concluido_from_erro') {
                updates.solucao_problema = formData.solucao_problema.trim();
            }

            const currentGestor = order.gestor_responsavel || order.chaveData?.gestor_responsavel;
            if (isGestor && userUuid && !currentGestor) {
                updates.gestor_responsavel = userUuid;
            }

            await supabase.from('chaves').update(updates).eq('id', ticketId);
            
            // Enviar notificação de conclusão para o cliente
            const clientPhone = normalizedItem.clienteData?.whatsapp;
            const isWhatsappOS = normalizedItem.planejamento?.some((p: any) => p.descricao?.includes('WHATSAPP'));
            
            if (clientPhone) {
                if (isWhatsappOS) {
                    const title = `Serviço Concluído! ✅`;
                    const text = `Como você avalia o serviço prestado pelo nosso profissional?\n\nSua opinião é muito importante para mantermos a qualidade do nosso atendimento!`;
                    const btnLabel = "Avaliar Serviço";
                    const options = [
                        { id: `AVALIAR_5_${ticketId}`, title: "5 Estrelas", description: "Excelente" },
                        { id: `AVALIAR_4_${ticketId}`, title: "4 Estrelas", description: "Muito Bom" },
                        { id: `AVALIAR_3_${ticketId}`, title: "3 Estrelas", description: "Bom" },
                        { id: `AVALIAR_2_${ticketId}`, title: "2 Estrelas", description: "Ruim" },
                        { id: `AVALIAR_1_${ticketId}`, title: "1 Estrela", description: "Péssimo" },
                        { id: `AVALIAR_0_${ticketId}`, title: "0 Estrelas", description: "Inaceitável" }
                    ];
                    await sendWhatsappOptionList(clientPhone, text, title, btnLabel, options);
                } else {
                    const msg = `Seu serviço foi concluído com sucesso! ✅\n\nGostaríamos muito de saber como foi sua experiência. Por favor, acesse a plataforma UaiFix para avaliar o serviço prestado pelo profissional.\n\nSua opinião é muito importante para mantermos a qualidade do nosso atendimento!`;
                    await sendWhatsappText(clientPhone, msg);
                }
            }

            await onUpdate();
            onClose();
            alert('Serviço concluído com sucesso!');
        } catch (error: any) {
            alert(error.message);
        } finally {
            setSaving(false);
        }
    };

    const isBudgetReadOnly = ['aprovado', 'executando', 'concluido', 'aguardando_gestor', 'erro'].includes(formData.status);

    const handleSave = async () => {
        setSaving(true);
        try {
            const ticketId = order.chaveData?.id || order.chave || order.id;

            if (formData.planejamentoVisita && formData.planejamentoData) {
                const v = new Date(formData.planejamentoVisita);
                const e = new Date(formData.planejamentoData);
                if (v > e) {
                    alert("A data da Visita Técnica não pode ser posterior à data de Execução Prevista.");
                    setSaving(false);
                    return;
                }
            }

            let finalStatus = formData.status;

            if ((isGestor || isPlanejista) && formData.status === 'pendente') {
                if (formData.profissionalUuid && formData.planejamentoVisita && formData.planejamentoData) {
                    finalStatus = 'analise';
                } else {
                    alert("Por favor, preencha o Profissional Responsável, Visita Técnica e Execução Prevista para enviar para orçamento.");
                    setSaving(false);
                    return;
                }
            } else if ((isGestor || isOrcamentista) && formData.status === 'analise') {
                if (formData.orcamentoPreco > 0) {
                    finalStatus = 'aguardando_profissional';
                }
            } else if ((isGestor || isOrcamentista) && (formData.status === 'recusado' || formData.status === 'reprovado')) {
                const originalHH = order.orcamentoData?.hh || order.orcamentos?.[0]?.hh || 0;
                const hasHHChanged = Math.abs(originalHH - formData.orcamentoHH) > 0.01;
                finalStatus = hasHHChanged ? 'aguardando_profissional' : 'aguardando_aprovacao';
            }

            const updatesChave: any = { status: finalStatus };
            if (formData.atividade) {
                updatesChave.atividade = typeof formData.atividade === 'string' ? parseInt(formData.atividade) : formData.atividade;
            }
            if (formData.cidade) {
                updatesChave.cidade = typeof formData.cidade === 'string' ? parseInt(formData.cidade) : formData.cidade;
            }

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

            const currentGestor = order.gestor_responsavel || order.chaveData?.gestor_responsavel;
            if (isGestor && userUuid && !currentGestor) {
                updatesChave.gestor_responsavel = userUuid;
            }

            await supabase.from('chaves').update(updatesChave).eq('id', ticketId);

            // Atualiza endereço do cliente se for gestor/planejista
            const clientUuid = normalizedItem.cliente || order.cliente || normalizedItem.clienteData?.uuid;
            if (clientUuid && (isGestor || isPlanejista)) {
                const clientUpdates: any = {
                    rua: formData.clienteRua,
                    numero: formData.clienteNumero,
                    bairro: formData.clienteBairro,
                    complemento: formData.clienteComplemento,
                    cep: formData.clienteCep
                };
                if (formData.cidade) {
                    clientUpdates.cidade = typeof formData.cidade === 'string' ? parseInt(formData.cidade) : formData.cidade;
                }
                await supabase.from('users').update(clientUpdates).eq('uuid', clientUuid);
            }

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
                p.justificativa_data_diferente = formData.planejamentoJustificativaData || null;

                const planId = order.planejamentoData?.id || order.planejamento?.[0]?.id;
                if (planId) {
                    await supabase.from('planejamento').update(p).eq('id', planId);
                } else {
                    await supabase.from('planejamento').insert(p);
                }
            }

            // WhatsApp Notifications
            const clientPhone = normalizedItem.clienteData?.whatsapp;
            const formatBRDate = (d: string) => {
                if (!d) return '';
                return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            };

            if (clientPhone) {
                if (formData.status === 'pendente' && finalStatus === 'analise') {
                    const profName = availableProfessionals.find(prof => prof.uuid === formData.profissionalUuid)?.nome || 'um de nossos profissionais';
                    let justText = '';
                    if (formData.planejamentoJustificativaData) {
                        justText = `\nJustificativa de Agendamento: ${formData.planejamentoJustificativaData}\n`;
                    }
                    const msg = `Olá, seu chamado foi planejado!\n\nProfissional Alocado: ${profName}\nVisita Técnica: ${formatBRDate(formData.planejamentoVisita)}\nExecução Prevista: ${formatBRDate(formData.planejamentoData)}\n${justText}\nO seu chamado agora foi enviado para o setor de orçamento. Em breve você receberá os valores.`;
                    await sendWhatsappText(clientPhone, msg);
                } else if ((formData.status === 'recusado' || formData.status === 'reprovado') && finalStatus === 'aguardando_aprovacao') {
                    await sendBudgetButtons(clientPhone, formData, ticketId);
                } else if (formData.status !== 'concluido' && finalStatus === 'concluido') {
                    const msg = `Seu serviço foi concluído com sucesso! ✅\n\nGostaríamos muito de saber como foi sua experiência. Por favor, acesse a plataforma UaiFix para avaliar o serviço prestado pelo profissional.\n\nSua opinião é muito importante para mantermos a qualidade do nosso atendimento!`;
                    await sendWhatsappText(clientPhone, msg);
                }
            }

            if (finalStatus === 'aguardando_profissional' && formData.status !== 'aguardando_profissional') {
                const prof = availableProfessionals.find(p => p.uuid === formData.profissionalUuid);
                if (prof?.whatsapp) {
                    const msgProf = `Olá, ${prof.nome || 'Profissional'}! 🔧\n\nVocê tem um novo serviço com ACEITE PENDENTE no sistema da UaiFix.\n\nAcesse a plataforma para visualizar os detalhes e confirmar a sua disponibilidade.`;
                    await sendWhatsappText(prof.whatsapp, msgProf);
                }
            }
            await onUpdate();
            onClose();
            const statusMsg = finalStatus !== formData.status ? ` e status atualizado para ${finalStatus.replace('_', ' ')}` : '';
            alert(`Salvo com sucesso${statusMsg}!`);
        } catch (error: any) { alert(error.message);        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        // Only managers (gestor) can change status freely like this based on the UI
        if (!isGestor && !isOrcamentista && !isPlanejista) return;
        
        setSaving(true);
        try {
            const ticketId = order.chaveData?.id || order.chave || order.id;
            const updates: any = { status: newStatus };

            const currentGestor = order.gestor_responsavel || order.chaveData?.gestor_responsavel;
            if (isGestor && userUuid && !currentGestor) {
                updates.gestor_responsavel = userUuid;
            }

            await supabase.from('chaves').update(updates).eq('id', ticketId);
            await onUpdate();
        } catch (error: any) {
            console.error('Erro ao atualizar status automaticamente:', error);
        } finally {
            setSaving(false);
        }
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
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="bg-gray-100 text-gray-900 px-2 py-1 rounded-md text-[10px] font-black font-mono flex items-center border border-gray-200">
                                <Hash size={10} className="mr-1 opacity-50" /> {normalizedItem.chaveunica}
                            </span>
                            {normalizedItem.chave_vinculada_codigo && (
                                <span
                                    className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[10px] font-black font-mono flex items-center border border-blue-200"
                                    title="Serviço vinculado"
                                >
                                    <Link2 size={10} className="mr-1 text-blue-600" /> #{normalizedItem.chave_vinculada_codigo}
                                </span>
                            )}
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
                                isPlanejista={isPlanejista}
                                isProfessional={isProfessional}
                                editingItem={normalizedItem}
                                setShowBudgetForm={setShowBudgetForm}
                                onStatusChange={handleStatusChange}
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
                                allServices={allServices}
                                allCities={allCities}
                                onAtividadeCidadeChange={handleAtividadeCidadeChange}
                                onCepLookup={(cep) => fetchCepData(cep, formData.atividade)}
                                isGestor={isGestor}
                                isPlanejista={isPlanejista}
                                hasLinkedService={!!normalizedItem.chave_vinculada_codigo}
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
                            isReadOnly={isGestor || isPlanejista}
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
                    ) : isProfessional && formData.status === 'aguardando_aprovacao' ? (
                        <button
                            disabled
                            className="flex-[2] bg-[#D4E2DC] text-[#4B685A] py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex justify-center items-center gap-2 cursor-not-allowed shadow-none"
                        >
                            <CheckCircle2 size={18} /><span>Aceito</span>
                        </button>
                    ) : isProfessional && formData.status === 'aprovado' ? (
                        <button
                            onClick={handleStartExecution}
                            disabled={saving}
                            className="flex-[2] bg-ios-blue text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200 flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="animate-spin" size={18} /> : <><Play size={18} /><span>Iniciar Execução</span></>}
                        </button>
                    ) : isProfessional && formData.status === 'executando' ? (
                        <>
                            <button
                                onClick={() => setIsProblemModalOpen(true)}
                                disabled={saving}
                                className="flex-1 bg-red-50 text-red-600 border border-red-100 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                {saving ? <Loader2 className="animate-spin" size={18} /> : <span>Relatar Problema</span>}
                            </button>
                            <button
                                onClick={handleFinishTask}
                                disabled={saving || formData.fotoantes.length === 0 || formData.fotodepois.length === 0 || !formData.agendaObs || formData.agendaObs.trim().length < 5}
                                className="flex-[2] bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-200 flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-30 disabled:grayscale-[0.5] disabled:cursor-not-allowed"
                            >
                                {saving ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle2 size={18} /><span>Finalizar Tarefa</span></>}
                            </button>
                        </>
                    ) : isGestor && formData.status === 'aguardando_gestor' ? (
                        <>
                            <button
                                onClick={handleRelatarProblema}
                                disabled={saving}
                                className="flex-1 bg-red-50 text-red-600 border border-red-100 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                {saving ? <Loader2 className="animate-spin" size={18} /> : <span>Relatar Problema</span>}
                            </button>
                            <button
                                onClick={() => handleGestorFinalize('concluido')}
                                disabled={saving}
                                className="flex-[2] bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-200 flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="animate-spin" size={18} /> : <span>Concluir Revisão</span>}
                            </button>
                        </>
                    ) : isGestor && formData.status === 'erro' ? (
                        <>
                            <button
                                onClick={() => setIsCancelModalOpen(true)}
                                disabled={saving}
                                className="flex-1 bg-red-50 text-red-600 border border-red-100 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                {saving ? <Loader2 className="animate-spin" size={18} /> : <span>Cancelar Serviço</span>}
                            </button>
                            <button
                                onClick={() => handleGestorFinalize('concluido_from_erro')}
                                disabled={saving || !formData.solucao_problema || formData.solucao_problema.trim().length < 5}
                                className="flex-[2] bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-200 flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-30 disabled:grayscale-[0.5] disabled:cursor-not-allowed"
                            >
                                {saving ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle2 size={18} /><span>Concluir Serviço</span></>}
                            </button>
                        </>
                    ) : formData.status === 'concluido' ? (
                        <button disabled className="flex-[2] bg-gray-200 text-gray-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex justify-center items-center gap-2 cursor-not-allowed">
                            <CheckCircle2 size={18} /><span>Concluído</span>
                        </button>
                    ) : formData.status === 'aprovado' ? (
                        <button disabled className="flex-[2] bg-gray-200 text-gray-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex justify-center items-center gap-2 cursor-not-allowed">
                            <CheckCircle2 size={18} /><span>Aguardando Execução</span>
                        </button>
                    ) : (
                        <button onClick={handleSave} disabled={saving} className="flex-[2] bg-black text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                            {saving ? <Loader2 className="animate-spin" size={18} /> : (
                                <span>
                                    {(isGestor || isPlanejista) && formData.status === 'pendente'
                                        ? 'Enviar para Orçamento'
                                        : (isOrcamentista || (isGestor && formData.status !== 'pendente'))
                                            ? ((formData.status === 'recusado' || formData.status === 'reprovado') ? 'Reenviar Orçamento' : 'Salvar Orçamento')
                                            : 'Salvar Alterações'}
                                </span>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {isProblemModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl flex flex-col p-6 space-y-4">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                            <h3 className="font-black text-gray-900 text-lg">Relatar Problema</h3>
                            <button onClick={() => setIsProblemModalOpen(false)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100"><X size={20} /></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Foto do Problema (Opcional)</label>
                                {problemPhotoUrl ? (
                                    <div className="relative aspect-video rounded-xl overflow-hidden border border-gray-200">
                                        <img src={problemPhotoUrl} alt="Problema" className="w-full h-full object-cover" />
                                        <button onClick={() => setProblemPhotoUrl(null)} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg">
                                            <X size={12} />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-all">
                                        {problemUploading ? (
                                            <Loader2 className="animate-spin text-ios-blue" size={24} />
                                        ) : (
                                            <>
                                                <Camera size={24} className="text-gray-300 mb-1" />
                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-tight">Adicionar Foto</span>
                                            </>
                                        )}
                                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUploadProblem} disabled={problemUploading} />
                                    </label>
                                )}
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Descrição do Problema (Obrigatório)</label>
                                <textarea
                                    value={problemDesc}
                                    onChange={(e) => setProblemDesc(e.target.value)}
                                    placeholder="Descreva o problema encontrado..."
                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-medium text-gray-900 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 min-h-[100px] resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setIsProblemModalOpen(false)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-black text-xs uppercase">Cancelar</button>
                            <button
                                onClick={handleProfessionalRelatarProblema}
                                disabled={saving || !problemDesc || problemDesc.trim().length < 5 || problemUploading}
                                className="flex-[2] bg-red-600 text-white py-3 rounded-xl font-black text-xs uppercase shadow-lg shadow-red-200 flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="animate-spin" size={16} /> : 'Enviar Problema'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isCancelModalOpen && (
                <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl flex flex-col p-6 space-y-5 border border-gray-100">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                            <h3 className="font-black text-gray-900 text-lg">Cancelar Serviço</h3>
                            <button onClick={() => { setIsCancelModalOpen(false); setCancelInputCode(''); }} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100"><X size={20} /></button>
                        </div>

                        <div className="bg-amber-50 border border-amber-200/60 p-4 rounded-2xl space-y-2">
                            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest leading-none">Código Único do Serviço</p>
                            <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-amber-200">
                                <span className="font-mono font-black text-lg text-gray-900 tracking-wider">#{normalizedItem?.chaveunica || order.chaveunica}</span>
                                <button
                                    onClick={handleCopyCode}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-amber-200 transition-all active:scale-95"
                                >
                                    {codeCopied ? <><Check size={14} className="text-green-600" /> Copiado!</> : <><Copy size={14} /> Copiar</>}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                                Digite o código único para confirmar
                            </label>
                            <input
                                type="text"
                                value={cancelInputCode}
                                onChange={(e) => setCancelInputCode(e.target.value)}
                                placeholder={`Digite ${normalizedItem?.chaveunica || order.chaveunica}...`}
                                className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-sm font-mono font-bold text-gray-900 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 placeholder-gray-300"
                            />
                        </div>

                        <div className="pt-2 flex flex-col gap-2.5">
                            <div className="flex gap-3">
                                <button
                                    onClick={handleGestorCancelService}
                                    disabled={saving || cancelInputCode.trim().toUpperCase() !== (normalizedItem?.chaveunica || order.chaveunica || '').trim().toUpperCase()}
                                    className="flex-1 bg-red-600 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-200 flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-30 disabled:grayscale-[0.5] disabled:cursor-not-allowed"
                                >
                                    {saving ? <Loader2 className="animate-spin" size={16} /> : <span>Cancelar Serviço</span>}
                                </button>

                                <button
                                    onClick={handleGestorOpenLinkedService}
                                    disabled={saving || cancelInputCode.trim().toUpperCase() !== (normalizedItem?.chaveunica || order.chaveunica || '').trim().toUpperCase()}
                                    className="flex-1 bg-ios-blue text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-200 flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-30 disabled:grayscale-[0.5] disabled:cursor-not-allowed"
                                >
                                    {saving ? <Loader2 className="animate-spin" size={16} /> : <span>Abrir Serviço Vinculado</span>}
                                </button>
                            </div>

                            <button
                                onClick={() => { setIsCancelModalOpen(false); setCancelInputCode(''); }}
                                className="w-full bg-gray-100 text-gray-600 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95"
                            >
                                Voltar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfessionalOrderModal;
