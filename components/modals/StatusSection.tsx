
import React from 'react';
import { MapPin, Calendar, Banknote, User as UserIcon, AlertCircle, Ban } from 'lucide-react';
import { ChamadoExtended } from '../../pages/Chamados';

interface StatusSectionProps {
    formData: any;
    setFormData: (data: any) => void;
    isGestor: boolean;
    isOrcamentista: boolean;
    isProfessional: boolean;
    editingItem: ChamadoExtended;
    setShowBudgetForm: (show: boolean) => void;
}

const StatusSection: React.FC<StatusSectionProps> = ({
    formData,
    setFormData,
    isGestor,
    isOrcamentista,
    isProfessional,
    editingItem,
    setShowBudgetForm
}) => {
    const budget = editingItem.orcamentos?.[0];
    const plan = editingItem.planejamento?.[0];
    const client = editingItem.clienteData;

    if (isProfessional) {
        return (
            <div className="space-y-4 animate-in fade-in duration-300">
                {/* Status Badge */}
                <div className="bg-gray-50/80 p-6 rounded-[2rem] border border-gray-100 text-center">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Status do Fluxo</label>
                    <span className="text-xl font-black text-gray-900">
                        {formData.status === 'aguardando_profissional' ? 'Aguardando Profissional' :
                            formData.status.replace('_', ' ').charAt(0).toUpperCase() + formData.status.replace('_', ' ').slice(1)}
                    </span>
                </div>

                {formData.status === 'reprovado' && editingItem.motivo_recusa && (
                    <div className="bg-red-50 p-5 rounded-3xl border border-red-100 flex gap-4 animate-in slide-in-from-top-2">
                        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 shrink-0">
                            <Ban size={20} />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-red-700 uppercase tracking-widest leading-none mb-1">Motivo da Recusa</p>
                            <p className="text-sm font-medium text-red-900 leading-relaxed italic">"{editingItem.motivo_recusa}"</p>
                        </div>
                    </div>
                )}

                {/* Consumer Info */}
                <div className="bg-white p-5 rounded-3xl border border-gray-100 flex items-center gap-4 shadow-sm">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                        {client?.foto ? (
                            <img src={client.foto} alt={client.nome} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <UserIcon size={24} />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Consumidor</p>
                        <p className="text-base font-black text-gray-900 truncate">{client?.nome || 'Não informado'}</p>
                    </div>
                </div>

                {/* Task Details */}
                <div className="grid grid-cols-1 gap-3">
                    <div className="bg-emerald-50/50 p-5 rounded-3xl border border-emerald-100 flex items-center gap-4">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                            <Banknote size={20} />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest leading-none mb-1">Mão de Obra</p>
                            <p className="text-lg font-black text-emerald-900">R$ {budget?.hh?.toFixed(2) || '0.00'}</p>
                        </div>
                    </div>

                    <div className="bg-ios-blue/5 p-5 rounded-3xl border border-ios-blue/10 space-y-3">
                        <div className="flex items-center gap-3 text-ios-blue">
                            <MapPin size={16} />
                            <h4 className="text-[9px] font-black uppercase tracking-widest">Local do Serviço</h4>
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-sm font-bold text-gray-900">
                                {client?.rua}, {client?.numero}
                                {client?.complemento && ` - ${client.complemento}`}
                            </p>
                            <p className="text-[11px] font-medium text-gray-500">
                                {client?.bairro} - {client?.cidade_data?.cidade}
                            </p>
                        </div>
                    </div>

                    <div className="bg-amber-50/50 p-5 rounded-3xl border border-amber-100 flex items-center gap-4">
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                            <Calendar size={20} />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest leading-none mb-1">Data do Serviço</p>
                            <p className="text-sm font-black text-amber-900">
                                {plan?.execucao ? new Date(plan.execucao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'A definir'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 space-y-4">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block ml-1">Status do Fluxo</label>
            <select
                className="w-full bg-white border border-gray-200 rounded-xl p-4 text-sm font-black text-gray-900 outline-none shadow-sm appearance-none"
                value={formData.status}
                onChange={(e) => {
                    const newStatus = e.target.value;
                    setFormData({ ...formData, status: newStatus });
                    if (isGestor || isOrcamentista) {
                        setShowBudgetForm(newStatus !== 'pendente');
                    }
                }}
            >
                <option value="pendente">Pendente</option>
                <option value="analise">Em Orçamento</option>
                <option value="aguardando_profissional">Aguardando Profissional</option>
                <option value="aguardando_aprovacao">Aguardando Cliente</option>
                <option value="aprovado">Aprovado (Agendado)</option>
                <option value="executando">Em Execução</option>
                <option value="concluido">Concluído</option>
                <option value="reprovado">Reprovado</option>
                <option value="cancelado">Cancelado</option>
            </select>

            {formData.status === 'reprovado' && editingItem.motivo_recusa && (
                <div className="bg-red-50 p-5 rounded-3xl border border-red-100 flex gap-4 animate-in slide-in-from-top-2 mt-2">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 shrink-0">
                        <AlertCircle size={20} />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-red-700 uppercase tracking-widest leading-none mb-1">Justificativa do Consumidor</p>
                        <p className="text-sm font-medium text-red-900 leading-relaxed">"{editingItem.motivo_recusa}"</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatusSection;
