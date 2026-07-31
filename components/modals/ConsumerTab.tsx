import React from 'react';
import { AlertCircle, Box, Mic, Wrench } from 'lucide-react';

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
    const isOriginatedFromCanceled = !!(editingItem.chave_vinculada_codigo || editingItem.chave_vinculada_id);

    const descriptionText = isOriginatedFromCanceled
        ? (editingItem.relato_problema || extractOriginalDesc(editingItem.planejamento?.[0]?.descricao) || "Nenhuma descrição do problema informada.")
        : (extractOriginalDesc(editingItem.planejamento?.[0]?.descricao) || "Nenhuma descrição detalhada.");

    const mediaUrl = isOriginatedFromCanceled
        ? (editingItem.foto_problema || editingItem.planejamento?.[0]?.imagem_pedido)
        : editingItem.planejamento?.[0]?.imagem_pedido;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className={`p-6 rounded-[2.5rem] border shadow-sm ${
                isOriginatedFromCanceled ? 'bg-red-50/40 border-red-100' : 'bg-yellow-50/50 border-yellow-100'
            }`}>
                <div className={`flex items-center gap-2 mb-4 ${
                    isOriginatedFromCanceled ? 'text-red-700' : 'text-yellow-700'
                }`}>
                    {isOriginatedFromCanceled ? <Wrench size={18} /> : <AlertCircle size={18} />}
                    <h4 className="text-[10px] font-black uppercase tracking-widest">
                        {isOriginatedFromCanceled ? "Problema Relatado pelo Profissional (OS Vinculada)" : "Relato do Cliente"}
                    </h4>
                </div>
                <p className={`text-sm font-bold leading-relaxed italic mb-6 ${
                    isOriginatedFromCanceled ? 'text-red-950 bg-white/70 p-4 rounded-2xl border border-red-100' : 'text-gray-800'
                }`}>
                    "{descriptionText}"
                </p>

                {editingItem.planejamento?.[0]?.audio_pedido && (
                    <div className={`mb-6 bg-white/60 p-4 rounded-2xl border shadow-sm animate-in zoom-in duration-300 ${
                        isOriginatedFromCanceled ? 'border-red-200 text-red-700' : 'border-yellow-200 text-yellow-700'
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
                            isOriginatedFromCanceled ? 'text-red-700' : 'text-yellow-700'
                        }`}>
                            <Box size={14} />
                            <h5 className="text-[9px] font-black uppercase tracking-widest">Materiais Necessários</h5>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {editingItem.planejamento[0].recursos.map((item: string, idx: number) => (
                                <span key={idx} className={`bg-white/80 border px-3 py-1 rounded-full text-[10px] font-bold shadow-sm ${
                                    isOriginatedFromCanceled ? 'border-red-200 text-red-800' : 'border-yellow-200 text-yellow-800'
                                }`}>
                                    {item}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {mediaUrl && (
                    <div className={`w-full h-48 bg-gray-100 rounded-2xl overflow-hidden border ${
                        isOriginatedFromCanceled ? 'border-red-200' : 'border-yellow-100'
                    }`}>
                        {isMediaVideo(mediaUrl) ? (
                            <video src={mediaUrl} className="w-full h-full object-cover" controls />
                        ) : (
                            <img src={mediaUrl} className="w-full h-full object-cover" />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConsumerTab;
