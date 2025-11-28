
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { User, City, Estado } from '../types';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon, Phone, LogOut, Camera, Save, Loader2, AlertCircle, Search, MapPin, X, Edit2 } from 'lucide-react';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<User | null>(null);
  
  // Data Lists
  const [searchedCities, setSearchedCities] = useState<City[]>([]); // Stores search results
  const [states, setStates] = useState<Estado[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchingCity, setSearchingCity] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Form States
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  
  // State & City States
  const [selectedStateId, setSelectedStateId] = useState<number | ''>('');
  const [cityName, setCityName] = useState(''); // Display name for the form
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);

  // Modal States
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  
  useEffect(() => {
    fetchData();
  }, []);

  // Debounced Search Effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (modalSearchTerm.length >= 2) {
        performCitySearch(modalSearchTerm);
      } else {
        setSearchedCities([]);
      }
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(delayDebounceFn);
  }, [modalSearchTerm]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch User
      const { data: { user: authUser } } = await supabase.auth.getUser();
      let uuidToFetch = authUser?.id;

      // Fallback for demo
      if (!uuidToFetch) {
         const { data: demoUsers } = await supabase.from('users').select('*').eq('ativo', true).limit(1);
         if (demoUsers && demoUsers.length > 0) uuidToFetch = demoUsers[0].uuid;
      }

      // 2. Load States (Small list, okay to fetch all)
      const { data: statesData } = await supabase.from('estados').select('*').order('uf', { ascending: true });
      setStates(statesData || []);

      // 3. Set User Data
      if (uuidToFetch) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('uuid', uuidToFetch)
          .single();

        if (userError) throw userError;

        if (userData) {
          setProfile(userData);
          setNome(userData.nome || '');
          setWhatsapp((userData.whatsapp === 'NULL' || !userData.whatsapp) ? '' : userData.whatsapp);
          setSelectedStateId(userData.estado || '');
          setSelectedCityId(userData.cidade);
          
          // Fetch specifically the user's current city name to display
          if (userData.cidade) {
            const { data: cityData } = await supabase
                .from('cidades')
                .select('*')
                .eq('id', userData.cidade)
                .single();
            
            if (cityData) {
                setCityName(cityData.cidade);
            }
          }
        }
      }

    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      setMessage({ type: 'error', text: 'Não foi possível carregar os dados.' });
    } finally {
      setLoading(false);
    }
  };

  const performCitySearch = async (term: string) => {
    try {
      setSearchingCity(true);
      // Perform server-side search using ILIKE (case insensitive)
      const { data, error } = await supabase
        .from('cidades')
        .select('*')
        .ilike('cidade', `%${term}%`)
        .limit(50); // Limit results for performance

      if (error) throw error;
      setSearchedCities(data || []);
    } catch (err) {
      console.error('Error searching cities:', err);
    } finally {
      setSearchingCity(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setMessage(null);

    try {
      if (!selectedCityId) {
        throw new Error('Cidade inválida. Por favor, selecione uma cidade.');
      }

      const updates = {
        nome: nome,
        whatsapp: whatsapp,
        estado: selectedStateId,
        cidade: selectedCityId
      };

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', profile.id);

      if (error) throw error;
      
      // Update local state
      setProfile({ ...profile, ...updates } as User);
      setMessage({ type: 'success', text: 'Dados atualizados com sucesso!' });
      
      setTimeout(() => setMessage(null), 3000);

    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      setMessage({ type: 'error', text: error.message || 'Erro ao atualizar. Tente novamente.' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // App.tsx handles session change and redirects
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleCitySelect = (city: City) => {
    setCityName(city.cidade);
    setSelectedStateId(city.uf);
    setSelectedCityId(city.id);
    setIsCityModalOpen(false);
    setModalSearchTerm('');
    setSearchedCities([]);
  };

  const openCityModal = () => {
    setModalSearchTerm('');
    setSearchedCities([]); // Start empty
    setIsCityModalOpen(true);
  };

  const getStateUf = (id: number) => {
    const state = states.find(s => s.id === id);
    return state ? state.uf : '';
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-10">
        <Loader2 className="animate-spin text-ios-blue" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ios-bg pb-20">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md px-5 pt-12 pb-4 sticky top-0 z-20 border-b border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Meu Perfil</h1>
      </div>

      <div className="p-5 space-y-6">
        
        {/* Avatar Section */}
        <div className="flex flex-col items-center justify-center pt-4">
          <div className="relative group cursor-pointer">
            <div className="w-28 h-28 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
              {profile?.fotoperfil ? (
                <img src={profile.fotoperfil} alt={nome} className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={48} className="text-gray-400" />
              )}
            </div>
            <button className="absolute bottom-0 right-0 bg-ios-blue text-white p-2 rounded-full border-4 border-ios-bg shadow-sm active:scale-95 transition-transform">
              <Camera size={16} />
            </button>
          </div>
          <p className="mt-3 text-sm text-gray-500 font-medium">{profile?.email}</p>
          <div className="mt-1 flex items-center">
             <span className="text-xs px-2 py-0.5 rounded-md bg-gray-200 text-gray-600 font-bold uppercase">ID: {profile?.id} | v1.7</span>
          </div>
        </div>

        {/* Form Section */}
        <div className="bg-white rounded-3xl p-6 shadow-glass border border-white space-y-5">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Dados Pessoais</h2>
          
          {/* Name Field */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Nome Completo</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-ios-blue/50 focus:border-ios-blue transition-all"
                placeholder="Seu nome"
              />
            </div>
          </div>

          {/* WhatsApp Field */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">WhatsApp / Telefone</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-ios-blue/50 focus:border-ios-blue transition-all"
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          {/* City Field (Read-only + Edit Button) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Cidade</label>
            <div className="flex space-x-2">
                <div className="relative flex-1 opacity-70">
                    <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        value={cityName || 'Não definida'}
                        readOnly
                        className="w-full bg-gray-100 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-gray-900 text-sm focus:outline-none cursor-not-allowed select-none"
                    />
                </div>
                <button 
                    onClick={openCityModal}
                    className="bg-white border border-ios-blue text-ios-blue p-3 rounded-xl hover:bg-blue-50 transition-colors"
                    title="Alterar Cidade"
                >
                    <Edit2 size={20} />
                </button>
            </div>
          </div>

          {/* Feedback Message */}
          {message && (
            <div className={`p-3 rounded-xl flex items-center space-x-2 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
              message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {message.type === 'error' && <AlertCircle size={16} />}
              <span>{message.text}</span>
            </div>
          )}

          {/* Save Button */}
          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-ios-blue hover:bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-200 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-70"
          >
            {saving ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <Save size={18} />
                <span>Salvar Alterações</span>
              </>
            )}
          </button>
        </div>

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          className="w-full bg-white border border-red-100 text-red-500 font-bold py-3.5 rounded-xl hover:bg-red-50 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 shadow-sm"
        >
          <LogOut size={18} />
          <span>Sair do App</span>
        </button>
      </div>

      {/* CITY SELECTION MODAL */}
      {isCityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <h3 className="font-bold text-gray-900 text-lg ml-2">Selecionar Cidade</h3>
                <button 
                    onClick={() => setIsCityModalOpen(false)}
                    className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Search Input */}
            <div className="p-4 bg-gray-50">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        autoFocus
                        placeholder="Busque pelo nome da cidade..."
                        value={modalSearchTerm}
                        onChange={(e) => setModalSearchTerm(e.target.value)}
                        className="w-full bg-white border border-ios-blue/30 rounded-xl py-3 pl-11 pr-4 text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30 transition-all shadow-sm"
                    />
                </div>
            </div>

            {/* List */}
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
                                        {city.cidade}
                                    </span>
                                    <span className="text-xs text-gray-400 font-medium">
                                        {getStateUf(city.uf)}
                                    </span>
                                </div>
                                {selectedCityId === city.id && (
                                    <div className="w-2 h-2 bg-ios-blue rounded-full"></div>
                                )}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="py-10 text-center text-gray-400 px-6">
                        {modalSearchTerm.length < 2 ? (
                            <p>Digite pelo menos 2 letras para buscar.</p>
                        ) : (
                            <div>
                                <p className="font-medium">Nenhuma cidade encontrada</p>
                                <p className="text-xs mt-1">Verifique a ortografia ou tente outro termo.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Profile;
