
import React from 'react';
import { Clock } from 'lucide-react';

interface FlexibilitySectionProps {
    flexibility: string | null;
}

const FlexibilitySection: React.FC<FlexibilitySectionProps> = ({ flexibility }) => {
    if (!flexibility) return null;

    return (
        <div className="bg-blue-50/30 p-5 rounded-[2rem] border border-blue-100 flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-blue-100 rounded-2xl text-blue-600">
                <Clock size={20} />
            </div>
            <div className="space-y-1">
                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest leading-none">Flexibilidade de Horário</p>
                <p className="text-xs font-black text-blue-900 uppercase">{flexibility}</p>
            </div>
        </div>
    );
};

export default FlexibilitySection;
