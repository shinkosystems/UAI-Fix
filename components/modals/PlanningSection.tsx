import React from 'react';
import { ClipboardList, MapPin } from 'lucide-react';
import { User, Geral, City } from '../../types';
import { SearchableSelect } from '../SearchableSelect';

interface PlanningSectionProps {
    formData: any;
    setFormData: (data: any) => void;
    availableProfessionals: User[];
    allServices?: Geral[];
    allCities?: City[];
    onAtividadeCidadeChange?: (atividade?: number | string, cidade?: number | string) => void;
    onCepLookup?: (cep: string) => void;
    isGestor: boolean;
    isPlanejista: boolean;
    hasLinkedService?: boolean;
}

const PlanningSection: React.FC<PlanningSectionProps> = ({
    formData,
    setFormData,
    availableProfessionals,
    allServices = [],
    allCities = [],
    onAtividadeCidadeChange,
    onCepLookup,
    isGestor,
    isPlanejista,
    hasLinkedService = false
}) => {
    // Exibe o painel de planejamento se for gestor/planejista e estiver em pendente OU se for um serviço vinculado não cancelado OU se estiver em edição por gestor
    const canEditPlanning = (isGestor || isPlanejista) && (
        formData.status === 'pendente' || hasLinkedService || isGestor
    );

    if (!canEditPlanning) return null;

    return (
        <div className="bg-blue-50/30 p-6 rounded-[2.5rem] border border-blue-100 space-y-5">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <ClipboardList size={18} className="text-ios-blue" />
                    <h4 className="text-[10px] font-black text-ios-blue uppercase tracking-widest">
                        Planejamento e Edição de Serviço
                    </h4>
                </div>
                <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">
                    {formData.planejamentoData ? 'Planejamento Salvo' : 'Derivado do Pedido'}
                </span>
            </div>

            {formData.motivo_recusa && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                    <h5 className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                        ⚠️ Atenção: Serviço Recusado
                    </h5>
                    <p className="text-xs font-bold text-red-700 leading-tight">
                        Motivo: <span className="text-red-900 font-extrabold italic">"{formData.motivo_recusa}"</span>
                    </p>
                </div>
            )}

            {/* Tipo de Serviço (Atividade) */}
            {allServices.length > 0 && onAtividadeCidadeChange && (
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Tipo de Serviço (Atividade)</label>
                    <SearchableSelect
                        options={allServices.map(s => ({ value: String(s.id), label: s.nome }))}
                        value={formData.atividade ? String(formData.atividade) : ''}
                        onChange={(val) => onAtividadeCidadeChange(val ? parseInt(val) : '', formData.cidade)}
                        placeholder="Selecione a atividade..."
                        searchPlaceholder="Pesquisar atividade..."
                    />
                </div>
            )}

            {/* Endereço e Localização */}
            {onAtividadeCidadeChange && (
                <div className="space-y-3 pt-1 border-t border-blue-100/50">
                    <div className="flex items-center gap-2 mt-2">
                        <MapPin size={14} className="text-ios-blue" />
                        <label className="text-[10px] font-black text-ios-blue uppercase tracking-widest">Endereço e Localização do Serviço</label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <span className="text-[9px] font-bold text-gray-400 ml-1 uppercase">Cidade</span>
                            <SearchableSelect
                                options={allCities.map(c => ({ value: String(c.id), label: c.cidade }))}
                                value={formData.cidade ? String(formData.cidade) : ''}
                                onChange={(val) => onAtividadeCidadeChange(formData.atividade, val ? parseInt(val) : '')}
                                placeholder="Selecione a cidade..."
                                searchPlaceholder="Pesquisar cidade..."
                            />
                        </div>
                        <div className="space-y-1">
                            <span className="text-[9px] font-bold text-gray-400 ml-1 uppercase">CEP</span>
                            <input
                                type="text"
                                placeholder="00000-000"
                                className="w-full bg-white border border-gray-100 rounded-xl p-3 text-xs font-bold text-gray-900 outline-none focus:ring-1 focus:ring-ios-blue"
                                value={formData.clienteCep || ''}
                                onChange={e => {
                                    const val = e.target.value;
                                    setFormData({ ...formData, clienteCep: val });
                                    if (val.replace(/\D/g, '').length === 8 && onCepLookup) {
                                        onCepLookup(val);
                                    }
                                }}
                                onBlur={e => {
                                    if (onCepLookup && e.target.value) {
                                        onCepLookup(e.target.value);
                                    }
                                }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2 space-y-1">
                            <span className="text-[9px] font-bold text-gray-400 ml-1 uppercase">Rua / Logradouro</span>
                            <input
                                type="text"
                                placeholder="Rua..."
                                className="w-full bg-white border border-gray-100 rounded-xl p-3 text-xs font-bold text-gray-900 outline-none"
                                value={formData.clienteRua || ''}
                                onChange={e => setFormData({ ...formData, clienteRua: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <span className="text-[9px] font-bold text-gray-400 ml-1 uppercase">Número</span>
                            <input
                                type="text"
                                placeholder="Nº"
                                className="w-full bg-white border border-gray-100 rounded-xl p-3 text-xs font-bold text-gray-900 outline-none"
                                value={formData.clienteNumero || ''}
                                onChange={e => setFormData({ ...formData, clienteNumero: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <span className="text-[9px] font-bold text-gray-400 ml-1 uppercase">Bairro</span>
                            <input
                                type="text"
                                placeholder="Bairro..."
                                className="w-full bg-white border border-gray-100 rounded-xl p-3 text-xs font-bold text-gray-900 outline-none"
                                value={formData.clienteBairro || ''}
                                onChange={e => setFormData({ ...formData, clienteBairro: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <span className="text-[9px] font-bold text-gray-400 ml-1 uppercase">Complemento</span>
                            <input
                                type="text"
                                placeholder="Apt, Bloco..."
                                className="w-full bg-white border border-gray-100 rounded-xl p-3 text-xs font-bold text-gray-900 outline-none"
                                value={formData.clienteComplemento || ''}
                                onChange={e => setFormData({ ...formData, clienteComplemento: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-2 pt-2 border-t border-blue-100/50">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Profissional Responsável</label>
                <SearchableSelect
                    options={availableProfessionals.map(p => ({ value: p.uuid, label: p.nome }))}
                    value={formData.profissionalUuid}
                    onChange={(val) => setFormData({ ...formData, profissionalUuid: val })}
                    placeholder="Selecione um profissional..."
                    searchPlaceholder="Pesquisar profissional..."
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Visita Técnica</label>
                    <input
                        type="datetime-local"
                        className="w-full bg-white border border-gray-100 rounded-2xl p-3 text-xs font-bold text-gray-900 outline-none"
                        value={formData.planejamentoVisita}
                        onChange={e => setFormData({ ...formData, planejamentoVisita: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Execução Prevista</label>
                    <input
                        type="datetime-local"
                        className="w-full bg-white border border-gray-100 rounded-2xl p-3 text-xs font-bold text-gray-900 outline-none"
                        value={formData.planejamentoData}
                        onChange={e => setFormData({ ...formData, planejamentoData: e.target.value })}
                    />
                </div>
            </div>

            <div className="space-y-2 pt-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Descrição / Detalhes do Serviço</label>
                <textarea
                    className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-sm font-medium text-gray-900 outline-none resize-none min-h-[90px]"
                    value={formData.planejamentoDesc || ''}
                    onChange={e => setFormData({ ...formData, planejamentoDesc: e.target.value })}
                    placeholder="Descreva os detalhes do serviço..."
                />
            </div>

            <div className="space-y-2 pt-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Justificativa de Data Diferente (Opcional)</label>
                <textarea
                    className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-sm font-medium text-gray-900 outline-none resize-none min-h-[80px]"
                    value={formData.planejamentoJustificativaData || ''}
                    onChange={e => setFormData({ ...formData, planejamentoJustificativaData: e.target.value })}
                    placeholder="Se a data agendada for diferente da solicitada pelo cliente, justifique o motivo..."
                />
            </div>
        </div>
    );
};

export default PlanningSection;
