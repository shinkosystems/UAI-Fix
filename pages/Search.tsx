
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Geral } from '../types';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, ArrowRight, Loader2, ChevronRight, LayoutGrid, Box, Users, Bell, X } from 'lucide-react';

interface NotificationItem {
  id: number;
  title: string;
  description: string;
  date: string;
  type: 'agenda' | 'planning';
  read: boolean;
}

const Search: React.FC = () => {
  const [defaultCategories, setDefaultCategories] = useState<Geral[]>([]);
  const [searchResults, setSearchResults] = useState<Geral[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingDefault, setLoadingDefault] = useState(true);
  const [searching, setSearching] = useState(false);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [userCityId, setUserCityId] = useState<number | null>(null);
  
  // User & Notification State
  const [userName, setUserName] = useState<string>('');
  const [userType, setUserType] = useState<string>('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  
  const navigate = useNavigate();

  // Load User Data & Default grid (Primary Categories) on mount
  useEffect(() => {
    const init = async () => {
        // 1. Get User City & Info
        const { data: { user: authUser } } = await supabase.auth.getUser();
        let currentUuid = authUser?.id;

        if (!currentUuid) {
             const { data: demoUsers } = await supabase.from('users').select('*').eq('ativo', true).limit(1);
             if (demoUsers && demoUsers.length > 0) currentUuid = demoUsers[0].uuid;
        }

        if (currentUuid) {
            const { data: userData } = await supabase
                .from('users')
                .select('cidade, nome, tipo')
                .eq('uuid', currentUuid)
                .single();
            
            if (userData) {
                if (userData.cidade) setUserCityId(userData.cidade);
                if (userData.nome && userData.nome !== 'Insere') setUserName(userData.nome.split(' ')[0]);
                setUserType(userData.tipo || '');
                
                // Fetch notifications
                fetchNotifications(userData.tipo || '', currentUuid);
            }
        }

        // 2. Fetch Categories
        await fetchDefaultCategories();
    };

    init();

    // Close notifications when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const fetchNotifications = async (role: string, uuid: string) => {
      const normalizedRole = role.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      let notifs: NotificationItem[] = [];

      try {
          if (normalizedRole === 'planejista' || normalizedRole === 'orcamentista' || normalizedRole === 'gestor') {
              const targetStatus = normalizedRole === 'planejista' ? 'pendente' : (normalizedRole === 'orcamentista' ? 'analise' : null);
              
              let query = supabase.from('chaves').select(`id, created_at, chaveunica, status, geral (nome)`);
              
              if (targetStatus) {
                  query = query.eq('status', targetStatus);
              } else {
                  query = query.in('status', ['pendente', 'analise']);
              }

              const { data } = await query.order('created_at', { ascending: false }).limit(10);
              
              if (data) {
                  notifs = data.map((item: any) => ({ 
                      id: item.id, 
                      title: item.status === 'analise' ? 'Novo Orçamento Pendente' : 'Novo Planejamento Pendente', 
                      description: `Chave: ${item.chaveunica} - ${item.geral?.nome}`, 
                      date: new Date(item.created_at).toLocaleDateString('pt-BR'), 
                      type: 'planning', 
                      read: false 
                  }));
              }
          } 
          else if (normalizedRole === 'consumidor') {
              const { data } = await supabase
                  .from('agenda')
                  .select(`id, execucao, observacoes, chaves (geral (nome), status)`)
                  .eq('cliente', uuid)
                  .order('execucao', { ascending: false })
                  .limit(10);
                  
              if (data) {
                  notifs = data.map((item: any) => ({
                      id: item.id,
                      title: item.chaves?.geral?.nome || 'Serviço Agendado',
                      description: `Status: ${item.chaves?.status}. ${item.observacoes || ''}`,
                      date: new Date(item.execucao).toLocaleDateString('pt-BR'),
                      type: 'agenda',
                      read: false
                  }));
              }
          }
          else if (normalizedRole === 'profissional') {
              const { data } = await supabase
                  .from('agenda')
                  .select(`id, execucao, observacoes, chaves (geral (nome), status)`)
                  .eq('profissional', uuid)
                  .order('execucao', { ascending: false })
                  .limit(10);
              
              if (data) {
                   notifs = data.map((item: any) => ({
                      id: item.id,
                      title: 'Novo Agendamento',
                      description: `${item.chaves?.geral?.nome} - Status: ${item.chaves?.status}`,
                      date: new Date(item.execucao).toLocaleDateString('pt-BR'),
                      type: 'agenda',
                      read: false
                  }));
              }
          }
          setNotifications(notifs);
      } catch (error) {
          console.error("Erro ao buscar notificações:", error);
      }
  };

  const handleNotificationClick = (notif: NotificationItem) => {
      setShowNotifications(false);
      const type = userType.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (type === 'planejista' || type === 'orcamentista' || type === 'gestor') navigate('/chamados');
      else if (type === 'consumidor') navigate('/orders');
      else navigate('/calendar');
  };

  const fetchCounts = async (items: Geral[]) => {
    if (items.length === 0) return;

    try {
        const { data: allSubServices } = await supabase
            .from('geral')
            .select('id, dependencia')
            .eq('primaria', false)
            .eq('ativa', true);

        const promises = items.map(async (item) => {
            let idsToCheck = [item.id];
            if (item.primaria && allSubServices) {
                const childrenIds = allSubServices
                    .filter(sub => sub.dependencia === item.id)
                    .map(sub => sub.id);
                idsToCheck = [...idsToCheck, ...childrenIds];
            }
            
            let query = supabase
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('ativo', true)
                .ilike('tipo', 'profissional')
                .overlaps('atividade', idsToCheck);
            
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
    }
    setLoadingDefault(false);
  };

  const performGlobalSearch = async (term: string) => {
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('geral')
        .select('*')
        .eq('ativa', true)
        .ilike('nome', `%${term}%`)
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
      const { count } = await supabase
        .from('geral')
        .select('*', { count: 'exact', head: true })
        .eq('dependencia', item.id)
        .eq('ativa', true);

      if (count && count > 0) {
        navigate(`/category/${item.id}`, { state: { name: item.nome } });
      } else {
        navigate(`/professionals/${item.id}`, { state: { serviceName: item.nome } });
      }
    } else {
      navigate(`/professionals/${item.id}`, { state: { serviceName: item.nome } });
    }
  };

  const showResults = searchTerm.length >= 2;

  return (
    <div className="min-h-screen bg-ios-bg">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-md z-20 px-5 pt-12 md:pt-6 pb-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
             <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Buscar</h1>
             
             {/* Notification Bell */}
             <div className="relative" ref={notificationRef}>
                <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                    <Bell size={20} className="text-gray-700" />
                    {notifications.length > 0 && (
                        <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full ring-1 ring-white"></span>
                    )}
                </button>
                
                {showNotifications && (
                    <div className="absolute right-0 top-12 w-80 bg-white/95 backdrop-blur-xl border border-gray-200 shadow-2xl rounded-[1.5rem] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-gray-900 text-sm">Notificações</h3>
                            <button onClick={() => setShowNotifications(false)}><X size={16} className="text-gray-400"/></button>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {notifications.length > 0 ? (
                                notifications.map((notif) => (
                                    <div key={notif.id} onClick={() => handleNotificationClick(notif)} className="p-4 border-b border-gray-50 hover:bg-blue-50 cursor-pointer">
                                        <div className="flex justify-between mb-1"><span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded font-bold uppercase">{notif.type}</span><span className="text-[10px] text-gray-400">{notif.date}</span></div>
                                        <h4 className="text-sm font-bold text-gray-900">{notif.title}</h4>
                                        <p className="text-xs text-gray-500 truncate">{notif.description}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="p-6 text-center text-xs text-gray-400">Nenhuma notificação nova.</div>
                            )}
                        </div>
                    </div>
                )}
             </div>
        </div>

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
