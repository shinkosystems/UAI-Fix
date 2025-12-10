import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { createClient } from '@supabase/supabase-js'; // Importar createClient para instância temporária
import { Geral, User, City, Estado } from '../types';
import { Loader2, Plus, Edit2, Trash2, X, Save, CheckCircle, AlertTriangle, Layers, Users, Link as LinkIcon, Image as ImageIcon, ArrowRightLeft, FolderTree, LayoutGrid, Box, CloudUpload, Search, Filter, Check, Briefcase, MapPin, Phone, FileText, Lock, Home, Navigation, User as UserIcon } from 'lucide-react';

// Hardcoded keys for temp client (mesmas do supabaseClient.ts)
const SUPABASE_URL = 'https://uehyjyyvkrlggwmfdhgh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlaHlqeXl2a3JsZ2d3bWZkaGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0MDEzNzUsImV4cCI6MjA1Nzk3NzM3NX0.3CKTTryjia-5nXQYk1jJxPYryDmF1hTKpHrJkVKqRJY';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'services' | 'users'>('services');
  const [serviceSubTab, setServiceSubTab] = useState<'primary' | 'secondary'>('primary');
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [services, setServices] = useState<Geral[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [states, setStates] = useState<Estado[]>([]);
  
  // Filter States for Services
  const [serviceFilterName, setServiceFilterName] = useState('');
  const [serviceFilterStatus, setServiceFilterStatus] = useState('all');
  const [serviceFilterParent, setServiceFilterParent] = useState('all');

  // Filter States for Users
  const [filterName, setFilterName] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCity, setFilterCity] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // City Search Modal State (For User Edit)
  const [isCitySearchOpen, setIsCitySearchOpen] = useState(false);
  const [citySearchTerm, setCitySearchTerm] = useState('');
  const [searchedCities, setSearchedCities] = useState<City[]>([]);
  const [searchingCity, setSearchingCity] = useState(false);

  // Activity Search State (For Professional Edit)
  const [activitySearchTerm, setActivitySearchTerm] = useState('');

  // Upload State
  const [uploading, setUploading] = useState(false);
  
  // Reassignment State
  const [orphanedChildrenCount, setOrphanedChildrenCount] = useState(0);
  const [newParentId, setNewParentId] = useState<number | ''>('');
  const [availableParents, setAvailableParents] = useState<Geral[]>([]);

  // Form State
  const [formData, setFormData] = useState<any>({});
  const [password, setPassword] = useState(''); // Estado separado para senha
  const [loadingCep, setLoadingCep] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Debounce for City Search Modal
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (citySearchTerm.length >= 2) {
        performCitySearch(citySearchTerm);
      } else {
        setSearchedCities([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [citySearchTerm]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Always fetch Services (Geral) because we need them for the Professional Activity Selector
      const { data: servicesData, error: servicesError } = await supabase.from('geral').select('*').order('nome', { ascending: true });
      if (servicesError) throw servicesError;
      setServices(servicesData || []);

      // 2. Fetch Aux Data
      const { data: statesData } = await supabase.from('estados').select('*');
      if (statesData) setStates(statesData);

      const { data: citiesData } = await supabase.from('cidades').select('*').order('cidade', { ascending: true });
      if (citiesData) setCities(citiesData);

      // 3. Fetch Users if tab is active
      if (activeTab === 'users') {
        // USE EXPLICIT ALIAS to guarantee we get the city object, solving the ID display issue
        const { data, error } = await supabase
            .from('users')
            .select('*, cidade_data:cidades(cidade, uf)') 
            .order('id', { ascending: true });
            
        if (error) throw error;
        setUsers(data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- HELPERS DE FORMATAÇÃO E BUSCA ---
  const formatUserType = (type: string) => {
      if (!type) return '';
      return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  };

  const formatCpf = (v: string) => {
    if (!v) return '';
    return v.replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .slice(0, 14);
  };

  const formatCep = (v: string) => {
    if (!v) return '';
    return v.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9);
  };

  const formatPhone = (v: string) => {
      if (!v) return '';
      const r = v.replace(/\D/g, "");
      if (r.length > 10) {
          return r.replace(/^(\d\d)(\d{5})(\d{4}).*/, "($1) $2-$3");
      } else if (r.length > 5) {
          return r.replace(/^(\d\d)(\d{4})(\d{0,4}).*/, "($1) $2-$3");
      } else if (r.length > 2) {
          return r.replace(/^(\d\d)(\d{0,5}).*/, "($1) $2");
      } else {
          return v.replace(/\D/g, "");
      }
  };

  const fetchCepData = async () => {
      const cep = formData.cep;
      if (!cep) return;
      
      const cleanCep = cep.replace(/\D/g, '');
      if (cleanCep.length === 8) {
          setLoadingCep(true);
          try {
              const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
              const data = await response.json();
              
              if (!data.erro) {
                  const updates: any = {
                      rua: data.logradouro,
                      bairro: data.bairro
                  };

                  // Tenta encontrar a cidade na base
                  if(data.localidade) {
                      const { data: cityDB } = await supabase
                        .from('cidades')
                        .select('*')
                        .ilike('cidade', data.localidade)
                        .single();
                      
                      if(cityDB) {
                          updates.cidade = cityDB.id;
                          updates.estado = cityDB.uf;
                          updates.cidade_data = { cidade: cityDB.cidade, uf: cityDB.uf };
                      }
                  }
                  
                  setFormData(prev => ({ ...prev, ...updates }));
              }
          } catch (error) {
              console.error("Erro ao buscar CEP", error);
          } finally {
              setLoadingCep(false);
          }
      }
  };

  const performCitySearch = async (term: string) => {
    try {
      setSearchingCity(true);
      const { data, error } = await supabase
        .from('cidades')
        .select('*')
        .ilike('cidade', `%${term}%`)
        .limit(50);

      if (error) throw error;
      setSearchedCities(data || []);
    } catch (err) {
      console.error('Error searching cities:', err);
    } finally {
      setSearchingCity(false);
    }
  };

  const getStateUf = (ufId: number) => {
      const s = states.find(st => st.id === ufId);
      return s ? s.uf : '';
  };

  const getCityNameForDisplay = (user: User) => {
      if (user.cidade_data) {
          const uf = getStateUf(user.cidade_data.uf);
          return uf ? `${user.cidade_data.cidade}, ${uf}` : user.cidade_data.cidade;
      }
      if (user.cidade) {
          const city = cities.find(c => c.id == user.cidade);
          if (city) {
              const uf = getStateUf(city.uf);
              return uf ? `${city.cidade}, ${uf}` : city.cidade;
          }
          return `ID: ${user.cidade}`;
      }
      return 'Não definida';
  };
  
  const getFormCityDisplay = () => {
      if (!formData.cidade) return 'Selecione a cidade...';
      if (formData.cidade_data) {
          const uf = getStateUf(formData.cidade_data.uf);
          return uf ? `${formData.cidade_data.cidade}, ${uf}` : formData.cidade_data.cidade;
      }
      const city = cities.find(c => c.id == formData.cidade);
      if (city) {
          const uf = getStateUf(city.uf);
          return uf ? `${city.cidade}, ${uf}` : city.cidade;
      }
      return `ID: ${formData.cidade}`;
  };

  const normalizeStr = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  };

  const filteredUsers = users.filter(user => {
      const uName = normalizeStr(user.nome || '');
      const uEmail = normalizeStr(user.email || '');
      const fName = normalizeStr(filterName);

      const matchesName = uName.includes(fName) || uEmail.includes(fName);
      // Use normalizeStr to handle accents (e.g. Orçamentista vs orcamentista)
      const matchesType = filterType === 'all' || normalizeStr(user.tipo || '') === normalizeStr(filterType);
      
      const cityResolved = user.cidade_data ? user.cidade_data.cidade : (cities.find(c => c.id == user.cidade)?.cidade || '');
      const fCity = normalizeStr(filterCity);
      const matchesCity = filterCity === '' || normalizeStr(cityResolved).includes(fCity);
      
      const matchesStatus = filterStatus === 'all' || 
                           (filterStatus === 'active' && user.ativo) || 
                           (filterStatus === 'inactive' && !user.ativo);

      return matchesName && matchesType && matchesCity && matchesStatus;
  });

  const handleEdit = (item: any) => {
    // Normalizar o tipo para garantir que o select exiba a opção correta (Capitalize)
    const normalizedItem = {
        ...item,
        tipo: item.tipo ? formatUserType(item.tipo) : 'Consumidor'
    };
    
    setFormData(normalizedItem);
    setActivitySearchTerm(''); 
    setPassword(''); // Reset password field (usually keep blank on edit)
    setEditingId(item.id);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    if (activeTab === 'services') {
        const isPrimary = serviceSubTab === 'primary';
        setFormData({
            primaria: isPrimary,
            nome: '',
            imagem: '',
            dependencia: null,
            ativa: true
        });
    } else {
        // Novo Usuário: Inicializar campos completos
        setFormData({
            nome: '',
            email: '',
            tipo: 'Consumidor',
            cpf: '',
            whatsapp: '',
            sexo: 'Outro',
            cep: '',
            rua: '',
            numero: '',
            bairro: '',
            complemento: '',
            cidade: null,
            cidade_data: null,
            estado: null,
            ativo: true,
            uuid: '', // Será gerado pelo Auth
            fotoperfil: '',
            atividade: []
        });
        setPassword('');
    }
    setActivitySearchTerm('');
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este item?')) return;
    
    try {
        const table = activeTab === 'services' ? 'geral' : 'users';
        const { error } = await supabase.from(table).delete().eq('id', id);
        
        if (error) throw error;
        
        if (activeTab === 'services') {
            setServices(services.filter(s => s.id !== id));
        } else {
            setUsers(users.filter(u => u.id !== id));
        }
    } catch (error) {
        console.error('Error deleting:', error);
        alert('Erro ao excluir item. Verifique se existem dependências vinculadas.');
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) throw new Error('Selecione uma imagem.');

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `categorias/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('categorias').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('categorias').getPublicUrl(filePath);
      setFormData({ ...formData, imagem: data.publicUrl });
      
    } catch (error: any) {
      alert('Erro ao fazer upload: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (activeTab === 'services' && editingItem()) {
        const originalItem = services.find(s => s.id === editingId);
        if (originalItem?.primaria && !formData.primaria) {
            setSaving(true);
            const { count } = await supabase.from('geral').select('*', { count: 'exact', head: true }).eq('dependencia', editingId);

            if (count && count > 0) {
                setOrphanedChildrenCount(count);
                setAvailableParents(services.filter(s => s.primaria && s.id !== editingId));
                setNewParentId('');
                setSaving(false);
                setIsReassignModalOpen(true);
                return;
            }
            setSaving(false);
        }
    }

    if (activeTab === 'services' && formData.primaria) {
        formData.dependencia = null;
    }

    await executeSave(formData);
  };

  const editingItem = () => services.find(s => s.id === editingId);

  const executeSave = async (dataToSave: any) => {
    setSaving(true);
    try {
        const table = activeTab === 'services' ? 'geral' : 'users';
        const payload = { ...dataToSave };
        
        // --- LOGICA DE CRIAÇÃO DE USUÁRIO (AUTH + PUBLIC) ---
        if (activeTab === 'users') {
            // Limpeza de campos virtuais
            delete payload.rating;
            delete payload.reviewCount;
            delete payload.cidade_data;
            if (!payload.atividade) payload.atividade = [];

            // Se for NOVO usuário, precisamos criar o Auth User primeiro
            if (!editingId) {
                if (!password || password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
                if (!payload.email) throw new Error("Email é obrigatório.");
                if (!payload.cpf) throw new Error("CPF é obrigatório.");
                if (!payload.cidade) throw new Error("Cidade é obrigatória.");

                // 1. Criar Auth User sem deslogar o Gestor (Usando cliente temporário)
                // Isso evita que o supabase.auth.signUp deslogue o usuário atual da sessão do navegador
                const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                    auth: {
                        persistSession: false, // Importante: não salvar sessão no localStorage
                        autoRefreshToken: false,
                        detectSessionInUrl: false
                    }
                });

                const { data: authData, error: authError } = await tempClient.auth.signUp({
                    email: payload.email,
                    password: password
                });

                if (authError) throw authError;
                if (!authData.user) throw new Error("Erro ao criar usuário na autenticação.");

                // 2. Usar o UUID gerado para o insert na tabela pública
                payload.uuid = authData.user.id;
            } 
            else {
                // Se for edição, removemos uuid e email do payload para evitar conflitos se não forem alteráveis
                // (Geralmente email no Auth é separado, mas aqui atualizamos o registro público)
                // Se a senha foi preenchida na edição, teríamos que usar uma Edge Function para atualizar, 
                // mas como estamos no front, ignoramos senha na edição por enquanto.
            }
        }

        const query = editingId 
            ? supabase.from(table).update(payload).eq('id', editingId)
            : supabase.from(table).insert(payload);
            
        const { error } = await query;
        if (error) throw error;

        setIsModalOpen(false);
        fetchData(); 
        alert(editingId ? "Atualizado com sucesso." : "Usuário criado com sucesso!");

    } catch (error: any) {
        console.error('Error saving:', error);
        alert(`Erro ao salvar: ${error.message}`);
    } finally {
        setSaving(false);
    }
  };

  const handleReassignAndSave = async () => {
      if (!newParentId) return alert("Selecione uma nova categoria pai.");
      setSaving(true);
      try {
          const { error: childrenError } = await supabase.from('geral').update({ dependencia: newParentId }).eq('dependencia', editingId);
          if (childrenError) throw childrenError;

          const updatedPayload = { ...formData, dependencia: newParentId };
          await executeSave(updatedPayload);
          setIsReassignModalOpen(false);
      } catch (error: any) {
          console.error("Reassign error:", error);
          alert("Erro ao realocar dependências.");
          setSaving(false);
      }
  };
  
  const handleCitySelect = (city: City) => {
      setFormData({
          ...formData, 
          cidade: city.id,
          estado: city.uf,
          cidade_data: { cidade: city.cidade, uf: city.uf }
      });
      setIsCitySearchOpen(false);
      setCitySearchTerm('');
      setSearchedCities([]);
  };

  const toggleActivity = (activityId: number) => {
      const currentActivities = formData.atividade || [];
      if (currentActivities.includes(activityId)) {
          setFormData({
              ...formData,
              atividade: currentActivities.filter((id: number) => id !== activityId)
          });
      } else {
          setFormData({
              ...formData,
              atividade: [...currentActivities, activityId]
          });
      }
  };

  // --- SERVICES FILTER LOGIC ---
  const displayedServices = services.filter(s => {
      if (serviceSubTab === 'primary' && !s.primaria) return false;
      if (serviceSubTab === 'secondary' && s.primaria) return false;

      const sName = normalizeStr(s.nome);
      const fName = normalizeStr(serviceFilterName);
      if (!sName.includes(fName)) return false;

      if (serviceFilterStatus !== 'all') {
          const isActive = serviceFilterStatus === 'active';
          if (s.ativa !== isActive) return false;
      }

      if (serviceSubTab === 'secondary' && serviceFilterParent !== 'all') {
          const parentId = parseInt(serviceFilterParent);
          if (s.dependencia !== parentId) return false;
      }

      return true;
  });
  
  const filteredActivities = services.filter(s => 
      s.nome.toLowerCase().includes(activitySearchTerm.toLowerCase())
  );

  const primaryCategories = services.filter(s => s.primaria).sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="min-h-screen bg-ios-bg pb-20 md:pb-0 font-sans">
      {/* Vitrified Header */}
      <div className="sticky top-0 z-20 px-5 pt-8 pb-4 vitrified md:rounded-b-[2rem] mb-6 shadow-vitrified">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Configurações</h1>
        <p className="text-gray-500 text-sm">Painel de controle administrativo</p>
      </div>

      <div className="p-5 max-w-7xl mx-auto space-y-6">
        
        {/* Main Tab Switcher */}
        <div className="bg-white/50 backdrop-blur-sm p-1.5 rounded-2xl flex max-w-md mx-auto md:mx-0 shadow-sm border border-white/40">
            <button 
                onClick={() => setActiveTab('services')}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center space-x-2 ${activeTab === 'services' ? 'bg-white shadow-md text-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-white/30'}`}
            >
                <Layers size={18} />
                <span>Serviços</span>
            </button>
            <button 
                onClick={() => setActiveTab('users')}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center space-x-2 ${activeTab === 'users' ? 'bg-white shadow-md text-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-white/30'}`}
            >
                <Users size={18} />
                <span>Usuários</span>
            </button>
        </div>

        {/* --- USERS FILTERS --- */}
        {activeTab === 'users' && (
             <div className="bg-white rounded-[1.5rem] p-5 shadow-vitrified border border-white/50 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Buscar Nome/Email</label>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl py-2 pl-9 pr-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-100 outline-none"
                            placeholder="Buscar..."
                            value={filterName}
                            onChange={(e) => setFilterName(e.target.value)}
                        />
                    </div>
                </div>
                <div className="space-y-1">
                     <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Tipo</label>
                     <select 
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl py-2 px-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-100 outline-none"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                     >
                        <option value="all">Todos</option>
                        <option value="consumidor">Consumidor</option>
                        <option value="profissional">Profissional</option>
                        <option value="gestor">Gestor</option>
                        <option value="planejista">Planejista</option>
                        <option value="orcamentista">Orçamentista</option>
                     </select>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Cidade (Nome)</label>
                    <input 
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl py-2 px-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-100 outline-none"
                        placeholder="Ex: Lafaiete"
                        value={filterCity}
                        onChange={(e) => setFilterCity(e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                     <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Status</label>
                     <select 
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl py-2 px-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-100 outline-none"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                     >
                        <option value="all">Todos</option>
                        <option value="active">Ativos</option>
                        <option value="inactive">Inativos</option>
                     </select>
                </div>
             </div>
        )}

        {/* --- SERVICES FILTERS --- */}
        {activeTab === 'services' && (
             <div className="bg-white rounded-[1.5rem] p-5 shadow-vitrified border border-white/50 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Buscar Serviço</label>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl py-2 pl-9 pr-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-100 outline-none"
                            placeholder="Buscar..."
                            value={serviceFilterName}
                            onChange={(e) => setServiceFilterName(e.target.value)}
                        />
                    </div>
                </div>
                
                <div className="space-y-1">
                     <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Status</label>
                     <select 
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl py-2 px-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-100 outline-none"
                        value={serviceFilterStatus}
                        onChange={(e) => setServiceFilterStatus(e.target.value)}
                     >
                        <option value="all">Todos</option>
                        <option value="active">Ativos</option>
                        <option value="inactive">Inativos</option>
                     </select>
                </div>

                {serviceSubTab === 'secondary' && (
                    <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Categoria Pai</label>
                        <select 
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl py-2 px-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-100 outline-none"
                            value={serviceFilterParent}
                            onChange={(e) => setServiceFilterParent(e.target.value)}
                        >
                            <option value="all">Todas as categorias</option>
                            {primaryCategories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.nome}</option>
                            ))}
                        </select>
                    </div>
                )}
             </div>
        )}

        {/* --- SERVICES SUB-TABS --- */}
        {activeTab === 'services' && (
            <div className="flex space-x-3 overflow-x-auto no-scrollbar py-1">
                <button
                    onClick={() => setServiceSubTab('primary')}
                    className={`px-5 py-2.5 rounded-full text-xs font-bold border transition-all flex items-center whitespace-nowrap shadow-sm ${
                        serviceSubTab === 'primary' 
                        ? 'bg-gray-900 text-white border-gray-900 scale-105' 
                        : 'bg-white text-gray-600 border-white hover:bg-gray-50'
                    }`}
                >
                    <LayoutGrid size={14} className="mr-2" />
                    Categorias Primárias
                </button>
                <button
                    onClick={() => setServiceSubTab('secondary')}
                    className={`px-5 py-2.5 rounded-full text-xs font-bold border transition-all flex items-center whitespace-nowrap shadow-sm ${
                        serviceSubTab === 'secondary' 
                        ? 'bg-gray-900 text-white border-gray-900 scale-105' 
                        : 'bg-white text-gray-600 border-white hover:bg-gray-50'
                    }`}
                >
                    <Box size={14} className="mr-2" />
                    Sub-serviços
                </button>
            </div>
        )}

        {/* --- CONTENT TABLE --- */}
        <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] shadow-vitrified border border-white overflow-hidden relative min-h-[400px]">
            {/* Table Header */}
            <div className="p-6 flex justify-between items-center bg-white/50 border-b border-gray-100/50">
                 <div>
                    <h2 className="text-xl font-bold text-gray-900">
                        {activeTab === 'services' 
                            ? (serviceSubTab === 'primary' ? 'Categorias' : 'Serviços')
                            : 'Gerenciar Usuários'}
                    </h2>
                    <p className="text-xs text-gray-400 mt-1 font-medium">
                        Total: {activeTab === 'services' ? displayedServices.length : filteredUsers.length} registros encontrados
                    </p>
                 </div>
                 <button 
                    onClick={handleAddNew}
                    className="bg-ios-blue text-white px-5 py-2.5 rounded-2xl text-sm font-bold shadow-lg shadow-blue-200 hover:scale-105 active:scale-95 transition-all flex items-center"
                >
                    <Plus size={18} className="mr-1.5" />
                    Novo
                </button>
            </div>

            {loading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
                    <Loader2 className="animate-spin text-ios-blue" size={40} />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100/50">
                                <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">ID</th>
                                {activeTab === 'services' ? (
                                    <>
                                        <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nome / Imagem</th>
                                        <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Dependência</th>
                                        <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Perfil</th>
                                        <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tipo</th>
                                        <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Localização</th>
                                        <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                                    </>
                                )}
                                <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50/50">
                            {activeTab === 'services' ? (
                                displayedServices.length > 0 ? displayedServices.map(service => (
                                    <tr key={service.id} className="hover:bg-white/60 transition-colors group">
                                        <td className="p-5 text-sm text-gray-500 font-mono">#{service.id}</td>
                                        <td className="p-5">
                                            <div className="flex items-center">
                                                <div className="w-10 h-10 rounded-xl bg-gray-100 mr-4 overflow-hidden shadow-sm flex-shrink-0">
                                                    {service.imagem ? (
                                                        <img src={service.imagem} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={16}/></div>
                                                    )}
                                                </div>
                                                <span className="font-bold text-gray-900 text-sm">{service.nome}</span>
                                            </div>
                                        </td>
                                        <td className="p-5 text-sm text-gray-500">
                                            {service.primaria ? (
                                                <span className="bg-black/5 text-gray-700 px-2 py-1 rounded-lg text-xs font-bold border border-black/5">Principal</span>
                                            ) : (
                                                <div className="flex items-center text-gray-500 text-xs font-medium bg-gray-50 px-2 py-1 rounded-lg w-fit border border-gray-200">
                                                    <FolderTree size={12} className="mr-1.5" />
                                                    {services.find(s => s.id === service.dependencia)?.nome || 'Sem Pai'}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-5">
                                            {service.ativa ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-50 text-green-700 text-xs font-bold border border-green-100">
                                                    Ativo
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold border border-red-100">
                                                    Inativo
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-5 text-right">
                                            <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEdit(service)} className="p-2 bg-white shadow-sm border border-gray-100 rounded-xl text-gray-600 hover:text-blue-600 hover:border-blue-200 transition-all">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(service.id)} className="p-2 bg-white shadow-sm border border-gray-100 rounded-xl text-gray-600 hover:text-red-500 hover:border-red-200 transition-all">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={5} className="p-10 text-center text-gray-400 font-medium">Nenhum serviço encontrado.</td></tr>
                                )
                            ) : (
                                filteredUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-white/60 transition-colors group">
                                        <td className="p-5 text-sm text-gray-500 font-mono">#{user.id}</td>
                                        <td className="p-5">
                                            <div className="flex items-center">
                                                <div className="w-10 h-10 rounded-full bg-gray-200 mr-3 overflow-hidden border-2 border-white shadow-sm flex-shrink-0">
                                                    {user.fotoperfil ? (
                                                        <img src={user.fotoperfil} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Users size={20} className="w-full h-full p-2 text-gray-400" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900 text-sm">{user.nome}</div>
                                                    <div className="text-xs text-gray-400 font-medium">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                                user.tipo.toLowerCase() === 'profissional' 
                                                ? 'bg-purple-50 text-purple-700 border-purple-100' 
                                                : user.tipo.toLowerCase() === 'gestor'
                                                ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                : 'bg-gray-50 text-gray-600 border-gray-100'
                                            }`}>
                                                {formatUserType(user.tipo)}
                                            </span>
                                        </td>
                                        <td className="p-5 text-sm text-gray-600 font-medium">
                                            {getCityNameForDisplay(user)}
                                        </td>
                                        <td className="p-5">
                                            {user.ativo ? (
                                                 <span className="w-2.5 h-2.5 rounded-full bg-green-500 block shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                                            ) : (
                                                 <span className="w-2.5 h-2.5 rounded-full bg-red-400 block"></span>
                                            )}
                                        </td>
                                        <td className="p-5 text-right">
                                            <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEdit(user)} className="p-2 bg-white shadow-sm border border-gray-100 rounded-xl text-gray-600 hover:text-blue-600 hover:border-blue-200 transition-all">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(user.id)} className="p-2 bg-white shadow-sm border border-gray-100 rounded-xl text-gray-600 hover:text-red-500 hover:border-red-200 transition-all">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      </div>

      {/* --- EDIT MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <h3 className="font-bold text-gray-900 text-xl">
                        {editingId ? 'Editar Registro' : 'Novo Registro'}
                    </h3>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5">
                    {/* --- SERVICE FORM --- */}
                    {activeTab === 'services' ? (
                        <>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Nome do Serviço</label>
                                <input 
                                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-ios-blue/30 outline-none transition-all" 
                                    value={formData.nome || ''} 
                                    onChange={e => setFormData({...formData, nome: e.target.value})}
                                    placeholder="Ex: Limpeza Pesada"
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center">
                                    <ImageIcon size={12} className="mr-1"/> Imagem
                                </label>
                                <div className="w-full h-40 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center relative overflow-hidden group hover:border-ios-blue/50 transition-colors">
                                    {formData.imagem ? (
                                        <img src={formData.imagem} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-center p-4">
                                            <CloudUpload size={24} className="mx-auto text-gray-300 mb-2"/>
                                            <p className="text-gray-400 text-xs">Clique para fazer upload</p>
                                        </div>
                                    )}
                                    <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading} />
                                    {uploading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><Loader2 className="animate-spin text-ios-blue" /></div>}
                                </div>
                            </div>
                            
                            <div className="flex gap-4">
                                <div 
                                    className={`flex-1 p-4 rounded-2xl border cursor-pointer transition-all ${formData.primaria ? 'bg-black text-white border-black' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                                    onClick={() => setFormData({...formData, primaria: !formData.primaria})}
                                >
                                    <span className="text-xs font-bold uppercase block mb-1">Categoria Pai?</span>
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-lg">{formData.primaria ? 'Sim' : 'Não'}</span>
                                        <div className={`w-5 h-5 rounded-full border-2 ${formData.primaria ? 'bg-white border-transparent' : 'border-gray-300'}`}></div>
                                    </div>
                                </div>
                                <div 
                                    className={`flex-1 p-4 rounded-2xl border cursor-pointer transition-all ${formData.ativa ? 'bg-green-50 border-green-200 text-green-800' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                                    onClick={() => setFormData({...formData, ativa: !formData.ativa})}
                                >
                                    <span className="text-xs font-bold uppercase block mb-1">Status</span>
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-lg">{formData.ativa ? 'Ativo' : 'Inativo'}</span>
                                        <CheckCircle size={20} className={formData.ativa ? 'text-green-600' : 'text-gray-300'} />
                                    </div>
                                </div>
                            </div>

                            {!formData.primaria && (
                                <div className="space-y-2 animate-in slide-in-from-top-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Vincular a Categoria</label>
                                    <select 
                                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-medium text-gray-900 outline-none appearance-none" 
                                        value={formData.dependencia || ''} 
                                        onChange={e => setFormData({...formData, dependencia: e.target.value ? parseInt(e.target.value) : null})}
                                    >
                                        <option value="">Selecione...</option>
                                        {services.filter(s => s.primaria && s.id !== formData.id).map(s => (
                                            <option key={s.id} value={s.id}>{s.nome}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </>
                    ) : (
                        // --- USERS FORM ---
                        <>
                            {/* Seção 1: Credenciais e Tipo */}
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
                                <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center"><Lock size={12} className="mr-1"/> Acesso e Permissões</h4>
                                
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">E-mail (Login)</label>
                                    <input 
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30" 
                                        value={formData.email || ''} 
                                        onChange={e => setFormData({...formData, email: e.target.value})}
                                        disabled={!!editingId} // Disable email change on edit to simplify
                                    />
                                </div>

                                {!editingId && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Senha (Login)</label>
                                        <input 
                                            type="password"
                                            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30" 
                                            value={password} 
                                            onChange={e => setPassword(e.target.value)}
                                            placeholder="Mínimo 6 caracteres"
                                        />
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Tipo</label>
                                        <select 
                                            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-medium text-gray-900 outline-none appearance-none"
                                            value={formData.tipo || 'Consumidor'}
                                            onChange={e => setFormData({...formData, tipo: e.target.value})}
                                        >
                                            <option value="Consumidor">Consumidor</option>
                                            <option value="Profissional">Profissional</option>
                                            <option value="Gestor">Gestor</option>
                                            <option value="Planejista">Planejista</option>
                                            <option value="Orçamentista">Orçamentista</option>
                                        </select>
                                    </div>
                                    <div 
                                        className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-center items-center ${formData.ativo ? 'bg-green-100 border-green-200 text-green-800' : 'bg-white border-gray-200'}`}
                                        onClick={() => setFormData({...formData, ativo: !formData.ativo})}
                                    >
                                        <span className="text-[10px] font-bold uppercase mb-1">Status</span>
                                        <span className="font-bold text-sm flex items-center">
                                            {formData.ativo ? 'Ativo' : 'Inativo'} 
                                            {formData.ativo && <Check size={12} className="ml-1"/>}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Seção 2: Dados Pessoais */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center mt-2 ml-1"><UserIcon size={12} className="mr-1"/> Dados Pessoais</h4>
                                
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 ml-1">Nome Completo</label>
                                    <input 
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30" 
                                        value={formData.nome || ''} 
                                        onChange={e => setFormData({...formData, nome: e.target.value})}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 ml-1">CPF</label>
                                        <div className="relative">
                                            <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                            <input 
                                                className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 pl-8 pr-3 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30" 
                                                value={formData.cpf || ''} 
                                                onChange={e => setFormData({...formData, cpf: formatCpf(e.target.value)})}
                                                maxLength={14}
                                                placeholder="000.000.000-00"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 ml-1">WhatsApp</label>
                                        <div className="relative">
                                            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                            <input 
                                                className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 pl-8 pr-3 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30" 
                                                value={formData.whatsapp || ''} 
                                                onChange={e => setFormData({...formData, whatsapp: formatPhone(e.target.value)})}
                                                maxLength={15}
                                                placeholder="(00) 00000-0000"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Seção 3: Endereço */}
                            <div className="space-y-3 pt-2 border-t border-gray-100">
                                <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center mt-2 ml-1"><MapPin size={12} className="mr-1"/> Endereço</h4>
                                
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1 col-span-1">
                                        <label className="text-[10px] font-bold text-gray-400 ml-1">CEP</label>
                                        <div className="relative">
                                            {loadingCep ? <Loader2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-ios-blue"/> : <Navigation size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>}
                                            <input 
                                                className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 pl-8 pr-2 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30" 
                                                value={formData.cep || ''} 
                                                onChange={e => setFormData({...formData, cep: formatCep(e.target.value)})}
                                                onBlur={fetchCepData}
                                                maxLength={9}
                                                placeholder="00000-000"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1 col-span-2">
                                        <label className="text-[10px] font-bold text-gray-400 ml-1">Cidade</label>
                                        <div 
                                            onClick={() => {
                                                setIsCitySearchOpen(true);
                                                setCitySearchTerm('');
                                                setSearchedCities([]);
                                            }}
                                            className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-3 text-sm font-medium cursor-pointer flex justify-between items-center hover:bg-gray-100 transition-colors"
                                        >
                                            <span className={`truncate ${formData.cidade ? 'text-gray-900' : 'text-gray-400'}`}>
                                                {getFormCityDisplay()}
                                            </span>
                                            <Search size={14} className="text-gray-400 flex-shrink-0"/>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 ml-1">Rua</label>
                                    <div className="relative">
                                        <Home size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                        <input 
                                            className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 pl-8 pr-3 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30" 
                                            value={formData.rua || ''} 
                                            onChange={e => setFormData({...formData, rua: e.target.value})}
                                            placeholder="Nome da rua"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 ml-1">Número</label>
                                        <input 
                                            className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30" 
                                            value={formData.numero || ''} 
                                            onChange={e => setFormData({...formData, numero: e.target.value})}
                                            placeholder="123"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 ml-1">Bairro</label>
                                        <input 
                                            className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30" 
                                            value={formData.bairro || ''} 
                                            onChange={e => setFormData({...formData, bairro: e.target.value})}
                                            placeholder="Centro"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 ml-1">Complemento</label>
                                    <input 
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30" 
                                        value={formData.complemento || ''} 
                                        onChange={e => setFormData({...formData, complemento: e.target.value})}
                                        placeholder="Apto, Bloco..."
                                    />
                                </div>
                            </div>
                            
                            {/* Seção 4: Atividades (Apenas Profissional) */}
                            {(formData.tipo === 'Profissional' || formData.tipo === 'profissional') && (
                                <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 space-y-3 mt-4">
                                    <label className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider flex items-center">
                                        <Briefcase size={12} className="mr-1"/> Atividades (Serviços Prestados)
                                    </label>
                                    
                                    <div className="bg-white rounded-xl border border-yellow-200 overflow-hidden">
                                        <div className="p-2 border-b border-gray-100 bg-gray-50">
                                            <div className="relative">
                                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input 
                                                    className="w-full bg-white border border-gray-200 rounded-lg py-2 pl-9 pr-3 text-xs font-medium text-gray-900 focus:ring-2 focus:ring-yellow-200 outline-none"
                                                    placeholder="Filtrar serviços..."
                                                    value={activitySearchTerm}
                                                    onChange={(e) => setActivitySearchTerm(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div className="max-h-48 overflow-y-auto p-1 space-y-1 no-scrollbar">
                                            {filteredActivities.length > 0 ? filteredActivities.map(activity => {
                                                const isSelected = (formData.atividade || []).includes(activity.id);
                                                return (
                                                    <div 
                                                        key={activity.id}
                                                        onClick={() => toggleActivity(activity.id)}
                                                        className={`p-2 rounded-lg flex items-center cursor-pointer transition-colors ${isSelected ? 'bg-yellow-100 text-yellow-900' : 'hover:bg-gray-50 text-gray-700'}`}
                                                    >
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center mr-3 transition-colors ${isSelected ? 'bg-yellow-500 border-yellow-500' : 'border-gray-300 bg-white'}`}>
                                                            {isSelected && <Check size={10} className="text-white" />}
                                                        </div>
                                                        <div className="w-6 h-6 rounded-md bg-gray-100 overflow-hidden mr-2 flex-shrink-0">
                                                             {activity.imagem ? <img src={activity.imagem} className="w-full h-full object-cover" /> : <Box size={12} className="m-auto text-gray-400"/>}
                                                        </div>
                                                        <span className="text-xs font-medium truncate">{activity.nome}</span>
                                                    </div>
                                                );
                                            }) : (
                                                <p className="text-center text-xs text-gray-400 py-4">Nenhum serviço encontrado.</p>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-yellow-600/70 text-right">
                                        {(formData.atividade || []).length} serviços selecionados
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 mt-auto">
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full bg-black text-white py-4 rounded-2xl font-bold shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex justify-center items-center disabled:opacity-70 disabled:scale-100"
                    >
                        {saving ? <Loader2 className="animate-spin" size={20} /> : 'Salvar Alterações'}
                    </button>
                </div>
            </div>
        </div>
      )}
      
      {/* CITY SEARCH MODAL (Nested) */}
      {isCitySearchOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-200">
             <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <h3 className="font-bold text-gray-900 text-lg ml-2">Selecionar Cidade</h3>
                    <button 
                        onClick={() => setIsCitySearchOpen(false)}
                        className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 bg-gray-50">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            autoFocus
                            placeholder="Busque pelo nome..."
                            value={citySearchTerm}
                            onChange={(e) => setCitySearchTerm(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30 transition-all shadow-sm"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
                    {searchingCity ? (
                        <div className="py-8 flex justify-center">
                            <Loader2 className="animate-spin text-ios-blue" size={24} />
                        </div>
                    ) : searchedCities.length > 0 ? (
                        <div className="space-y-1">
                            {searchedCities.map(city => (
                                <button
                                    key={city.id}
                                    onClick={() => handleCitySelect(city)}
                                    className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 active:bg-blue-50 transition-colors flex items-center justify-between group border-b border-gray-50 last:border-0"
                                >
                                    <div>
                                        <span className="font-semibold text-gray-900 block group-hover:text-ios-blue transition-colors">
                                            {city.cidade}, {getStateUf(city.uf)}
                                        </span>
                                    </div>
                                    {formData.cidade === city.id && (
                                        <div className="w-2 h-2 bg-ios-blue rounded-full"></div>
                                    )}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="py-10 text-center text-gray-400 px-6">
                            {citySearchTerm.length < 2 ? (
                                <p>Digite pelo menos 2 letras para buscar.</p>
                            ) : (
                                <div>
                                    <p className="font-medium">Nenhuma cidade encontrada</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
             </div>
        </div>
      )}

      {/* REASSIGNMENT ALERT MODAL */}
      {isReassignModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in zoom-in duration-300">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 relative overflow-hidden text-center">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5 text-red-500 shadow-sm">
                    <AlertTriangle size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Atenção Necessária</h2>
                <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                    Você está rebaixando esta categoria. Ela possui <strong>{orphanedChildrenCount} sub-serviços</strong> que ficarão órfãos. Selecione um novo pai para eles.
                </p>

                <div className="space-y-4 mb-8 text-left">
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Nova Categoria Pai</label>
                        <select 
                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold text-gray-900 outline-none" 
                            value={newParentId} 
                            onChange={e => setNewParentId(e.target.value ? parseInt(e.target.value) : '')}
                        >
                            <option value="">Selecione...</option>
                            {availableParents.map(p => (
                                <option key={p.id} value={p.id}>{p.nome}</option>
                            ))}
                        </select>
                     </div>
                </div>

                <div className="flex space-x-3">
                    <button 
                        onClick={() => setIsReassignModalOpen(false)}
                        className="flex-1 bg-white border border-gray-200 text-gray-700 py-3.5 rounded-2xl font-bold hover:bg-gray-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleReassignAndSave}
                        disabled={saving}
                        className="flex-1 bg-red-500 text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-red-200 hover:bg-red-600 transition-colors"
                    >
                        {saving ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default Settings;