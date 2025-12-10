
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Loader2, ArrowRight, CheckCircle } from 'lucide-react';

const Login: React.FC = () => {
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // Initialize from navigation state if present
  const [isSignUp, setIsSignUp] = useState(location.state?.isSignUp || false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
            throw new Error("As senhas não coincidem.");
        }
        if (password.length < 6) {
            throw new Error("A senha deve ter pelo menos 6 caracteres.");
        }

        // 1. Criar usuário na Autenticação do Supabase
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) throw authError;

        if (authData.user) {
            // 2. Buscar uma cidade/estado padrão para satisfazer a constraint NOT NULL do banco
            // O usuário será forçado a atualizar isso depois pelo alerta na Home
            const { data: defaultCity } = await supabase
                .from('cidades')
                .select('id, uf')
                .limit(1)
                .maybeSingle();
            
            // Fallbacks seguros para evitar erro de Foreign Key
            const cityId = defaultCity?.id || 1;
            const stateId = defaultCity?.uf || 1;

            // 3. Inserir o registro na tabela pública 'users' com DADOS FICTÍCIOS OBRIGATÓRIOS
            // Isso evita erro de coluna NOT NULL no banco
            const { error: profileError } = await supabase
                .from('users')
                .insert({
                    uuid: authData.user.id,
                    email: email,
                    nome: 'Insere', // Placeholder solicitado
                    tipo: 'consumidor', // Padrão Cliente
                    sexo: 'Outro', // Padrão para satisfazer constraint NOT NULL
                    cidade: cityId,
                    estado: stateId,
                    ativo: true,
                    atividade: [], // Array vazio inicial
                    fotoperfil: '',
                    // Preenchimento de campos obrigatórios com placeholders
                    cpf: '000.000.000-00',
                    rua: 'Insere',
                    numero: 'Insere',
                    bairro: 'Insere',
                    complemento: 'Insere',
                    cep: '00000-000',
                    whatsapp: '(00) 00000-0000'
                });

            if (profileError) {
                console.error("Erro ao criar perfil público:", JSON.stringify(profileError));
                // Tenta mostrar mensagem mais amigável
                throw new Error(`Erro ao criar perfil: ${profileError.message}. Verifique os campos obrigatórios.`);
            }
        }

        alert('Cadastro realizado com sucesso! Faça login para continuar.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // O App.tsx detectará a mudança de sessão e redirecionará
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
      <div className="w-full max-w-sm space-y-8">
        
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
          
          <div className="space-y-4">
             {/* Toggle Login/Signup */}
            <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
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
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 font-medium">
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
                {isSignUp ? 'Criar Conta' : 'Acessar App'}
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
