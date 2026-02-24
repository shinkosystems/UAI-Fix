
import React from 'react';
import { ClipboardList, MapPin, Calendar, Banknote } from 'lucide-react';
import { ChamadoExtended } from '../../pages/Chamados';

interface ProfessionalTabProps {
    formData: any;
    editingItem: ChamadoExtended;
    isMediaVideo: (url: string) => boolean;
}

const ProfessionalTab: React.FC<ProfessionalTabProps> = ({ 
    formData, 
    editingItem,
    isMediaVideo 
}) => {
    const budget = editingItem.orcamentos?.[0];
    const plan = editingItem.planejamento?.[0];
    const client = editingItem.clienteData;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Informações da Tarefa */}
            <div className="grid grid-cols-1 gap-4">
                <div className="bg-emerald-50/50 p-5 rounded-3xl border border-emerald-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                        <Banknote size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest leading-none mb-1">Mão de Obra a Receber</p>
                        <p className="text-xl font-black text-emerald-900">R$ {budget?.hh?.toFixed(2) || '0.00'}</p>
                    </div>
                </div>

                <div className="bg-ios-blue/5 p-5 rounded-3xl border border-ios-blue/10 space-y-3">
                    <div className="flex items-center gap-3 text-ios-blue">
                        <MapPin size={18} />
                        <h4 className="text-[10px] font-black uppercase tracking-widest">Local do Serviço</h4>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-gray-900">
                            {client?.rua}, {client?.numero}
                            {client?.complemento && ` - ${client.complemento}`}
                        </p>
                        <p className="text-xs font-medium text-gray-500">
                            {client?.bairro} - {client?.cidade_data?.cidade}
                        </p>
                    </div>
                </div>

                <div className="bg-amber-50/50 p-5 rounded-3xl border border-amber-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest leading-none mb-1">Data de Execução</p>
                        <p className="text-sm font-black text-amber-900">
                            {plan?.execucao ? new Date(plan.execucao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'A definir'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50/50 p-6 rounded-[2.5rem] border border-blue-100 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 text-blue-800">
                    <ClipboardList size={18} />
                    <h4 className="text-[10px] font-black uppercase tracking-widest">Notas do Profissional</h4>
                </div>
                <div className="w-full bg-white/60 border border-blue-100 rounded-2xl p-5 min-h-[120px]">
                    <p className="text-sm font-bold text-blue-900 leading-relaxed italic">
                        {formData.agendaObs || "Nenhuma nota técnica registrada até o momento."}
                    </p>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                {formData.fotoantes.length > 0 ? formData.fotoantes.map((url: string, i: number) => (
                    <div key={i} className="aspect-video bg-gray-100 rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative group">
                        {isMediaVideo(url) ? (
                            <video src={url} className="w-full h-full object-cover" controls />
                        ) : (
                            <img src={url} className="w-full h-full object-cover" />
                        )}
                        <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase">Antes</div>
                    </div>
                )) : (
                    <div className="col-span-2 py-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-center text-[10px] font-black text-gray-300 uppercase tracking-widest">
                        Sem fotos de execução
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfessionalTab;
