import React, { useState } from 'react';
import { ClipboardList, Camera, Trash2, Loader2, AlertTriangle, FileText } from 'lucide-react';
import { ChamadoExtended } from '../../pages/Chamados';
import { supabase } from '../../supabaseClient';

interface ProfessionalTabProps {
    formData: any;
    setFormData: (data: any) => void;
    saving: boolean;
    editingItem: ChamadoExtended;
    isMediaVideo: (url: string) => boolean;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ProfessionalTab: React.FC<ProfessionalTabProps> = ({
    formData,
    setFormData,
    saving,
    editingItem,
    isMediaVideo
}) => {
    const [localUploading, setLocalUploading] = useState<'antes' | 'depois' | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);

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

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {localError && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start space-x-3 animate-in slide-in-from-top-2 duration-300">
                    <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs font-bold text-red-700 leading-tight flex-1">{localError}</p>
                    <button onClick={() => setLocalError(null)} className="text-red-400 hover:text-red-600 transition-colors">fechar</button>
                </div>
            )}

            {/* Mídia Antes do Serviço */}
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
                        <div key={i} className="aspect-video bg-gray-100 rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative group">
                            {isMediaVideo(url) ? (
                                <video src={url} className="w-full h-full object-cover" controls />
                            ) : (
                                <img src={url} className="w-full h-full object-cover" />
                            )}
                            <button
                                onClick={() => removeMedia(i, 'antes')}
                                className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}

                    <label className="aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-all active:scale-[0.98]">
                        <Camera size={24} className="text-gray-300 mb-1" />
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-tight">Adicionar 'Antes'</span>
                        <input type="file" className="hidden" accept="image/*,video/*" onChange={(e) => handleFileUpload(e, 'antes')} disabled={!!localUploading} />
                    </label>
                </div>
            </div>

            {/* Mídia Depois do Serviço */}
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
                        <div key={i} className="aspect-video bg-gray-100 rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative group">
                            {isMediaVideo(url) ? (
                                <video src={url} className="w-full h-full object-cover" controls />
                            ) : (
                                <img src={url} className="w-full h-full object-cover" />
                            )}
                            <button
                                onClick={() => removeMedia(i, 'depois')}
                                className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}

                    <label className="aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-all active:scale-[0.98]">
                        <Camera size={24} className="text-gray-300 mb-1" />
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-tight">Adicionar 'Depois'</span>
                        <input type="file" className="hidden" accept="image/*,video/*" onChange={(e) => handleFileUpload(e, 'depois')} disabled={!!localUploading} />
                    </label>
                </div>
            </div>

            {/* Observações do Serviço */}
            <div className="bg-ios-bg p-6 rounded-[2.5rem] border border-gray-100 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-600">
                    <ClipboardList size={20} className="text-ios-blue" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest">Observações do Serviço</h4>
                </div>
                <div className="relative">
                    <textarea
                        value={formData.agendaObs}
                        onChange={(e) => setFormData({ ...formData, agendaObs: e.target.value })}
                        placeholder="Descreva detalhes importantes da execução, peças trocadas, etc..."
                        className="w-full bg-white border border-gray-100 rounded-[1.8rem] p-5 text-sm font-bold text-gray-900 outline-none focus:ring-4 focus:ring-ios-blue/5 min-h-[160px] resize-none transition-all placeholder:text-gray-300 shadow-inner"
                    />
                    <div className="absolute top-4 right-4 text-gray-200">
                        <FileText size={20} />
                    </div>
                </div>
                <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest text-center">
                    Este relato é obrigatório para concluir o chamado
                </p>
            </div>
        </div>
    );
};

export default ProfessionalTab;
