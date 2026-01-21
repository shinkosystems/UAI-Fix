
import React from 'react';
import { Geral } from '../types';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

interface StoryCircleProps {
  item: Geral;
}

const StoryCircle: React.FC<StoryCircleProps> = ({ item }) => {
  const navigate = useNavigate();

  const handleClick = async () => {
    // Check if category has children before navigating
    const { count } = await supabase
        .from('geral')
        .select('*', { count: 'exact', head: true })
        .eq('dependencia', item.id)
        .eq('ativa', true);

    if (count && count > 0) {
        navigate(`/category/${item.id}`, { state: { name: item.nome } });
    } else {
        // Go straight to Request flow (skipping pro list)
        navigate(`/request/${item.id}`, { state: { serviceName: item.nome } });
    }
  };

  return (
    <button 
      onClick={handleClick}
      className="flex flex-col items-center space-y-1 min-w-[72px] transition-transform active:scale-95"
    >
      <div className="w-[68px] h-[68px] rounded-full p-[3px] bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600">
        <div className="w-full h-full rounded-full bg-white p-[3px]">
          <img 
            src={item.imagem || `https://picsum.photos/seed/${item.id}/200`} 
            alt={item.nome} 
            className="w-full h-full rounded-full object-cover"
          />
        </div>
      </div>
      <span className="text-xs font-medium text-gray-800 truncate w-16 text-center">
        {item.nome}
      </span>
    </button>
  );
};

export default StoryCircle;
