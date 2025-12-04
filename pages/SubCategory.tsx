
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Geral } from '../types';
import { ChevronLeft, ArrowRight, Users } from 'lucide-react';

const SubCategory: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const parentName = location.state?.name || 'Serviços';

  const [subCategories, setSubCategories] = useState<Geral[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [userCityId, setUserCityId] = useState<number | null>(null);

  useEffect(() => {
    const init = async () => {
        if (!id) return;
        
        // 1. Get User City
        const { data: { user: authUser } } = await supabase.auth.getUser();
        let currentUuid = authUser?.id;

        if (!currentUuid) {
             const { data: demoUsers } = await supabase.from('users').select('*').eq('ativo', true).limit(1);
             if (demoUsers && demoUsers.length > 0) currentUuid = demoUsers[0].uuid;
        }

        if (currentUuid) {
            const { data: userData } = await supabase
                .from('users')
                .select('cidade')
                .eq('uuid', currentUuid)
                .single();
            
            if (userData?.cidade) {
                setUserCityId(userData.cidade);
            }
        }

        // 2. Fetch SubCategories
        const { data, error } = await supabase
            .from('geral')
            .select('*')
            .eq('primaria', false)
            .eq('dependencia', id)
            .eq('ativa', true);

        if (error) console.error(error);
        else {
            const subs = data || [];
            setSubCategories(subs);
            // fetchCounts trigger by useEffect dependency
        }
        setLoading(false);
    };

    init();
  }, [id]);

  useEffect(() => {
    if (subCategories.length > 0) {
        fetchCounts(subCategories);
    }
  }, [userCityId, subCategories]);

  const fetchCounts = async (items: Geral[]) => {
    if (items.length === 0) return;

    try {
      const promises = items.map(async (item) => {
        let query = supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('ativo', true)
          .ilike('tipo', 'profissional') // Case insensitive
          .contains('atividade', [item.id]); 
        
        // CRITICAL: Filter by city to match the ProfessionalList logic
        if (userCityId) {
            query = query.eq('cidade', userCityId);
        }

        const { count } = await query;
        return { id: item.id, count: count || 0 };
      });

      const results = await Promise.all(promises);
      setCounts(prev => {
        const next = { ...prev };
        results.forEach(r => next[r.id] = r.count);
        return next;
      });
    } catch (error) {
      console.error('Error fetching counts:', error);
    }
  };

  const handleSelectService = (service: Geral) => {
    navigate(`/professionals/${service.id}`, { state: { serviceName: service.nome } });
  };

  return (
    <div className="min-h-screen bg-ios-bg">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md px-5 pt-12 pb-4 sticky top-0 z-20 border-b border-gray-200 flex items-center">
        <button 
          onClick={() => navigate(-1)} 
          className="mr-3 p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={24} className="text-ios-blue" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 truncate">{parentName}</h1>
      </div>

      <div className="p-5 pb-20">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 ml-1">
          Selecione o serviço
        </h2>

        {loading ? (
           <div className="space-y-3">
             {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-200 rounded-2xl animate-pulse"></div>)}
           </div>
        ) : (
          <div className="space-y-3">
            {subCategories.map((sub) => (
              <div 
                key={sub.id}
                className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer group"
                onClick={() => handleSelectService(sub)}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 overflow-hidden flex-shrink-0">
                    <img 
                      src={sub.imagem || `https://picsum.photos/seed/${sub.id}/100`} 
                      alt={sub.nome} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{sub.nome}</h3>
                    <div className="flex items-center text-xs text-gray-400 mt-1 font-medium">
                      <Users size={12} className="mr-1.5" />
                      {counts[sub.id] !== undefined ? counts[sub.id] : (userCityId ? 0 : '-')} profissionais
                    </div>
                  </div>
                </div>
                <ArrowRight size={18} className="text-gray-300 group-hover:text-ios-blue transition-colors" />
              </div>
            ))}
            
            {subCategories.length === 0 && (
              <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-gray-300">
                <p className="text-gray-400">Nenhum serviço disponível nesta categoria.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubCategory;