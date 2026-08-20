import React, { useState, useEffect } from 'react';
import { 
    ClipboardList, 
    Camera, 
    Trash2, 
    Loader2, 
    AlertTriangle, 
    FileText,
    User as UserIcon,
    Phone,
    Mail,
    MapPin,
    ExternalLink,
    MessageSquare,
    Briefcase,
    UserX,
    AlertCircle,
    CheckCircle,
    ZoomIn
} from 'lucide-react';
import { ChamadoExtended, User } from '../../types';
import { supabase } from '../../supabaseClient';
import { formatPhone, formatCpf, formatCep } from '../../utils/masks';
import MediaLightbox from './MediaLightbox';

interface ProfessionalTabProps {
    formData: any;
    setFormData: (data: any) => void;
    saving: boolean;
    editingItem: ChamadoExtended;
    isMediaVideo: (url: string) => boolean;
    isReadOnly?: boolean;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ProfessionalTab: React.FC<ProfessionalTabProps> = ({
    formData,
    setFormData,
    saving,
    editingItem,
    isMediaVideo,
    isReadOnly = false
}) => {
    const [lightboxMedia, setLightboxMedia] = useState<{ url: string; title: string } | null>(null);
    const [localUploading, setLocalUploading] = useState<'antes' | 'depois' | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);
    const [professionalUser, setProfessionalUser] = useState<User | null>(
        editingItem.profissionalData || editingItem.chaveData?.profissionalData || null
    );

    // Efeito para sincronizar o profissional caso tenha sido selecionado/alterado no formulário
    useEffect(() => {
        const profUuid = formData.profissionalUuid || 
            (typeof editingItem.profissional === 'string' ? editingItem.profissional : (editingItem.profissional as any)?.uuid) ||
            (typeof editingItem.chaveData?.profissional === 'string' ? editingItem.chaveData?.profissional : (editingItem.chaveData?.profissional as any)?.uuid);

        if (profUuid && typeof profUuid === 'string') {
            if (editingItem.profissionalData && editingItem.profissionalData.uuid === profUuid) {
                setProfessionalUser(editingItem.profissionalData);
            } else {
                supabase
                    .from('users')
                    .select('*, cidades(cidade)')
                    .eq('uuid', profUuid)
                    .maybeSingle()
                    .then(({ data, error }) => {
                        if (!error && data) {
                            setProfessionalUser(data as User);
                        }
                    });
            }
        } else {
            setProfessionalUser(editingItem.profissionalData || editingItem.chaveData?.profissionalData || null);
        }
    }, [formData.profissionalUuid, editingItem]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'antes' | 'depois') => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        setLocalError(null);

        if (file.size > MAX_FILE_SIZE) {
            const sizeMb = (file.size / 1024 / 1024).toFixed(1);
            setLocalError(`O arquivo (${sizeMb}MB) é maior que o tamanho máximo de 50MB.`);
            return;
        }

