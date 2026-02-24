
import React from 'react';

interface PaymentInfoSectionProps {
    editingItem: any;
    installments?: number;
}

const PaymentInfoSection: React.FC<PaymentInfoSectionProps> = ({ editingItem, installments }) => {
    if (!editingItem.planejamento?.[0]) return null;

    const displayInstallments = installments || editingItem.planejamento[0].qtd || 1;

    return (
        <div className="bg-orange-50/30 p-5 rounded-[2rem] border border-orange-100 flex items-center justify-between shadow-sm">
            <div className="space-y-1">
                <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest leading-none">Pagamento Escolhido</p>
                <p className="text-xs font-black text-orange-900 uppercase">{editingItem.planejamento[0].pagamento || 'Não informado'}</p>
            </div>
            <div className="text-right space-y-1">
                <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest leading-none">Parcelas</p>
                <p className="text-xs font-black text-orange-900">{displayInstallments}x</p>
            </div>
        </div>
    );
};

export default PaymentInfoSection;
