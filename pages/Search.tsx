import React, { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Geral } from '../types';
import { useNavigate } from 'react-router-dom';
import { 
  Search as SearchIcon, 
  ArrowRight, 
  Loader2, 
  ChevronRight, 
  LayoutGrid, 
  Box, 
  Users, 
  Bell, 
  X, 
  SlidersHorizontal, 
  ArrowUpDown, 
  MapPin, 
  Sparkles, 
  Layers,
  Check
} from 'lucide-react';
import { isServiceMatch } from '../utils/serviceSynonyms';

interface NotificationItem {
  id: number;
  title: string;
  description: string;
  date: string;
  type: 'agenda' | 'planning' | 'approval';
  read: boolean;
}

type SortOption = 'az' | 'za' | 'pros';
type ViewMode = 'services' | 'categories';

const POPULAR_TAGS = [
  'Elétrica',
  'Hidráulica',
  'Pintura',
  'Ar-condicionado',
  'Chuveiro',
  'Fechadura',
  'Limpeza',
  'Montagem'
];

const Search: React.FC = () => {
  const [defaultCategories, setDefaultCategories] = useState<Geral[]>([]);
  const [allServices, setAllServices] = useState<Geral[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyWithPros, setOnlyWithPros] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortOption>('az');
  const [viewMode, setViewMode] = useState<ViewMode>('services');
  
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [userCityId, setUserCityId] = useState<number | null>(null);
  const [cityName, setCityName] = useState<string>('');
  
  // User & Notification State
  const [userName, setUserName] = useState<string>('');
  const [userType, setUserType] = useState<string>('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        let currentUuid = authUser?.id;

        if (!currentUuid) {
          const { data: demoUsers } = await supabase.from('users').select('*').eq('ativo', true).limit(1);
          if (demoUsers && demoUsers.length > 0) currentUuid = demoUsers[0].uuid;
        }

        let cityId: number | null = null;
        if (currentUuid) {
          const { data: userData } = await supabase
            .from('users')
            .select('cidade, nome, tipo')
            .eq('uuid', currentUuid)
            .single();
          
          if (userData) {
            if (userData.cidade) {
              cityId = userData.cidade;
              setUserCityId(userData.cidade);
              fetchCityName(userData.cidade);
            }
            if (userData.nome && userData.nome !== 'Insere') setUserName(userData.nome.split(' ')[0]);
            setUserType(userData.tipo || '');
            fetchNotifications(userData.tipo || '', currentUuid);
          }
        }

        // Fetch Categories and Services in parallel
        const [catsRes, servicesRes] = await Promise.all([
          supabase.from('geral').select('*').eq('primaria', true).eq('ativa', true).order('nome', { ascending: true }),
          supabase.from('geral').select('*').eq('primaria', false).eq('ativa', true).order('nome', { ascending: true })
        ]);

        const cats = catsRes.data || [];
        const servs = servicesRes.data || [];
        
        setDefaultCategories(cats);
        setAllServices(servs);

        // Fetch counts efficiently
        await fetchOptimizedCounts(cats, servs, cityId);
      } catch (err) {
        console.error('Erro ao inicializar catálogo:', err);
      } finally {
        setLoading(false);
      }
    };

    init();

    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCityName = async (cidadeId: number) => {
    try {
      const { data } = await supabase.from('cidades').select('cidade, uf').eq('id', cidadeId).single();
      if (data) {
        setCityName(`${data.cidade} - ${data.uf}`);
      }
    } catch (e) {
      console.error('Erro ao buscar nome da cidade:', e);
    }
  };

  const fetchOptimizedCounts = async (cats: Geral[], servs: Geral[], cityId: number | null) => {
    try {
      let query = supabase
        .from('users')
        .select('atividade')
        .eq('ativo', true)
        .ilike('tipo', 'profissional');

      if (cityId) {
        query = query.eq('cidade', cityId);
      }

      const { data: pros, error } = await query;
      if (error) throw error;

      const newCounts: Record<number, number> = {};

      pros?.forEach(p => {
        if (Array.isArray(p.atividade)) {
          p.atividade.forEach(actId => {
            newCounts[actId] = (newCounts[actId] || 0) + 1;
          });
        }
      });

      // Calcular contagem acumulada para categorias primárias
      cats.forEach(cat => {
        const childIds = servs.filter(s => s.dependencia === cat.id).map(s => s.id);
        const idsToCheck = new Set([cat.id, ...childIds]);
        let catCount = 0;
        pros?.forEach(p => {
          if (Array.isArray(p.atividade) && p.atividade.some(a => idsToCheck.has(a))) {
            catCount++;
          }
        });
        newCounts[cat.id] = catCount;
      });

      setCounts(newCounts);
    } catch (err) {
      console.error('Erro ao calcular contagem de profissionais:', err);
    }
  };

  const fetchNotifications = async (role: string, uuid: string) => {
    const normalizedRole = role.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let notifs: NotificationItem[] = [];

    try {
      if (['planejista', 'orcamentista', 'gestor'].includes(normalizedRole)) {
        const { data } = await supabase
          .from('chaves')
          .select(`id, created_at, chaveunica, status, geral (nome)`)
          .in('status', ['pendente', 'analise'])
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (data) {
          notifs = data.map((item: any) => ({ 
            id: item.id, 
            title: item.status === 'analise' ? 'Aguardando Orçamento' : 'Novo Chamado Pendente', 
            description: `Chave: ${item.chaveunica} - ${item.geral?.nome}`, 
            date: new Date(item.created_at).toLocaleDateString('pt-BR'), 
            type: 'planning', 
            read: false 
          }));
        }
      } else {
        const [agendaRes, chavesRes] = await Promise.all([
          supabase.from('agenda').select(`id, execucao, observacoes, chaves (geral (nome), status)`).or(`cliente.eq.${uuid},profissional.eq.${uuid}`).order('execucao', { ascending: false }).limit(5),
          supabase.from('chaves').select(`id, created_at, status, geral (nome)`).eq('cliente', uuid).eq('status', 'aguardando_aprovacao').limit(5)
        ]);

        if (chavesRes.data) {
          const approvalNotifs: NotificationItem[] = chavesRes.data.map(c => ({
            id: c.id,
            title: 'Orçamento Pronto!',
            description: `O orçamento para "${(c.geral as any)?.nome || (c.geral as any)?.[0]?.nome}" está disponível para sua aprovação.`,
            date: new Date(c.created_at).toLocaleDateString('pt-BR'),
            type: 'approval',
            read: false
          }));
          notifs = [...approvalNotifs];
        }

        if (agendaRes.data) {
          const agendaNotifs: NotificationItem[] = agendaRes.data.map((item: any) => ({
            id: item.id,
            title: item.chaves?.geral?.nome || 'Serviço Agendado',
            description: `Status: ${item.chaves?.status.replace('_',' ')}`,
            date: new Date(item.execucao).toLocaleDateString('pt-BR'),
            type: 'agenda',
            read: false
          }));
          notifs = [...notifs, ...agendaNotifs];
        }
      }
      setNotifications(notifs.slice(0, 10));
    } catch (error) {
      console.error("Erro ao buscar notificações:", error);
    }
  };

  const handleNotificationClick = (notif: NotificationItem) => {
    setShowNotifications(false);
    const type = userType.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (['planejista', 'orcamentista', 'gestor'].includes(type)) navigate('/chamados');
    else if (type === 'consumidor' || notif.type === 'approval') navigate('/orders');
    else navigate('/calendar');
  };

  const normalizeStr = (str: string) =>
    str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";

  // Mapa de categorias por ID para obter nome rapidamente
  const categoryMap = useMemo(() => {
    const map = new Map<number, string>();
    defaultCategories.forEach(c => map.set(c.id, c.nome));
    return map;
  }, [defaultCategories]);

  // Filtragem e Ordenação Composta dos Serviços
  const filteredServices = useMemo(() => {
    let result = [...allServices];

    // 1. Filtro por Categoria Pai
    if (selectedCategory !== 'all') {
      const catId = parseInt(selectedCategory, 10);
      result = result.filter(s => s.dependencia === catId);
    }

    // 2. Filtro por Termo de Busca (com expansão semântica de sinônimos)
    if (searchTerm.trim()) {
      result = result.filter(s => {
        const parentName = categoryMap.get(s.dependencia || 0) || '';
        return isServiceMatch(s.nome, parentName, searchTerm);
      });
    }

    // 3. Filtro de Profissionais Disponíveis
    if (onlyWithPros) {
      result = result.filter(s => (counts[s.id] || 0) > 0);
    }

    // 4. Ordenação
    result.sort((a, b) => {
      if (sortBy === 'az') {
        return (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' });
      } else if (sortBy === 'za') {
        return (b.nome || '').localeCompare(a.nome || '', 'pt-BR', { sensitivity: 'base' });
      } else if (sortBy === 'pros') {
        const countA = counts[a.id] || 0;
        const countB = counts[b.id] || 0;
        if (countB !== countA) return countB - countA;
        return (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' });
      }
      return 0;
    });

    return result;
  }, [allServices, selectedCategory, searchTerm, onlyWithPros, sortBy, counts, categoryMap]);

  // Filtragem de Categorias
  const filteredCategories = useMemo(() => {
    let result = [...defaultCategories];

    if (searchTerm.trim()) {
      result = result.filter(c => isServiceMatch(c.nome, '', searchTerm));
    }

    if (onlyWithPros) {
      result = result.filter(c => (counts[c.id] || 0) > 0);
    }

    result.sort((a, b) => {
      if (sortBy === 'az') {
        return (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' });
      } else if (sortBy === 'za') {
        return (b.nome || '').localeCompare(a.nome || '', 'pt-BR', { sensitivity: 'base' });
      } else if (sortBy === 'pros') {
        const countA = counts[a.id] || 0;
        const countB = counts[b.id] || 0;
        if (countB !== countA) return countB - countA;
        return (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' });
      }
      return 0;
    });

    return result;
  }, [defaultCategories, searchTerm, onlyWithPros, sortBy, counts]);

  const handleServiceClick = (service: Geral) => {
    navigate(`/request/${service.id}`, { state: { serviceName: service.nome } });
  };

  const handleCategoryClick = (cat: Geral) => {
    navigate(`/category/${cat.id}`, { state: { name: cat.nome } });
  };

  const handleTagClick = (tag: string) => {
    if (searchTerm.toLowerCase() === tag.toLowerCase()) {
      setSearchTerm('');
    } else {
      setSearchTerm(tag);
      setViewMode('services');
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setOnlyWithPros(false);
    setSortBy('az');
  };

  const hasActiveFilters = searchTerm !== '' || selectedCategory !== 'all' || onlyWithPros || sortBy !== 'az';

  return (
    <div className="min-h-screen bg-ios-bg pb-24">
      {/* Header Fixo */}
      <div className="sticky top-0 bg-white/85 backdrop-blur-xl z-40 px-5 pt-10 md:pt-6 pb-4 border-b border-gray-200/80 shadow-xs">
        <div className="flex justify-between items-center mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Catálogo de Serviços</h1>
            </div>
            {cityName && (
              <div className="flex items-center text-xs font-semibold text-gray-500 mt-0.5">
                <MapPin size={12} className="mr-1 text-ios-blue" />
                <span>{cityName}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Notificações */}
            <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)} 
                className="relative p-2.5 rounded-full bg-gray-100/80 hover:bg-gray-200 transition-colors shadow-xs"
                title="Notificações"
              >
                <Bell size={18} className="text-gray-700" />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-12 w-80 bg-white/95 backdrop-blur-xl border border-gray-200 shadow-2xl rounded-[1.5rem] overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2">
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-gray-900 text-sm">Notificações</h3>
                    <button onClick={() => setShowNotifications(false)}><X size={16} className="text-gray-400"/></button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map((notif) => (
                        <div 
                          key={notif.id} 
                          onClick={() => handleNotificationClick(notif)} 
                          className={`p-4 border-b border-gray-50 hover:bg-blue-50 cursor-pointer ${notif.type === 'approval' ? 'bg-orange-50/30' : ''}`}
                        >
                          <div className="flex justify-between mb-1">
                            <span className={`text-[10px] font-black px-1.5 rounded uppercase ${
                              notif.type === 'approval' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {notif.type === 'approval' ? 'Aprovação' : notif.type}
                            </span>
                            <span className="text-[10px] text-gray-400">{notif.date}</span>
                          </div>
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
        </div>

        {/* Barra de Busca Principal */}
        <div className="relative max-w-2xl">
          <SearchIcon className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por serviço, categoria, palavra-chave..." 
            className="w-full bg-gray-100 text-gray-900 rounded-2xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ios-blue/40 transition-all placeholder:text-gray-400 font-medium" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Tags de Busca Rápida */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-3 pb-1 -mx-5 px-5">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex-shrink-0 flex items-center mr-1">
            <Sparkles size={12} className="mr-1 text-amber-500" /> Populares:
          </span>
          {POPULAR_TAGS.map((tag) => {
            const isActive = normalizeStr(searchTerm) === normalizeStr(tag);
            return (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                  isActive 
                    ? 'bg-ios-blue text-white shadow-xs scale-105' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200/80'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5 space-y-5 max-w-7xl mx-auto">
        {/* Barra de Filtros e Categorias */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-4">
          {/* Categoria Selector Chips */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Categorias Principais
              </label>
              {selectedCategory !== 'all' && (
                <button
                  onClick={() => setSelectedCategory('all')}
                  className="text-xs font-bold text-ios-blue hover:underline"
                >
                  Ver Todas
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-2 px-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 ${
                  selectedCategory === 'all'
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <LayoutGrid size={13} />
                <span>Todas</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedCategory === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {allServices.length}
                </span>
              </button>

              {defaultCategories.map((cat) => {
                const isSelected = selectedCategory === String(cat.id);
                const subCount = allServices.filter(s => s.dependencia === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(String(cat.id))}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 ${
                      isSelected
                        ? 'bg-ios-blue text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <span>{cat.nome}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {subCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
            {/* Alternador de Modo de Visualização */}
            <div className="flex items-center bg-gray-100/90 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('services')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'services'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Box size={14} />
                <span>Catálogo ({filteredServices.length})</span>
              </button>
              <button
                onClick={() => setViewMode('categories')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'categories'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Layers size={14} />
                <span>Categorias ({filteredCategories.length})</span>
              </button>
            </div>

            {/* Controles de Filtro & Ordenação */}
            <div className="flex items-center flex-wrap gap-2">
              {/* Toggle de Apenas com Profissionais */}
              <button
                onClick={() => setOnlyWithPros(!onlyWithPros)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  onlyWithPros
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
                title="Mostrar apenas serviços com profissionais disponíveis na cidade"
              >
                <Users size={13} className={onlyWithPros ? 'text-emerald-600' : 'text-gray-400'} />
                <span>Com profissionais</span>
                {onlyWithPros && <Check size={13} className="text-emerald-600 ml-0.5" />}
              </button>

              {/* Seletor de Ordenação */}
              <div className="flex items-center bg-white border border-gray-200 rounded-xl px-2.5 py-1 text-xs">
                <ArrowUpDown size={13} className="text-gray-400 mr-1.5 flex-shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent text-gray-700 font-bold text-xs focus:outline-none cursor-pointer pr-1"
                >
                  <option value="az">A → Z</option>
                  <option value="za">Z → A</option>
                  <option value="pros">Mais profissionais</option>
                </select>
              </div>

              {/* Botão Limpar Filtros */}
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-xs font-bold text-rose-500 hover:text-rose-600 px-2 py-1 hover:underline"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Resumo e Contador de Resultados */}
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-gray-500">
            {viewMode === 'services' ? (
              <>Exibindo <span className="font-bold text-gray-900">{filteredServices.length}</span> serviços no catálogo</>
            ) : (
              <>Exibindo <span className="font-bold text-gray-900">{filteredCategories.length}</span> categorias principais</>
            )}
            {selectedCategory !== 'all' && (
              <span className="ml-1 text-ios-blue font-bold">
                em "{categoryMap.get(parseInt(selectedCategory, 10)) || 'Categoria'}"
              </span>
            )}
          </p>
        </div>

        {/* Renderização dos Itens */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="h-44 bg-gray-200 rounded-3xl animate-pulse"></div>
            ))}
          </div>
        ) : viewMode === 'services' ? (
          /* MODO CATÁLOGO DE SERVIÇOS */
          <div>
            {filteredServices.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredServices.map((service) => {
                  const proCount = counts[service.id] || 0;
                  const parentName = categoryMap.get(service.dependencia || 0) || 'Geral';

                  return (
                    <div
                      key={service.id}
                      onClick={() => handleServiceClick(service)}
                      className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between active:scale-[0.98]"
                    >
                      <div>
                        {/* Imagem e Badge */}
                        <div className="flex items-start gap-3.5 mb-3">
                          <div className="w-14 h-14 rounded-2xl bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-100 group-hover:scale-105 transition-transform duration-300">
                            <img
                              src={service.imagem || `https://picsum.photos/seed/${service.id}/150`}
                              alt={service.nome}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md text-[10px] font-bold uppercase tracking-wider mb-1 truncate max-w-full">
                              {parentName}
                            </span>
                            <h3 className="font-bold text-gray-900 text-sm leading-snug group-hover:text-ios-blue transition-colors line-clamp-2">
                              {service.nome}
                            </h3>
                          </div>
                        </div>
                      </div>

                      {/* Footer do Card */}
                      <div className="pt-3 border-t border-gray-50 flex items-center justify-between mt-1">
                        <div className="flex items-center text-xs font-semibold">
                          <Users size={13} className={`mr-1.5 ${proCount > 0 ? 'text-emerald-600' : 'text-gray-400'}`} />
                          <span className={proCount > 0 ? 'text-emerald-700' : 'text-gray-400'}>
                            {proCount} {proCount === 1 ? 'profissional' : 'profissionais'}
                          </span>
                        </div>

                        <span className="flex items-center text-xs font-bold text-ios-blue group-hover:translate-x-0.5 transition-transform">
                          Solicitar <ArrowRight size={13} className="ml-1" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-12 text-center max-w-md mx-auto my-6 space-y-3">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
                  <SearchIcon size={22} />
                </div>
                <h3 className="font-bold text-gray-900 text-base">Nenhum serviço encontrado</h3>
                <p className="text-xs text-gray-500">
                  Não encontramos serviços correspondentes aos filtros aplicados. Tente ajustar os termos de busca ou a categoria.
                </p>
                <button
                  onClick={resetFilters}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-ios-blue text-white rounded-xl text-xs font-bold shadow-sm hover:bg-blue-600 transition-colors"
                >
                  Limpar todos os filtros
                </button>
              </div>
            )}
          </div>
        ) : (
          /* MODO CATEGORIAS PRINCIPAIS */
          <div>
            {filteredCategories.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredCategories.map((cat) => {
                  const subCount = allServices.filter(s => s.dependencia === cat.id).length;
                  const proCount = counts[cat.id] || 0;

                  return (
                    <div
                      key={cat.id}
                      onClick={() => handleCategoryClick(cat)}
                      className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all cursor-pointer aspect-square flex flex-col justify-end active:scale-[0.98]"
                    >
                      <div className="absolute inset-0 z-0">
                        <img
                          src={cat.imagem || `https://picsum.photos/seed/${cat.id}/400`}
                          alt={cat.nome}
                          className="w-full h-full object-cover opacity-90 group-hover:scale-110 transition-transform duration-700"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                      </div>

                      <div className="relative z-10 w-full">
                        <div className="flex justify-between items-end">
                          <div>
                            <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider block mb-0.5">
                              {subCount} {subCount === 1 ? 'serviço' : 'serviços'}
                            </span>
                            <h3 className="text-white font-bold text-lg leading-tight mb-1">
                              {cat.nome}
                            </h3>
                            <div className="flex items-center text-white/90 text-xs font-semibold">
                              <span>Explorar</span>
                              <ChevronRight size={14} className="ml-0.5 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>

                          <div className="bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-xl text-white text-[10px] font-bold flex items-center border border-white/20 shadow-xs">
                            <Users size={11} className="mr-1 text-emerald-400" />
                            <span>{proCount}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-12 text-center max-w-md mx-auto my-6 space-y-3">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
                  <SearchIcon size={22} />
                </div>
                <h3 className="font-bold text-gray-900 text-base">Nenhuma categoria encontrada</h3>
                <p className="text-xs text-gray-500">
                  Não encontramos categorias correspondentes ao termo de busca.
                </p>
                <button
                  onClick={resetFilters}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-ios-blue text-white rounded-xl text-xs font-bold shadow-sm hover:bg-blue-600 transition-colors"
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

export default Search;
