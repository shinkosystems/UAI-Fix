
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Loader2, ArrowRight, CheckCircle, User, FileText, MapPin, Home, Navigation } from 'lucide-react';
import { City } from '../types';

const Login: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Auth Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Personal Data Fields (For Sign Up)
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [complemento, setComplemento] = useState('');
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  
  // Data Lists
  const [cities, setCities] = useState<City[]>([]);
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [isSignUp, setIsSignUp] = useState(location.state?.isSignUp || false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch cities on mount
  useEffect(() => {
    const fetchCities = async () => {
        const { data } = await supabase.from('cidades').select('*').order('cidade', { ascending: true });
        if (data) setCities(data);
    };
    fetchCities();
  }, []);

  // Fetch Address by CEP
  const handleCepBlur = async () => {
      const cleanCep = cep.replace(/\D/g, '');
      if (cleanCep.length === 8) {
          setLoadingCep(true);
          try {
              const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
              const data = await response.json();
              if (!data.erro) {
                  setRua(data.logradouro);
                  setBairro(data.bairro);
                  // Try to match city
                  if (data.localidade) {
                      const matchedCity = cities.find(c => c.cidade.toLowerCase() === data.localidade.toLowerCase());
                      if (matchedCity) {
                          setSelectedCityId(matchedCity.id.toString());
                      }
                  }
                  // Focus on number field
                  document.getElementById('numeroInput')?.focus();
              }
          } catch (error) {
              console.error("Erro ao buscar CEP", error);
          } finally {
              setLoadingCep(false);
          }
      }
  };

  const formatCpf = (v: string) => {
    return v.replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .slice(0, 14);
  };

  const formatCep = (v: string) => {
    return v.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (isSignUp) {
        // Validation
        if (password !== confirmPassword) throw new Error("As senhas não coincidem.");
        if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
        if (!nome.trim()) throw new Error("Preencha seu nome completo.");
        if (cpf.length < 14) throw new Error("CPF inválido.");
        if (!cep || !rua || !numero || !bairro || !selectedCityId) throw new Error("Preencha todo o endereço.");

        // 1. Create User in Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) throw authError;

        if (authData.user) {
            // Determine State ID based on selected City
            const selectedCityObj = cities.find(c => c.id.toString() === selectedCityId);
            const stateId = selectedCityObj?.uf || 1; // Fallback to 1 if not found

            // 2. Insert into 'users' table with REAL DATA
            const { error: profileError } = await supabase
                .from('users')
                .insert({
                    uuid: authData.user.id,
                    email: email,
                    nome: nome,
                    cpf: cpf,
                    tipo: 'consumidor',
                    sexo: 'Outro', // Default
                    ativo: true,
                    fotoperfil: '',
                    
                    // Address
                    cep: cep,
                    rua: rua,
                    numero: numero,
                    bairro: bairro,
                    complemento: complemento,
                    cidade: parseInt(selectedCityId),
                    estado: stateId,
                    
                    whatsapp: '', // User can add later
                    atividade: []
                });

            if (profileError) {
                // If profile creation fails, we might want to inform the user or even rollback (delete auth user), 
                // but for now let's just show the error.
                throw new Error(`Erro ao salvar dados do perfil: ${profileError.message}`);
            }
        }

        alert('Cadastro realizado com sucesso! Você já pode entrar.');
        // Switch to login tab to force user to login or auto-login if supabase handles it
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (!signInError) {
             // App.tsx handles redirect
        } else {
             setIsSignUp(false);
        }

      } else {
        // Login Logic
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ios-bg flex flex-col items-center justify-center p-6">
      <div className={`w-full ${isSignUp ? 'max-w-lg' : 'max-w-sm'} transition-all duration-300 space-y-8`}>
        
        {/* Logo / Header */}
        <div className="text-center space-y-2">
          <div className="w-24 h-24 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-blue-200 mb-6 overflow-hidden bg-white">
            <img 
               src="https://uehyjyyvkrlggwmfdhgh.supabase.co/storage/v1/object/public/imagens/imagens/994ff870-5268-4a13-8378-0661a9ffe9b9.jpeg" 
               alt="Logo" 
               className="w-full h-full object-cover"
             />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">UAI Fix</h1>
          <p className="text-gray-500 text-sm">Agende serviços com facilidade.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleAuth} className="bg-white p-8 rounded-[2rem] shadow-glass space-y-5 border border-white">
          
          {/* Toggle Login/Signup */}
          <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
            <button
              type="button"
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${!isSignUp ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => { setIsSignUp(false); setErrorMsg(null); }}
            >
              Entrar
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${isSignUp ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => { setIsSignUp(true); setErrorMsg(null); }}
            >
              Cadastrar
            </button>
          </div>

          <div className="space-y-4">
            
            {/* SIGN UP EXTRA FIELDS */}
            {isSignUp && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase ml-1">Nome Completo</label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                required={isSignUp}
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3.5 pl-11 pr-4 text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/20 transition-all text-sm"
                                placeholder="Seu nome"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase ml-1">CPF</label>
                        <div className="relative">
                            <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                required={isSignUp}
                                value={cpf}
                                onChange={(e) => setCpf(formatCpf(e.target.value))}
                                maxLength={14}
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3.5 pl-11 pr-4 text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/20 transition-all text-sm"
                                placeholder="000.000.000-00"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1">CEP</label>
                            <div className="relative">
                                {loadingCep ? (
                                    <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 text-ios-blue animate-spin" size={18} />
                                ) : (
                                    <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                )}
                                <input
                                    type="text"
                                    required={isSignUp}
                                    value={cep}
                                    onChange={(e) => setCep(formatCep(e.target.value))}
                                    onBlur={handleCepBlur}
                                    maxLength={9}
                                    className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3.5 pl-11 pr-2 text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/20 transition-all text-sm"
                                    placeholder="00000-000"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1">Cidade</label>
                            <select
                                required={isSignUp}
                                value={selectedCityId}
                                onChange={(e) => setSelectedCityId(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3.5 px-3 text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/20 transition-all text-sm appearance-none"
                            >
                                <option value="">Selecione...</option>
                                {cities.map(c => (
                                    <option key={c.id} value={c.id}>{c.cidade}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase ml-1">Rua / Logradouro</label>
                        <div className="relative">
                            <Home className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                required={isSignUp}
                                value={rua}
                                onChange={(e) => setRua(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3.5 pl-11 pr-4 text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/20 transition-all text-sm"
                                placeholder="Nome da rua"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1">Número</label>
                            <input
                                id="numeroInput"
                                type="text"
                                required={isSignUp}
                                value={numero}
                                onChange={(e) => setNumero(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3.5 px-4 text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/20 transition-all text-sm"
                                placeholder="123"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1">Bairro</label>
                            <input
                                type="text"
                                required={isSignUp}
                                value={bairro}
                                onChange={(e) => setBairro(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3.5 px-4 text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/20 transition-all text-sm"
                                placeholder="Centro"
                            />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase ml-1">Complemento (Opcional)</label>
                        <input
                            type="text"
                            value={complemento}
                            onChange={(e) => setComplemento(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3.5 px-4 text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/20 transition-all text-sm"
                            placeholder="Apto, Bloco..."
                        />
                    </div>
                </div>
            )}

            {/* COMMON FIELDS */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3.5 pl-11 pr-4 text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/20 focus:border-ios-blue transition-all"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3.5 pl-11 pr-4 text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/20 focus:border-ios-blue transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Confirm Password Field */}
            {isSignUp && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Confirmar Senha</label>
                <div className="relative">
                    <CheckCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full bg-gray-50 border rounded-xl py-3.5 pl-11 pr-4 text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/20 focus:border-ios-blue transition-all ${
                        confirmPassword && password !== confirmPassword ? 'border-red-300 focus:border-red-500' : 'border-gray-100'
                    }`}
                    placeholder="Repita a senha"
                    />
                </div>
                </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 font-medium animate-in fade-in">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ios-blue hover:bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 active:scale-[0.98] transition-all flex items-center justify-center group"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                {isSignUp ? 'Finalizar Cadastro' : 'Acessar App'}
                <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400">
          Ao continuar, você concorda com nossos <a href="#" className="underline">Termos</a> e <a href="#" className="underline">Privacidade</a>.
        </p>
      </div>
    </div>
  );
};

export default Login;
