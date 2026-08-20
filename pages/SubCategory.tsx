
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Geral } from '../types';
import { ChevronLeft, ArrowRight, Users, Search, X } from 'lucide-react';
import { isServiceMatch } from '../utils/serviceSynonyms';

const SubCategory: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const parentName = location.state?.name || 'Serviços';

  const [subCategories, setSubCategories] = useState<Geral[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
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
            .eq('ativa', true)
            .order('nome', { ascending: true });

        if (error) console.error(error);
        else {
            const subs = (data || []).sort((a, b) =>
                (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' })
            );
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
    // Navigate directly to Request flow
    navigate(`/request/${service.id}`, { state: { serviceName: service.nome } });
  };

  const filteredSubCategories = useMemo(() => {
    if (!searchTerm.trim()) return subCategories;
    return subCategories.filter(s => isServiceMatch(s.nome, parentName, searchTerm));
  }, [subCategories, parentName, searchTerm]);

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
        {/* Campo de Busca Manual */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder={`Buscar serviço em ${parentName}...`}
            className="w-full bg-white text-gray-900 rounded-2xl pl-10 pr-10 py-3 text-sm border border-gray-200/80 shadow-xs focus:outline-none focus:ring-2 focus:ring-ios-blue/30 transition-all font-medium placeholder:text-gray-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
              title="Limpar busca"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mb-4 ml-1">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {searchTerm.trim() ? `Resultados (${filteredSubCategories.length})` : 'Selecione o serviço'}
          </h2>
          {searchTerm.trim() && (
            <button 
              onClick={() => setSearchTerm('')}
              className="text-xs font-bold text-ios-blue hover:underline"
            >
              Limpar filtro
            </button>
          )}
        </div>

        {loading ? (
           <div className="space-y-3">
             {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-200 rounded-2xl animate-pulse"></div>)}
           </div>
        ) : (
          <div className="space-y-3">
            {filteredSubCategories.map((sub) => (
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

            {subCategories.length > 0 && filteredSubCategories.length === 0 && (
              <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-gray-300 px-4">
                <p className="text-gray-500 font-medium text-sm">Nenhum serviço encontrado para "{searchTerm}".</p>
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-3 text-xs font-bold text-ios-blue bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors"
                >
                  Limpar busca
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubCategory;
