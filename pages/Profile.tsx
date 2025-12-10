import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { User, City, Estado } from '../types';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon, Phone, LogOut, Camera, Save, Loader2, AlertCircle, Search, MapPin, X, Edit2, FileText, Home, Navigation, Users, Bell } from 'lucide-react';

interface NotificationItem {
  id: number;
  title: string;
  description: string;
  date: string;
  type: 'agenda' | 'planning';
  read: boolean;
}

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<User | null>(null);
  
  // Data Lists
  const [searchedCities, setSearchedCities] = useState<City[]>([]);
  const [states, setStates] = useState<Estado[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchingCity, setSearchingCity] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // --- Form States ---
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cpf, setCpf] = useState('');
  const [sexo, setSexo] = useState('');
  
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [complemento, setComplemento] = useState('');
  
  const [selectedStateId, setSelectedStateId] = useState<number | ''>('');
  const [cityName, setCityName] = useState(''); 
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);

  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  
  // Notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [userType, setUserType] = useState('');

  useEffect(() => {
    fetchData();

    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (modalSearchTerm.length >= 2) {
        performCitySearch(modalSearchTerm);
      } else {
        setSearchedCities([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [modalSearchTerm]);

  useEffect(() => {
    if (cep.replace(/\D/g, '').length === 8) {
        fetchCepData(cep);
    }
  }, [cep]);

  const fetchNotifications = async (role: string, uuid: string) => {
      const normalizedRole = role.toLowerCase();
      let notifs: NotificationItem[] = [];

      try {
          if (normalizedRole === 'planejista' || normalizedRole === 'orcamentista') {
              const { data } = await supabase
                  .from('planejamento')
                  .select(`id, created_at, descricao, chaves (chaveunica, geral (nome))`)
                  .eq('ativo', true)
                  .order('created_at', { ascending: false })
                  .limit(10);
              
              if (data) {
                  notifs = data.map((item: any) => ({
                      id: item.id,
                      title: 'Planejamento Ativo',
                      description: `Chave: ${item.chaves?.chaveunica} - ${item.chaves?.geral?.nome}`,
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
      const type = userType.toLowerCase();
      if (type === 'planejista' || type === 'orcamentista') navigate('/chamados');
      else if (type === 'consumidor') navigate('/orders');
      else navigate('/calendar');
  };

  const fetchCepData = async (cepValue: string) => {
      try {
          const cleanCep = cepValue.replace(/\D/g, '');
          const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
          const data = await response.json();
          
          if (!data.erro) {
              setRua(data.logradouro);
              setBairro(data.bairro);
              if(data.localidade) {
                  const { data: cityDB } = await supabase
                    .from('cidades')
                    .select('*')
                    .ilike('cidade', data.localidade)
                    .single();
                  
                  if(cityDB) {
                      setCityName(cityDB.cidade);
                      setSelectedCityId(cityDB.id);
                      setSelectedStateId(cityDB.uf);
                  }
              }
          }
      } catch (error) {
          console.error("Erro ao buscar CEP", error);
      }
  };

  const cleanValue = (val: string | undefined | null) => {
      if (!val) return '';
      const v = val.trim().toLowerCase();
      if (v === 'insere' || v === '000.000.000-00' || v === '00000-000' || v === '(00) 00000-0000') {
          return '';
      }
      return val;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: { user: authUser } } = await supabase.auth.getUser();
      let uuidToFetch = authUser?.id;

      if (!uuidToFetch) {
         const { data: demoUsers } = await supabase.from('users').select('*').eq('ativo', true).limit(1);
         if (demoUsers && demoUsers.length > 0) uuidToFetch = demoUsers[0].uuid;
      }

      const { data: statesData } = await supabase.from('estados').select('*').order('uf', { ascending: true });
      setStates(statesData || []);

      if (uuidToFetch) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('uuid', uuidToFetch)
          .single();

        if (userError) throw userError;

        if (userData) {
          setProfile(userData);
          setNome(cleanValue(userData.nome));
          setWhatsapp(formatPhone(cleanValue(userData.whatsapp)));
          setCpf(formatCpf(cleanValue(userData.cpf)));
          setSexo(userData.sexo || '');
          
          setCep(formatCep(cleanValue(userData.cep)));
          setRua(cleanValue(userData.rua));
          setNumero(cleanValue(userData.numero));
          setBairro(cleanValue(userData.bairro));
          setComplemento(cleanValue(userData.complemento));

          setSelectedStateId(userData.estado || '');
          setSelectedCityId(userData.cidade);
          setUserType(userData.tipo || '');
          
          if (userData.cidade) {
            const { data: cityData } = await supabase
                .from('cidades')
                .select('*')
                .eq('id', userData.cidade)
                .single();
            if (cityData) setCityName(cityData.cidade);
          }
          
          fetchNotifications(userData.tipo || '', uuidToFetch);
        }
      }

    } catch (error: any) {
      console.error('Erro ao carregar perfil:', error.message || error);
      setMessage({ type: 'error', text: 'Não foi possível carregar os dados. ' + (error.message || '') });
    } finally {
      setLoading(false);
    }
  };

  const performCitySearch = async (term: string) => {
    try {
      setSearchingCity(true);
      const { data, error } = await supabase
        .from('cidades')
        .select('*')
        .ilike('cidade', `%${term}%`)
        .limit(20);

      if (error) throw error;
      setSearchedCities(data || []);
    } catch (err) {
      console.error('Error searching cities:', err);
    } finally {
      setSearchingCity(false);
    }
  };

  const validateCpf = (cpfStr: string) => {
    const strCPF = cpfStr.replace(/[^\d]+/g, '');
    if (strCPF.length !== 11 || !!strCPF.match(/(\d)\1{10}/)) return false;
    let sum = 0;
    let rest;
    for (let i = 1; i <= 9; i++) sum = sum + parseInt(strCPF.substring(i - 1, i)) * (11 - i);
    rest = (sum * 10) % 11;
    if ((rest === 10) || (rest === 11)) rest = 0;
    if (rest !== parseInt(strCPF.substring(9, 10))) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++) sum = sum + parseInt(strCPF.substring(i - 1, i)) * (12 - i);
    rest = (sum * 10) % 11;
    if ((rest === 10) || (rest === 11)) rest = 0;
    if (rest !== parseInt(strCPF.substring(10, 11))) return false;
    return true;
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

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setMessage(null);

    try {
      if (!selectedCityId) throw new Error('Selecione uma cidade válida.');
      
      const cleanCpf = cpf.replace(/\D/g, '');
      const cleanPhone = whatsapp.replace(/\D/g, '');
      const cleanCep = cep.replace(/\D/g, '');

      if (cleanCpf && !validateCpf(cleanCpf)) throw new Error('CPF inválido.');
      if (cleanCpf) {
          const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('cpf', cleanCpf)
            .neq('id', profile.id)
            .maybeSingle();
          
          if (existingUser) throw new Error('Este CPF já está sendo utilizado por outro usuário.');
      }

      const updates = {
        nome,
        whatsapp: cleanPhone,
        cpf: cleanCpf,
        sexo: sexo || 'Outro',
        cep: cleanCep,
        rua,
        numero,
        bairro,
        complemento,
        estado: selectedStateId,
        cidade: selectedCityId
      };

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', profile.id);

      if (error) throw error;
      
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
      await supabase.auth.signOut();
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
      <div className="bg-white/80 backdrop-blur-md px-5 pt-12 pb-4 sticky top-0 z-20 border-b border-gray-200">
        <div className="flex justify-between items-center">
             <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Meu Perfil</h1>
             
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
      </div>

      <div className="p-5 space-y-6 max-w-2xl mx-auto">
        
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
        </div>

        {/* --- DADOS PESSOAIS --- */}
        <div className="bg-white rounded-3xl p-6 shadow-glass border border-white space-y-5">
          <h2 className="text-lg font-bold text-gray-900 mb-1 border-b border-gray-100 pb-2">Dados Pessoais</h2>
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Nome Completo</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-ios-blue/50"
                placeholder="Ex: João da Silva"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">CPF</label>
                <div className="relative">
                <FileText className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" 
                    value={cpf}
                    onChange={(e) => setCpf(formatCpf(e.target.value))}
                    maxLength={14}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-ios-blue/50"
                    placeholder="000.000.000-00"
                />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">WhatsApp / Telefone</label>
                <div className="relative">
                <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" 
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
                    maxLength={15}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-ios-blue/50"
                    placeholder="(00) 00000-0000"
                />
                </div>
              </div>

               <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Sexo</label>
                <div className="relative">
                <Users className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <select 
                    value={sexo}
                    onChange={(e) => setSexo(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-ios-blue/50 appearance-none"
                >
                    <option value="">Selecione...</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Outro">Outro</option>
                </select>
                </div>
              </div>
          </div>
        </div>

        {/* --- ENDEREÇO --- */}
        <div className="bg-white rounded-3xl p-6 shadow-glass border border-white space-y-5">
            <h2 className="text-lg font-bold text-gray-900 mb-1 border-b border-gray-100 pb-2">Endereço</h2>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">CEP</label>
                    <div className="relative">
                        <Navigation className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            value={cep}
                            onChange={(e) => setCep(formatCep(e.target.value))}
                            maxLength={9}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-ios-blue/50"
                            placeholder="00000-000"
                        />
                    </div>
                </div>
                
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Cidade</label>
                    <div className="relative cursor-pointer" onClick={() => setIsCityModalOpen(true)}>
                        <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            value={cityName}
                            readOnly
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-10 text-gray-900 text-sm cursor-pointer focus:outline-none"
                            placeholder="Selecione..."
                        />
                        <Edit2 size={16} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-ios-blue"/>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Rua / Logradouro</label>
                <div className="relative">
                    <Home className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        value={rua}
                        onChange={(e) => setRua(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-ios-blue/50"
                        placeholder="Ex: Av. Principal"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Número</label>
                    <input 
                        type="text" 
                        value={numero}
                        onChange={(e) => setNumero(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-ios-blue/50"
                        placeholder="Ex: 123"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Bairro</label>
                    <input 
                        type="text" 
                        value={bairro}
                        onChange={(e) => setBairro(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-ios-blue/50"
                        placeholder="Ex: Centro"
                    />
                </div>
            </div>
            
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Complemento</label>
                <input 
                    type="text" 
                    value={complemento}
                    onChange={(e) => setComplemento(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-ios-blue/50"
                    placeholder="Ex: Apto 101, Bloco A"
                />
            </div>
        </div>

        {message && (
        <div className={`p-3 rounded-xl flex items-center space-x-2 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
            message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
            {message.type === 'error' && <AlertCircle size={16} />}
            <span>{message.text}</span>
        </div>
        )}

        {/* Actions */}
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

        <button 
          onClick={handleLogout}
          className="w-full bg-white border border-red-100 text-red-500 font-bold py-3.5 rounded-xl hover:bg-red-50 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 shadow-sm"
        >
          <LogOut size={18} />
          <span>Sair do App</span>
        </button>
      </div>

      {isCityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <h3 className="font-bold text-gray-900 text-lg ml-2">Selecionar Cidade</h3>
                <button onClick={() => setIsCityModalOpen(false)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200">
                    <X size={18} />
                </button>
            </div>
            <div className="p-4 bg-gray-50">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        autoFocus
                        placeholder="Busque pelo nome da cidade..."
                        value={modalSearchTerm}
                        onChange={(e) => setModalSearchTerm(e.target.value)}
                        className="w-full bg-white border border-ios-blue/30 rounded-xl py-3 pl-11 pr-4 text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
                {searchingCity ? (
                    <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-ios-blue" size={24} /></div>
                ) : searchedCities.length > 0 ? (
                    <div className="space-y-1">
                        {searchedCities.map(city => (
                            <button
                                key={city.id}
                                onClick={() => handleCitySelect(city)}
                                className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 active:bg-blue-50 transition-colors flex items-center justify-between group border-b border-gray-50 last:border-0"
                            >
                                <div>
                                    <span className="font-semibold text-gray-900 block group-hover:text-ios-blue transition-colors">{city.cidade}</span>
                                    <span className="text-xs text-gray-400 font-medium">{getStateUf(city.uf)}</span>
                                </div>
                                {selectedCityId === city.id && <div className="w-2 h-2 bg-ios-blue rounded-full"></div>}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="py-10 text-center text-gray-400 px-6">
                        {modalSearchTerm.length < 2 ? <p>Digite pelo menos 2 letras para buscar.</p> : <p>Nenhuma cidade encontrada</p>}
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