import React, { useState } from 'react';
import { 
    AlertCircle, 
    Box, 
    Mic, 
    Wrench, 
    User as UserIcon, 
    Phone, 
    Mail, 
    MapPin, 
    FileText, 
    ExternalLink, 
    MessageSquare,
    Globe,
    Calendar,
    ZoomIn
} from 'lucide-react';
import { formatPhone, formatCpf, formatCep } from '../../utils/masks';
import { getOriginBadgeConfig } from '../../types';
import MediaLightbox from './MediaLightbox';

interface ConsumerTabProps {
    editingItem: any;
    extractOriginalDesc: (desc: string | undefined | null) => string;
    isMediaVideo: (url: string) => boolean;
}

const ConsumerTab: React.FC<ConsumerTabProps> = ({
    editingItem,
    extractOriginalDesc,
    isMediaVideo
}) => {
    const [lightboxMedia, setLightboxMedia] = useState<string | null>(null);
    const isOriginatedFromCanceled = !!(editingItem.chave_vinculada_codigo || editingItem.chave_vinculada_id);

    const descriptionText = isOriginatedFromCanceled
        ? (editingItem.relato_problema || extractOriginalDesc(editingItem.planejamento?.[0]?.descricao) || "Nenhuma descrição do problema informada.")
        : (extractOriginalDesc(editingItem.planejamento?.[0]?.descricao) || "Nenhuma descrição detalhada.");

    const mediaUrl = isOriginatedFromCanceled
        ? (editingItem.foto_problema || editingItem.planejamento?.[0]?.imagem_pedido)
        : editingItem.planejamento?.[0]?.imagem_pedido;

    // Dados do Cliente
    const client = editingItem.clienteData || editingItem.chaveData?.clienteData;
    const clientName = client?.nome || editingItem.whatsapp_lead_nome || 'Cliente não identificado';
    const clientEmail = client?.email || '';
    const rawPhone = client?.whatsapp || editingItem.whatsapp_chat_id || '';
    const cleanPhoneDigits = rawPhone.replace(/\D/g, '');
    const clientPhone = rawPhone ? formatPhone(rawPhone) : 'Não informado';
    const clientCpf = client?.cpf ? formatCpf(client.cpf) : (editingItem.whatsapp_lead_cpf ? formatCpf(editingItem.whatsapp_lead_cpf) : '');
    const clientPhoto = client?.fotoperfil || '';

    // Endereço
    const rua = client?.rua || editingItem.clienteRua || '';
    const numero = client?.numero || editingItem.clienteNumero || '';
    const complemento = client?.complemento || editingItem.clienteComplemento || '';
    const bairro = client?.bairro || editingItem.clienteBairro || '';
    const cep = client?.cep ? formatCep(client.cep) : (editingItem.clienteCep ? formatCep(editingItem.clienteCep) : '');
    const cidadeNome = client?.cidade_data?.cidade || client?.cidades?.cidade || editingItem.cidade_data?.cidade || '';
    const hasAddress = !!(rua || bairro || cidadeNome || cep);

    // Canal de Origem
    const origin = editingItem.origem || client?.origem || 'organico';
    const originBadge = getOriginBadgeConfig(origin);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* 1. CARD: DADOS DO CLIENTE / SOLICITANTE */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200/90 shadow-xs space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-slate-800">
                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                            <UserIcon size={16} />
                        </div>
                        <h4 className="text-xs font-black uppercase tracking-wider">Dados do Cliente Solicitante</h4>
                    </div>

                    <div className="flex items-center gap-2">
                        {origin && (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${originBadge.badgeBg}`}>
                                <span>{originBadge.icon}</span>
                                <span>{originBadge.label}</span>
                            </span>
                        )}
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                            {client?.tipo || 'Consumidor'}
                        </span>
                    </div>
                </div>

                {/* Perfil Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-4">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-lg text-slate-700 overflow-hidden flex-shrink-0 shadow-2xs">
                            {clientPhoto ? (
                                <img src={clientPhoto} alt={clientName} className="w-full h-full object-cover" />
                            ) : (
                                <span>{clientName.substring(0, 2).toUpperCase()}</span>
                            )}
                        </div>
                        <div>
                            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{clientName}</h3>
                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                {clientEmail && <span>{clientEmail}</span>}
                                {clientEmail && clientCpf && <span>•</span>}
                                {clientCpf && <span>CPF: {clientCpf}</span>}
                            </p>
                        </div>
                    </div>

                    {/* Botão de Ação Rápida WhatsApp */}
                    {cleanPhoneDigits && cleanPhoneDigits.length >= 10 && (
                        <a
                            href={`https://wa.me/55${cleanPhoneDigits}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
                        >
                            <MessageSquare size={15} />
                            <span>Conversar no WhatsApp</span>
                            <ExternalLink size={12} className="opacity-70" />
                        </a>
                    )}
                </div>

                {/* Detalhes de Contato e Endereço */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    
                    {/* Bloco Contato */}
                    <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70 space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Informações de Contato</span>
                        <div className="space-y-1.5 text-xs text-slate-700 font-medium">
                            <div className="flex items-center gap-2 truncate">
                                <Phone size={14} className="text-slate-400 flex-shrink-0" />
                                <span className="font-bold text-slate-900">{clientPhone}</span>
                            </div>
                            {clientEmail && (
                                <div className="flex items-center gap-2 truncate">
                                    <Mail size={14} className="text-slate-400 flex-shrink-0" />
                                    <span className="truncate">{clientEmail}</span>
                                </div>
                            )}
                            {clientCpf && (
                                <div className="flex items-center gap-2 truncate">
                                    <FileText size={14} className="text-slate-400 flex-shrink-0" />
                                    <span>CPF: {clientCpf}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bloco Endereço */}
                    <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70 space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Endereço do Atendimento</span>
                        {hasAddress ? (
                            <div className="space-y-1 text-xs text-slate-700 font-medium">
                                <div className="flex items-start gap-2">
                                    <MapPin size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-slate-900 font-bold">
                                            {rua ? `${rua}${numero ? `, ${numero}` : ''}` : 'Logradouro não informado'}
                                            {complemento ? ` (${complemento})` : ''}
                                        </p>
                                        <p className="text-[11px] text-slate-500">
                                            {[bairro, cidadeNome, cep].filter(Boolean).join(' • ')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400 italic">Endereço não cadastrado para este cliente.</p>
                        )}
                    </div>

                </div>
            </div>

            {/* 2. CARD: RELATO DO CLIENTE & DETALHES DO PEDIDO */}
            <div className={`p-6 rounded-[2.5rem] border shadow-xs ${
                isOriginatedFromCanceled ? 'bg-red-50/40 border-red-100' : 'bg-amber-50/50 border-amber-200/70'
            }`}>
                <div className={`flex items-center gap-2 mb-4 ${
                    isOriginatedFromCanceled ? 'text-red-700' : 'text-amber-800'
                }`}>
                    {isOriginatedFromCanceled ? <Wrench size={18} /> : <AlertCircle size={18} />}
                    <h4 className="text-[10px] font-black uppercase tracking-widest">
                        {isOriginatedFromCanceled ? "Problema Relatado pelo Profissional (OS Vinculada)" : "Relato da Solicitação"}
                    </h4>
                </div>
                <p className={`text-sm font-bold leading-relaxed italic mb-6 ${
                    isOriginatedFromCanceled ? 'text-red-950 bg-white/70 p-4 rounded-2xl border border-red-100' : 'text-slate-800 bg-white/60 p-4 rounded-2xl border border-amber-100'
                }`}>
                    "{descriptionText}"
                </p>

                {editingItem.planejamento?.[0]?.audio_pedido && (
                    <div className={`mb-6 bg-white/80 p-4 rounded-2xl border shadow-2xs animate-in zoom-in duration-300 ${
                        isOriginatedFromCanceled ? 'border-red-200 text-red-700' : 'border-amber-200 text-amber-900'
                    }`}>
                        <div className="flex items-center gap-2 mb-2">
                            <Mic size={14} />
                            <h5 className="text-[9px] font-black uppercase tracking-widest">Áudio em Anexo</h5>
                        </div>
                        <audio src={editingItem.planejamento[0].audio_pedido} controls className="w-full h-10" />
                    </div>
                )}

                {editingItem.planejamento?.[0]?.recursos && editingItem.planejamento[0].recursos.length > 0 && (
                    <div className="mb-6">
                        <div className={`flex items-center gap-2 mb-3 ${
                            isOriginatedFromCanceled ? 'text-red-700' : 'text-amber-900'
                        }`}>
                            <Box size={14} />
                            <h5 className="text-[9px] font-black uppercase tracking-widest">Materiais / Itens Necessários</h5>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {editingItem.planejamento[0].recursos.map((item: string, idx: number) => (
                                <span key={idx} className={`bg-white/90 border px-3 py-1 rounded-full text-[10px] font-bold shadow-2xs ${
                                    isOriginatedFromCanceled ? 'border-red-200 text-red-800' : 'border-amber-200 text-amber-900'
                                }`}>
                                    {item}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {mediaUrl && (
                    <div className="space-y-1.5">
                        <div 
                            onClick={() => setLightboxMedia(mediaUrl)}
                            className={`w-full max-h-80 bg-slate-900 rounded-2xl overflow-hidden border relative group cursor-pointer shadow-md transition-all hover:ring-2 hover:ring-blue-500/50 ${
                                isOriginatedFromCanceled ? 'border-red-200' : 'border-amber-200'
                            }`}
                        >
                            {isMediaVideo(mediaUrl) ? (
                                <video src={mediaUrl} className="w-full h-full object-contain max-h-80" controls />
                            ) : (
                                <>
                                    <img 
                                        src={mediaUrl} 
                                        className="w-full h-full object-contain max-h-80 group-hover:scale-[1.01] transition-transform duration-200" 
                                        alt="Anexo do pedido" 
                                    />
                                    <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                        <div className="px-3.5 py-1.5 rounded-full bg-black/70 backdrop-blur-xs text-white text-xs font-bold flex items-center gap-1.5 shadow-lg">
                                            <ZoomIn size={14} />
                                            <span>Clique para expandir</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Tela Cheia (Lightbox) */}
            <MediaLightbox
                src={lightboxMedia}
                isOpen={!!lightboxMedia}
                onClose={() => setLightboxMedia(null)}
                title="Anexo da Solicitação do Cliente"
            />
        </div>
    );
};

export default ConsumerTab;

