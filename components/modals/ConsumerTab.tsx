
import React from 'react';
import { AlertCircle, Box, Mic } from 'lucide-react';

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
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-yellow-50/50 p-6 rounded-[2.5rem] border border-yellow-100 shadow-sm">
                <div className="flex items-center gap-2 text-yellow-700 mb-4">
                    <AlertCircle size={18} />
                    <h4 className="text-[10px] font-black uppercase tracking-widest">Relato do Cliente</h4>
                </div>
                <p className="text-sm font-bold text-gray-800 leading-relaxed italic mb-6">
                    "{extractOriginalDesc(editingItem.planejamento?.[0]?.descricao) || "Nenhuma descrição detalhada."}"
                </p>

                {editingItem.planejamento?.[0]?.audio_pedido && (
                    <div className="mb-6 bg-white/60 p-4 rounded-2xl border border-yellow-200 shadow-sm animate-in zoom-in duration-300">
                        <div className="flex items-center gap-2 text-yellow-700 mb-2">
                            <Mic size={14} />
                            <h5 className="text-[9px] font-black uppercase tracking-widest">Áudio em Anexo</h5>
                        </div>
                        <audio src={editingItem.planejamento[0].audio_pedido} controls className="w-full h-10" />
                    </div>
                )}

                {editingItem.planejamento?.[0]?.recursos && editingItem.planejamento[0].recursos.length > 0 && (
                    <div className="mb-6">
                        <div className="flex items-center gap-2 text-yellow-700 mb-3">
                            <Box size={14} />
                            <h5 className="text-[9px] font-black uppercase tracking-widest">Materiais Necessários</h5>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {editingItem.planejamento[0].recursos.map((item: string, idx: number) => (
                                <span key={idx} className="bg-white/80 border border-yellow-200 px-3 py-1 rounded-full text-[10px] font-bold text-yellow-800 shadow-sm">
                                    {item}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {editingItem.planejamento?.[0]?.imagem_pedido && (
                    <div className="w-full h-48 bg-gray-100 rounded-2xl overflow-hidden border border-yellow-100">
                        {isMediaVideo(editingItem.planejamento[0].imagem_pedido) ? (
                            <video src={editingItem.planejamento[0].imagem_pedido} className="w-full h-full object-cover" controls />
                        ) : (
                            <img src={editingItem.planejamento[0].imagem_pedido} className="w-full h-full object-cover" />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConsumerTab;
