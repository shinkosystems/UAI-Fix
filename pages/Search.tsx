import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Geral } from '../types';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, ArrowRight, Loader2, ChevronRight, LayoutGrid, Box, Users } from 'lucide-react';

const Search: React.FC = () => {
  const [defaultCategories, setDefaultCategories] = useState<Geral[]>([]);
  const [searchResults, setSearchResults] = useState<Geral[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingDefault, setLoadingDefault] = useState(true);
  const [searching, setSearching] = useState(false);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [userCityId, setUserCityId] = useState<number | null>(null);
  const navigate = useNavigate();

  // Load User Data & Default grid (Primary Categories) on mount
  useEffect(() => {
    const init = async () => {
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

        // 2. Fetch Categories
        await fetchDefaultCategories();
    };

    init();
  }, []);

  // Update counts when userCityId is set or categories change
  useEffect(() => {
    if (defaultCategories.length > 0) {
        fetchCounts(defaultCategories);
    }
  }, [userCityId, defaultCategories]);

  // Handle Search Input with Debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.length >= 2) {
        performGlobalSearch(searchTerm);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const fetchCounts = async (items: Geral[]) => {
    if (items.length === 0) return;

    try {
        // 1. Fetch ALL sub-services to map dependencies (Parent -> Children)
        const { data: allSubServices } = await supabase
            .from('geral')
            .select('id, dependencia')
            .eq('primaria', false)
            .eq('ativa', true);

        // Fetch counts in parallel for the displayed items
        const promises = items.map(async (item) => {
            let idsToCheck = [item.id];

            // If it is a primary category, add all its children IDs to the check list
            if (item.primaria && allSubServices) {
                const childrenIds = allSubServices
                    .filter(sub => sub.dependencia === item.id)
                    .map(sub => sub.id);
                idsToCheck = [...idsToCheck, ...childrenIds];
            }
            
            // Build the query
            let query = supabase
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('ativo', true)
                .ilike('tipo', 'profissional') // Case insensitive
                .overlaps('atividade', idsToCheck);
            
            // CRITICAL: Filter by city if user has one
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

  const fetchDefaultCategories = async () => {
    const { data, error } = await supabase
      .from('geral')
      .select('*')
      .eq('primaria', true)
      .eq('ativa', true)
      .order('nome', { ascending: true });

    if (error) console.error(error);
    else {
      const cats = data || [];
      setDefaultCategories(cats);
      // fetchCounts is triggered by useEffect dependency
    }
    setLoadingDefault(false);
  };

  const performGlobalSearch = async (term: string) => {
    setSearching(true);
    try {
      // Search in WHOLE table 'geral' (primaria true OR false)
      const { data, error } = await supabase
        .from('geral')
        .select('*')
        .eq('ativa', true)
        .ilike('nome', `%${term}%`) // Case insensitive search
        .limit(20);

      if (error) throw error;
      const results = data || [];
      setSearchResults(results);
      fetchCounts(results);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleItemClick = async (item: Geral) => {
    if (item.primaria) {
      // Check if this category has children
      const { count } = await supabase
        .from('geral')
        .select('*', { count: 'exact', head: true })
        .eq('dependencia', item.id)
        .eq('ativa', true);

      if (count && count > 0) {
        // Has children -> Go to SubCategories
        navigate(`/category/${item.id}`, { state: { name: item.nome } });
      } else {
        // No children -> Treat as direct service -> Go to Professionals
        navigate(`/professionals/${item.id}`, { state: { serviceName: item.nome } });
      }
    } else {
      // It is a Service -> Go directly to Professionals
      navigate(`/professionals/${item.id}`, { state: { serviceName: item.nome } });
    }
  };

  const showResults = searchTerm.length >= 2;

  return (
    <div className="min-h-screen bg-ios-bg">
      {/* Sticky Header - Desktop adjusted */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-md z-20 px-5 pt-12 md:pt-6 pb-4 border-b border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-4">Buscar</h1>
        <div className="relative max-w-2xl">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar serviços ou categorias..."
            className="w-full bg-gray-100 text-gray-900 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ios-blue/50 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Loader2 className="animate-spin text-ios-blue" size={16} />
            </div>
          )}
        </div>
      </div>

      <div className="p-5 pb-20">
        {showResults ? (
          /* SEARCH RESULTS VIEW */
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 ml-1">
              Resultados para "{searchTerm}"
            </h2>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100 md:grid md:grid-cols-2 lg:grid-cols-3 md:divide-y-0 md:gap-4 md:bg-transparent md:border-none md:shadow-none">
              {searchResults.length > 0 ? (
                searchResults.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="w-full flex items-center p-4 hover:bg-gray-50 transition-colors text-left md:bg-white md:rounded-2xl md:shadow-sm md:border md:border-gray-100"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-4 ${item.primaria ? 'bg-blue-50 text-ios-blue' : 'bg-green-50 text-green-600'}`}>
                      {item.imagem ? (
                         <img src={item.imagem} alt="" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                         item.primaria ? <LayoutGrid size={20} /> : <Box size={20} />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm">{item.nome}</h3>
                      <div className="flex items-center space-x-2 text-xs text-gray-400 mt-0.5">
                        <span>{item.primaria ? 'Categoria' : 'Serviço'}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                        <span className="flex items-center text-gray-500">
                            <Users size={10} className="mr-1" />
                            {counts[item.id] !== undefined ? counts[item.id] : (userCityId ? 0 : '-')}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300" />
                  </button>
                ))
              ) : (
                !searching && (
                  <div className="p-8 text-center text-gray-400 text-sm col-span-full">
                    Nenhum resultado encontrado.
                  </div>
                )
              )}
            </div>
          </div>
        ) : (
          /* DEFAULT GRID VIEW */
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 ml-1">
              Categorias Principais
            </h2>

            {loadingDefault ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-40 bg-gray-200 rounded-3xl animate-pulse"></div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {defaultCategories.map((cat) => (
                  <div 
                    key={cat.id}
                    onClick={() => handleItemClick(cat)}
                    className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all cursor-pointer aspect-square flex flex-col justify-end"
                  >
                    {/* Background Image Effect */}
                    <div className="absolute inset-0 z-0">
                      <img 
                         src={cat.imagem || `https://picsum.photos/seed/${cat.id}/400`} 
                         alt={cat.nome} 
                         className="w-full h-full object-cover opacity-90 group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                    </div>

                    <div className="relative z-10 w-full">
                      <div className="flex justify-between items-end">
                        <div>
                            <h3 className="text-white font-bold text-lg leading-tight mb-1">{cat.nome}</h3>
                            <div className="flex items-center text-white/80 text-xs font-medium">
                                <span>Explorar</span>
                                <ArrowRight size={12} className="ml-1" />
                            </div>
                        </div>
                        
                        {/* Professionals Count Badge */}
                        <div className="bg-black/30 backdrop-blur-md px-2 py-1 rounded-lg text-white text-[10px] font-bold flex items-center border border-white/10">
                            <Users size={10} className="mr-1" />
                            {counts[cat.id] !== undefined ? counts[cat.id] : (userCityId ? 0 : '...')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;