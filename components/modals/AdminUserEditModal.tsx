import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { User, City, Estado } from '../../types';
import { X, Save, Loader2, User as UserIcon, Mail, Phone, MapPin, Shield, CheckCircle, AlertCircle, Search, FileText } from 'lucide-react';
import { SearchableSelect } from '../SearchableSelect';
import { formatPhone, formatCpf, formatCep } from '../../utils/masks';
import { getOrProvisionCity } from '../../utils/cityHelper';

interface AdminUserEditModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: (updatedUser: User) => void;
}

export const AdminUserEditModal: React.FC<AdminUserEditModalProps> = ({
  user,
  isOpen,
  onClose,
  onUserUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'pessoal' | 'endereco' | 'perfil'>('pessoal');
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // States for database lookup lists
  const [states, setStates] = useState<Estado[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  // Form state
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cpf, setCpf] = useState('');
  const [sexo, setSexo] = useState('');
  const [tipo, setTipo] = useState('Consumidor');
  const [ativo, setAtivo] = useState(true);
  const [fotoperfil, setFotoperfil] = useState('');
  const [biografia, setBiografia] = useState('');

  // Address fields
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [complemento, setComplemento] = useState('');
  const [selectedStateId, setSelectedStateId] = useState<number | ''>('');
  const [selectedCityId, setSelectedCityId] = useState<number | ''>('');

  // Fetch states list on load
  useEffect(() => {
    const fetchStates = async () => {
      try {
        const { data, error } = await supabase
          .from('estados')
          .select('*')
          .order('uf', { ascending: true });
        if (!error && data) {
          setStates(data);
        }
      } catch (err) {
        console.error('Erro ao buscar estados:', err);
      }
    };
    fetchStates();
  }, []);

  // Fetch cities when state changes
  useEffect(() => {
    const fetchCities = async () => {
      if (!selectedStateId) {
        setCities([]);
        return;
      }
      setLoadingCities(true);
      try {
        const { data, error } = await supabase
          .from('cidades')
          .select('*')
          .eq('uf', selectedStateId)
          .order('cidade', { ascending: true });
        if (!error && data) {
          setCities(data);
        }
      } catch (err) {
        console.error('Erro ao carregar cidades:', err);
      } finally {
        setLoadingCities(false);
      }
    };
    fetchCities();
  }, [selectedStateId]);

  // Load user data into form state when modal opens or user changes
  useEffect(() => {
    if (user) {
      setNome(user.nome || '');
      setEmail(user.email || '');
      setWhatsapp(formatPhone(user.whatsapp));
      setCpf(formatCpf(user.cpf));
      setSexo(user.sexo || '');
      setTipo(user.tipo || 'Consumidor');
      setAtivo(user.ativo !== undefined ? user.ativo : true);
      setFotoperfil(user.fotoperfil || '');
      setBiografia(user.biografia || '');

      setCep(formatCep(user.cep));
      setRua(user.rua || '');
      setNumero(user.numero || '');
      setBairro(user.bairro || '');
      setComplemento(user.complemento || '');
      setSelectedStateId(user.estado || '');
      setSelectedCityId(user.cidade || '');

      setMessage(null);
      setActiveTab('pessoal');
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  // Auto CEP Lookup via ViaCEP
  const handleFetchCep = async (cleanCep: string) => {
    if (cleanCep.length !== 8) return;
    try {
      setLoadingCep(true);
      setMessage(null);
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (!response.ok) throw new Error('Erro ao buscar CEP');
      const data = await response.json();

      if (data.erro) {
        setMessage({ type: 'warning', text: 'CEP não encontrado.' });
        return;
      }

      setRua(data.logradouro || rua);
      setBairro(data.bairro || bairro);

      if (data.localidade) {
        const provisionedCity = await getOrProvisionCity(data.localidade, data.uf);
        if (provisionedCity) {
          setSelectedCityId(provisionedCity.id);
          setSelectedStateId(provisionedCity.uf);
        }
      }
    } catch (err) {
      console.error('Erro na consulta de CEP:', err);
      setMessage({ type: 'warning', text: 'Falha ao buscar CEP. Preencha os campos manualmente.' });
    } finally {
      setLoadingCep(false);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    setCep(formatted);
    const cleanCep = formatted.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      handleFetchCep(cleanCep);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const updateData: Partial<User> = {
        nome: nome.trim(),
        email: email.trim(),
        whatsapp: whatsapp.trim(),
        cpf: cpf.trim(),
        sexo: sexo,
        tipo: tipo,
        ativo: ativo,
        fotoperfil: fotoperfil.trim(),
        biografia: biografia.trim(),
        cep: cep.trim(),
        rua: rua.trim(),
        numero: numero.trim(),
        bairro: bairro.trim(),
        complemento: complemento.trim(),
        estado: selectedStateId ? Number(selectedStateId) : user.estado,
        cidade: selectedCityId ? Number(selectedCityId) : user.cidade,
      };

      let query = supabase.from('users').update(updateData);
      
      if (user.uuid) {
        query = query.eq('uuid', user.uuid);
      } else {
        query = query.eq('id', user.id);
      }

      const { error } = await query;

      if (error) throw error;

      const updatedUser: User = {
        ...user,
        ...updateData,
      };

      setMessage({ type: 'success', text: 'Usuário atualizado com sucesso!' });
      onUserUpdated(updatedUser);

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Erro ao salvar usuário:', err);
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar alterações do usuário.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center space-x-4 z-10">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center font-bold text-lg text-white overflow-hidden flex-shrink-0">
              {fotoperfil ? (
                <img src={fotoperfil} alt={nome} className="w-full h-full object-cover" />
              ) : (
                <span>{nome?.substring(0, 2).toUpperCase() || 'US'}</span>
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold truncate max-w-xs">{nome || 'Detalhes do Usuário'}</h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                  ativo ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                <span className="truncate">{email || 'Sem e-mail'}</span>
                <span>•</span>
                <span className="capitalize font-medium text-blue-300">{tipo}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="z-10 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-all cursor-pointer"
          >
            <X size={20} />
          </button>

          {/* Decorative background glow */}
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-600/20 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 space-x-6 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('pessoal')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'pessoal'
                ? 'border-blue-600 text-blue-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserIcon size={15} />
            Dados Pessoais & Conta
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('endereco')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'endereco'
                ? 'border-blue-600 text-blue-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MapPin size={15} />
            Endereço
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('perfil')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'perfil'
                ? 'border-blue-600 text-blue-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText size={15} />
            Perfil & Biografia
          </button>
        </div>

        {/* Feedback Alert */}
        {message && (
          <div className={`mx-6 mt-4 p-3.5 rounded-xl text-xs flex items-center gap-2.5 font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : message.type === 'warning'
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {message.type === 'success' && <CheckCircle size={16} className="text-emerald-600 flex-shrink-0" />}
            {message.type === 'warning' && <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />}
            {message.type === 'error' && <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* Tab 1: Pessoal */}
          {activeTab === 'pessoal' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  placeholder="Nome do usuário"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  placeholder="email@exemplo.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp / Telefone</label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
                  maxLength={15}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">CPF</label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  maxLength={14}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  placeholder="000.000.000-00"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Sexo</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Não informado' },
                    { value: 'Masculino', label: 'Masculino' },
                    { value: 'Feminino', label: 'Feminino' },
                    { value: 'Outro', label: 'Outro' },
                  ]}
                  value={sexo}
                  onChange={(val) => setSexo(val)}
                  placeholder="Selecione o sexo"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Usuário (Perfil)</label>
                <SearchableSelect
                  options={[
                    { value: 'Consumidor', label: 'Consumidor' },
                    { value: 'Profissional', label: 'Profissional' },
                    { value: 'Orçamentista', label: 'Orçamentista' },
                    { value: 'Planejista', label: 'Planejista' },
                    { value: 'Gestor', label: 'Gestor' },
                  ]}
                  value={tipo}
                  onChange={(val) => setTipo(val)}
                  placeholder="Selecione o perfil"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status da Conta</label>
                <SearchableSelect
                  options={[
                    { value: 'true', label: 'Ativo' },
                    { value: 'false', label: 'Inativo' },
                  ]}
                  value={ativo ? 'true' : 'false'}
                  onChange={(val) => setAtivo(val === 'true')}
                />
              </div>
            </div>
          )}

          {/* Tab 2: Endereço */}
          {activeTab === 'endereco' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">CEP</label>
                <div className="relative">
                  <input
                    type="text"
                    value={cep}
                    onChange={handleCepChange}
                    maxLength={9}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="00000-000"
                  />
                  {loadingCep && (
                    <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-600" />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Estado (UF)</label>
                <SearchableSelect
                  options={states.map((st) => ({
                    value: st.id,
                    label: st.uf,
                    sublabel: st.nome,
                  }))}
                  value={selectedStateId}
                  onChange={(val) => {
                    setSelectedStateId(val ? Number(val) : '');
                    setSelectedCityId('');
                  }}
                  placeholder="Selecione o Estado"
                  searchPlaceholder="Pesquisar estado..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cidade</label>
                <SearchableSelect
                  options={cities.map((ct) => ({
                    value: ct.id,
                    label: ct.cidade,
                  }))}
                  value={selectedCityId}
                  disabled={!selectedStateId || loadingCities}
                  loading={loadingCities}
                  onChange={(val) => setSelectedCityId(val ? Number(val) : '')}
                  placeholder={loadingCities ? 'Carregando cidades...' : 'Selecione a Cidade'}
                  searchPlaceholder="Pesquisar cidade..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bairro</label>
                <input
                  type="text"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  placeholder="Nome do bairro"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Rua / Logradouro</label>
                <input
                  type="text"
                  value={rua}
                  onChange={(e) => setRua(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  placeholder="Nome da rua"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Número</label>
                <input
                  type="text"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  placeholder="123"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Complemento</label>
                <input
                  type="text"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  placeholder="Apto, Bloco, etc."
                />
              </div>
            </div>
          )}

          {/* Tab 3: Perfil & Biografia */}
          {activeTab === 'perfil' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">URL da Foto de Perfil</label>
                <input
                  type="text"
                  value={fotoperfil}
                  onChange={(e) => setFotoperfil(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  placeholder="https://..."
                />
                {fotoperfil && (
                  <div className="mt-2 flex items-center space-x-3">
                    <img
                      src={fotoperfil}
                      alt="Prévia"
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <span className="text-[11px] text-slate-500">Prévia da imagem de perfil</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Biografia / Sobre</label>
                <textarea
                  rows={4}
                  value={biografia}
                  onChange={(e) => setBiografia(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  placeholder="Descrição ou informações sobre o profissional/cliente..."
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save size={15} />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default AdminUserEditModal;
