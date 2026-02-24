
import React from 'react';
import { ClipboardList } from 'lucide-react';
import { User } from '../../types';

interface PlanningSectionProps {
    formData: any;
    setFormData: (data: any) => void;
    availableProfessionals: User[];
    isGestor: boolean;
    isPlanejista: boolean;
}

const PlanningSection: React.FC<PlanningSectionProps> = ({ 
    formData, 
    setFormData, 
    availableProfessionals,
    isGestor,
    isPlanejista
}) => {
    if (!((isGestor || isPlanejista) && formData.status === 'pendente')) return null;

    return (
        <div className="bg-blue-50/30 p-6 rounded-[2.5rem] border border-blue-100 space-y-5">
            <div className="flex items-center gap-2 mb-2">
                <ClipboardList size={18} className="text-ios-blue"/>
                <h4 className="text-[10px] font-black text-ios-blue uppercase tracking-widest">Planejamento</h4>
            </div>
            <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Profissional Responsável</label>
                <select 
                    className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-sm font-bold text-gray-900 outline-none" 
                    value={formData.profissionalUuid} 
                    onChange={(e) => setFormData({...formData, profissionalUuid: e.target.value})}
                >
                    <option value="">Selecione um profissional...</option>
                    {availableProfessionals.map(p => (
                        <option key={p.uuid} value={p.uuid}>{p.nome}</option>
                    ))}
                </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Visita Técnica</label>
                    <input 
                        type="datetime-local" 
                        className="w-full bg-white border border-gray-100 rounded-2xl p-3 text-xs font-bold text-gray-900 outline-none" 
                        value={formData.planejamentoVisita} 
                        onChange={e => setFormData({...formData, planejamentoVisita: e.target.value})}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Execução Prevista</label>
                    <input 
                        type="datetime-local" 
                        className="w-full bg-white border border-gray-100 rounded-2xl p-3 text-xs font-bold text-gray-900 outline-none" 
                        value={formData.planejamentoData} 
                        onChange={e => setFormData({...formData, planejamentoData: e.target.value})}
                    />
                </div>
            </div>
        </div>
    );
};

export default PlanningSection;