        setLocalUploading(type);
        try {
            const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
            const path = `execucao/${editingItem.chaveunica}_${type}_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage.from('imagens').upload(path, file, {
                contentType: file.type || undefined
            });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('imagens').getPublicUrl(path);

            const field = type === 'antes' ? 'fotoantes' : 'fotodepois';
            setFormData({
                ...formData,
                [field]: [...formData[field], data.publicUrl]
            });
        } catch (error: any) {
            console.error('Erro no upload:', error);
            setLocalError(`Erro ao carregar arquivo: ${error.message}`);
        } finally {
            setLocalUploading(null);
        }
    };

    const removeMedia = (index: number, type: 'antes' | 'depois') => {
        const field = type === 'antes' ? 'fotoantes' : 'fotodepois';
        setFormData({
            ...formData,
            [field]: formData[field].filter((_: any, i: number) => i !== index)
        });
    };

    // Formatação de dados do profissional
    const profName = professionalUser?.nome || '';
    const profEmail = professionalUser?.email || '';
    const rawPhone = professionalUser?.whatsapp || '';
    const cleanPhoneDigits = rawPhone.replace(/\D/g, '');
    const profPhone = rawPhone ? formatPhone(rawPhone) : 'Não informado';
    const profCpf = professionalUser?.cpf ? formatCpf(professionalUser.cpf) : '';
    const profPhoto = professionalUser?.fotoperfil || '';
    const profCidade = (professionalUser as any)?.cidades?.cidade || professionalUser?.cidade_data?.cidade || '';
    const profRua = professionalUser?.rua || '';
    const profNumero = professionalUser?.numero || '';
    const profBairro = professionalUser?.bairro || '';
    const profCep = professionalUser?.cep ? formatCep(professionalUser.cep) : '';
    const hasAddress = !!(profRua || profBairro || profCidade || profCep);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {localError && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start space-x-3 animate-in slide-in-from-top-2 duration-300">
                    <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs font-bold text-red-700 leading-tight flex-1">{localError}</p>
                    <button onClick={() => setLocalError(null)} className="text-red-400 hover:text-red-600 transition-colors">fechar</button>
                </div>
            )}

            {/* 1. SEÇÃO: DADOS DO PROFISSIONAL RESPONSÁVEL OU AVISO DE SELEÇÃO */}
            {professionalUser ? (
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200/90 shadow-xs space-y-5">
                    <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2 text-slate-800">
                            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                <Briefcase size={16} />
                            </div>
                            <h4 className="text-xs font-black uppercase tracking-wider">Profissional Responsável pelo Chamado</h4>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle size={13} className="text-emerald-600" />
                                <span>Profissional Vinculado</span>
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                                {professionalUser?.tipo || 'Profissional'}
                            </span>
                        </div>
                    </div>

                    {/* Perfil Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center space-x-4">
                            <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-lg text-slate-700 overflow-hidden flex-shrink-0 shadow-2xs">
                                {profPhoto ? (
                                    <img src={profPhoto} alt={profName} className="w-full h-full object-cover" />
                                ) : (
                                    <span>{profName.substring(0, 2).toUpperCase() || 'PR'}</span>
                                )}
                            </div>
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{profName}</h3>
                                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                    {profEmail && <span>{profEmail}</span>}
                                    {profEmail && profCpf && <span>•</span>}
                                    {profCpf && <span>CPF: {profCpf}</span>}
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
                                    <span className="font-bold text-slate-900">{profPhone}</span>
                                </div>
                                {profEmail && (
                                    <div className="flex items-center gap-2 truncate">
                                        <Mail size={14} className="text-slate-400 flex-shrink-0" />
                                        <span className="truncate">{profEmail}</span>
                                    </div>
                                )}
                                {profCpf && (
                                    <div className="flex items-center gap-2 truncate">
                                        <FileText size={14} className="text-slate-400 flex-shrink-0" />
                                        <span>CPF: {profCpf}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bloco Endereço */}
                        <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70 space-y-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Localidade / Base do Profissional</span>
                            {hasAddress ? (
                                <div className="space-y-1 text-xs text-slate-700 font-medium">
                                    <div className="flex items-start gap-2">
                                        <MapPin size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-slate-900 font-bold">
                                                {profRua ? `${profRua}${profNumero ? `, ${profNumero}` : ''}` : 'Endereço não informado'}
                                            </p>
                                            <p className="text-[11px] text-slate-500">
                                                {[profBairro, profCidade, profCep].filter(Boolean).join(' • ')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic">Endereço não cadastrado para este profissional.</p>
                            )}
                        </div>

                    </div>
                </div>
            ) : (
                <div className="p-8 rounded-[2.5rem] bg-amber-50/70 border border-amber-200/90 text-center space-y-3">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs">
                        <UserX size={26} />
                    </div>
                    <div>
                        <h4 className="text-sm font-extrabold text-amber-950">Nenhum profissional selecionado para este chamado</h4>
                        <p className="text-xs text-amber-800/80 font-medium mt-1 max-w-md mx-auto">
                            Este chamado ainda não possui um prestador de serviços vinculado. Selecione um profissional disponível na aba <strong>Geral</strong> para dar andamento ao atendimento e execução da OS.
                        </p>
                    </div>
                </div>
            )}

            {/* 2. SEÇÃO: MÍDIAS ANTES DO SERVIÇO */}
            <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Camera size={14} className="text-ios-blue" />
                        Fotos/Vídeos: Antes do Serviço
                    </h4>
                    {localUploading === 'antes' && <Loader2 className="animate-spin text-ios-blue" size={14} />}
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {formData.fotoantes.map((url: string, i: number) => (
                        <div key={i} className="aspect-video bg-gray-100 rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative group cursor-pointer" onClick={() => setLightboxMedia({ url, title: `Foto/Vídeo Antes (${i + 1})` })}>
                            {isMediaVideo(url) ? (
                                <video src={url} className="w-full h-full object-cover" controls />
                            ) : (
                                <>
                                    <img src={url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" alt="Antes do serviço" />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                        <div className="p-2 rounded-full bg-black/60 text-white">
                                            <ZoomIn size={16} />
                                        </div>
                                    </div>
                                </>
                            )}
                            {!isReadOnly && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeMedia(i, 'antes');
                                    }}
                                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all z-10"
                                    title="Remover mídia"
                                >
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                    ))}
                    {!isReadOnly && (
                        <label className="aspect-video bg-ios-bg border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-all active:scale-[0.98]">
                            <Camera size={24} className="text-gray-300 mb-1" />
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-tight">Adicionar 'Antes'</span>
                            <input type="file" className="hidden" accept="image/*,video/*" onChange={(e) => handleFileUpload(e, 'antes')} disabled={!!localUploading} />
                        </label>
                    )}
                </div>
            </div>

            {/* 3. SEÇÃO: MÍDIAS DEPOIS DO SERVIÇO */}
            <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Camera size={14} className="text-emerald-500" />
                        Fotos/Vídeos: Conclusão (Depois)
                    </h4>
                    {localUploading === 'depois' && <Loader2 className="animate-spin text-emerald-500" size={14} />}
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {formData.fotodepois.map((url: string, i: number) => (
                        <div key={i} className="aspect-video bg-gray-100 rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative group cursor-pointer" onClick={() => setLightboxMedia({ url, title: `Foto/Vídeo Conclusão (${i + 1})` })}>
                            {isMediaVideo(url) ? (
                                <video src={url} className="w-full h-full object-cover" controls />
                            ) : (
                                <>
                                    <img src={url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" alt="Depois do serviço" />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                        <div className="p-2 rounded-full bg-black/60 text-white">
                                            <ZoomIn size={16} />
                                        </div>
                                    </div>
                                </>
                            )}
                            {!isReadOnly && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeMedia(i, 'depois');
                                    }}
                                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all z-10"
                                    title="Remover mídia"
                                >
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                    ))}
                    {!isReadOnly && (
                        <label className="aspect-video bg-ios-bg border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-all active:scale-[0.98]">
                            <Camera size={24} className="text-gray-300 mb-1" />
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-tight">Adicionar 'Depois'</span>
                            <input type="file" className="hidden" accept="image/*,video/*" onChange={(e) => handleFileUpload(e, 'depois')} disabled={!!localUploading} />
                        </label>
                    )}
                </div>
            </div>

            {/* 4. SEÇÃO: OBSERVAÇÕES DO SERVIÇO */}
            <div className="bg-ios-bg p-6 rounded-[2.5rem] border border-gray-100 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-600">
                    <ClipboardList size={20} className="text-ios-blue" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest">Observações do Serviço</h4>
                </div>
                <div className="relative">
                    <textarea
                        value={formData.agendaObs}
                        onChange={(e) => setFormData({ ...formData, agendaObs: e.target.value })}
                        readOnly={isReadOnly}
                        placeholder={isReadOnly ? "Sem observações." : "Descreva detalhes importantes da execução, peças trocadas, etc..."}
                        className={`w-full bg-white border border-gray-100 rounded-[1.8rem] p-5 text-sm font-bold text-gray-900 outline-none focus:ring-4 focus:ring-ios-blue/5 min-h-[160px] resize-none transition-all placeholder:text-gray-300 shadow-inner ${isReadOnly ? 'opacity-70 select-none' : ''}`}
                    />
                    <div className="absolute top-4 right-4 text-gray-200">
                        <FileText size={20} />
                    </div>
                </div>
                <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest text-center">
                    Este relato é obrigatório para concluir o chamado
                </p>
            </div>

            {/* Lightbox em Tela Cheia */}
            <MediaLightbox
                src={lightboxMedia?.url || null}
                isOpen={!!lightboxMedia}
                onClose={() => setLightboxMedia(null)}
                title={lightboxMedia?.title}
            />
        </div>
    );
};

export default ProfessionalTab;

