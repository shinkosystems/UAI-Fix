
import React from 'react';
import { DollarSign } from 'lucide-react';

interface BudgetSectionProps {
    formData: any;
    setFormData: (data: any) => void;
    showBudgetForm: boolean;
}

const BudgetSection: React.FC<BudgetSectionProps> = ({ 
    formData, 
    setFormData, 
    showBudgetForm 
}) => {
    if (!(showBudgetForm && formData.status !== 'pendente')) return null;

    return (
        <div className="bg-green-50/30 p-6 rounded-[2.5rem] border border-green-100 space-y-5">
            <div className="flex items-center gap-2 mb-2">
                <DollarSign size={18} className="text-green-600"/>
                <h4 className="text-[10px] font-black text-green-700 uppercase tracking-widest">Detalhamento Orçamentário</h4>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Custo Fixo (R$)</label>
                    <input 
                        type="number" 
                        step="0.01" 
                        className="w-full bg-white border border-gray-100 rounded-2xl p-3 text-sm font-bold text-gray-900 outline-none" 
                        value={formData.orcamentoCusto} 
                        onChange={e => setFormData({...formData, orcamentoCusto: parseFloat(e.target.value) || 0})}
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Mão de Obra (R$)</label>
                    <input 
                        type="number" 
                        step="0.01" 
                        className="w-full bg-white border border-gray-100 rounded-2xl p-3 text-sm font-bold text-gray-900 outline-none" 
                        value={formData.orcamentoHH} 
                        onChange={e => setFormData({...formData, orcamentoHH: parseFloat(e.target.value) || 0})}
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Lucro (R$)</label>
                    <input 
                        type="number" 
                        step="0.01" 
                        className="w-full bg-white border border-gray-100 rounded-2xl p-3 text-sm font-bold text-gray-900 outline-none" 
                        value={formData.orcamentoLucro} 
                        onChange={e => setFormData({...formData, orcamentoLucro: parseFloat(e.target.value) || 0})}
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Imposto (%)</label>
                    <input 
                        type="number" 
                        step="0.1" 
                        className="w-full bg-white border border-gray-100 rounded-2xl p-3 text-sm font-bold text-gray-900 outline-none" 
                        value={formData.orcamentoImposto} 
                        onChange={e => setFormData({...formData, orcamentoImposto: parseFloat(e.target.value) || 0})}
                    />
                </div>
            </div>
            <div className="pt-4 border-t border-green-100 flex justify-between items-center">
                <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">Preço Sugerido:</span>
                <span className="text-lg font-black text-green-900">R$ {formData.orcamentoPreco.toFixed(2)}</span>
            </div>

            <div className="pt-6 border-t border-green-100 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-[10px] font-black text-green-700 uppercase tracking-widest">Sugestão de Pagamento Diferenciada</h4>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Forma de Pagamento</label>
                        <select 
                            className="w-full bg-white border border-gray-100 rounded-2xl p-3 text-sm font-bold text-gray-900 outline-none"
                            value={formData.orcamentoTipoPgtoSugerido}
                            onChange={e => setFormData({...formData, orcamentoTipoPgtoSugerido: e.target.value})}
                        >
                            <option value="">Nenhuma sugestão</option>
                            <option value="Dinheiro">Dinheiro</option>
                            <option value="PIX">PIX</option>
                            <option value="Cartão de Crédito">Cartão de Crédito</option>
                            <option value="Cartão de Débito">Cartão de Débito</option>
                        </select>
                    </div>
                    
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Parcelas</label>
                        <select 
                            className="w-full bg-white border border-gray-100 rounded-2xl p-3 text-sm font-bold text-gray-900 outline-none disabled:opacity-50"
                            value={formData.orcamentoParcelasSugerido}
                            onChange={e => setFormData({...formData, orcamentoParcelasSugerido: parseInt(e.target.value) || 1})}
                            disabled={formData.orcamentoTipoPgtoSugerido !== 'Cartão de Crédito'}
                        >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                                <option key={n} value={n}>{n}x</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Desconto Sugerido (%)</label>
                        <input 
                            type="number" 
                            step="0.1"
                            className="w-full bg-white border border-gray-100 rounded-2xl p-3 text-sm font-bold text-gray-900 outline-none" 
                            placeholder="Ex: 5.0"
                            value={formData.orcamentoDescontoSugerido}
                            onChange={e => setFormData({...formData, orcamentoDescontoSugerido: parseFloat(e.target.value) || 0})}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Justificativa da Sugestão</label>
                    <textarea 
                        className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-sm font-bold text-gray-900 outline-none min-h-[80px]"
                        placeholder="Explique por que está sugerindo esta forma de pagamento..."
                        value={formData.orcamentoJustificativaSugerido}
                        onChange={e => setFormData({...formData, orcamentoJustificativaSugerido: e.target.value})}
                    />
                </div>
            </div>
        </div>
    );
};

export default BudgetSection;
