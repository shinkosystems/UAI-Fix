
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, CheckCircle, Search, Calendar, Star, ShieldCheck, 
  Users, Briefcase, ChevronDown, ChevronUp, Menu, X 
} from 'lucide-react';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const faqs = [
    {
      question: "O cadastro é gratuito?",
      answer: "Sim! O cadastro é totalmente gratuito tanto para clientes quanto para profissionais. Cobramos apenas uma pequena taxa de serviço sobre os agendamentos realizados."
    },
    {
      question: "Como funcionam os pagamentos?",
      answer: "Você pode negociar o pagamento diretamente com o profissional (Dinheiro, PIX) ou, em breve, utilizar nossa plataforma segura de pagamentos integrados."
    },
    {
      question: "Os profissionais são verificados?",
      answer: "Sim, realizamos uma verificação básica de identidade. Além disso, nosso sistema de avaliações garante que os melhores profissionais se destaquem."
    },
    {
      question: "Posso cancelar um agendamento?",
      answer: "Sim, você pode cancelar ou reagendar serviços através do painel de controle, respeitando a política de cancelamento definida pelo profissional."
    }
  ];

  return (
    <div className="min-h-screen bg-[#F2F4F8] font-sans text-gray-900 overflow-x-hidden selection:bg-ios-blue selection:text-white">
      
      {/* --- NAVBAR --- */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-5 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
               <img 
                 src="https://uehyjyyvkrlggwmfdhgh.supabase.co/storage/v1/object/public/imagens/imagens/994ff870-5268-4a13-8378-0661a9ffe9b9.jpeg" 
                 alt="Logo" 
                 className="w-full h-full object-cover rounded-xl opacity-90"
               />
            </div>
            <span className="text-xl font-bold tracking-tight">UAI Fix</span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#como-funciona" className="text-sm font-medium text-gray-500 hover:text-ios-blue transition-colors">Como Funciona</a>
            <a href="#beneficios" className="text-sm font-medium text-gray-500 hover:text-ios-blue transition-colors">Benefícios</a>
            <a href="#faq" className="text-sm font-medium text-gray-500 hover:text-ios-blue transition-colors">Dúvidas</a>
            <div className="h-6 w-px bg-gray-200"></div>
            <button 
              onClick={() => navigate('/login')}
              className="text-sm font-bold text-gray-900 hover:text-ios-blue transition-colors"
            >
              Entrar
            </button>
            <button 
              onClick={() => navigate('/login', { state: { isSignUp: true } })}
              className="bg-black text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-gray-200 hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              Cadastre-se
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2 text-gray-600 bg-gray-100 rounded-lg"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-5 py-4 space-y-4 shadow-xl animate-in slide-in-from-top-5">
            <a href="#como-funciona" className="block text-sm font-bold text-gray-600 py-2" onClick={() => setIsMobileMenuOpen(false)}>Como Funciona</a>
            <a href="#beneficios" className="block text-sm font-bold text-gray-600 py-2" onClick={() => setIsMobileMenuOpen(false)}>Benefícios</a>
            <a href="#faq" className="block text-sm font-bold text-gray-600 py-2" onClick={() => setIsMobileMenuOpen(false)}>Dúvidas</a>
            <div className="pt-4 border-t border-gray-100 flex flex-col space-y-3">
              <button 
                onClick={() => navigate('/login')}
                className="w-full bg-gray-100 text-gray-900 py-3 rounded-xl font-bold"
              >
                Entrar
              </button>
              <button 
                onClick={() => navigate('/login', { state: { isSignUp: true } })}
                className="w-full bg-ios-blue text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-200"
              >
                Criar Conta Grátis
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* --- HERO SECTION --- */}
      <section className="pt-32 pb-20 md:pt-48 md:pb-32 px-5 relative overflow-hidden">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center relative z-10">
          <div className="space-y-8 text-center md:text-left">
            <div className="inline-flex items-center space-x-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <span className="flex h-2 w-2 rounded-full bg-blue-600"></span>
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">A plataforma #1 de serviços</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black text-gray-900 tracking-tight leading-[1.1] animate-in fade-in slide-in-from-bottom-8 duration-1000">
              Serviços rápidos,<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">sem complicação.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-gray-500 font-medium leading-relaxed max-w-lg mx-auto md:mx-0 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-100">
              Encontre profissionais qualificados para reparos, reformas, limpeza e muito mais. Agende em segundos e resolva seus problemas.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4 pt-4 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
              <button 
                onClick={() => navigate('/login', { state: { isSignUp: true } })}
                className="w-full sm:w-auto bg-black text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
              >
                Começar Agora
                <ArrowRight size={20} className="ml-2" />
              </button>
              <button 
                onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full sm:w-auto bg-white text-gray-900 border border-gray-200 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-gray-50 transition-colors"
              >
                Saiba Mais
              </button>
            </div>

            <div className="pt-8 flex items-center justify-center md:justify-start space-x-6 text-sm font-medium text-gray-400 animate-in fade-in duration-1000 delay-500">
              <div className="flex items-center"><CheckCircle size={16} className="text-green-500 mr-2"/> Gratuito para clientes</div>
              <div className="flex items-center"><CheckCircle size={16} className="text-green-500 mr-2"/> Profissionais verificados</div>
            </div>
          </div>

          <div className="relative animate-in fade-in zoom-in duration-1000 delay-300">
            {/* Abstract Blobs */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-blue-200 to-purple-200 rounded-full blur-3xl opacity-50 animate-pulse"></div>
            
            {/* App Mockup Card */}
            <div className="relative bg-white/60 backdrop-blur-xl border border-white/50 rounded-[2.5rem] p-6 shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-700">
               <div className="bg-white rounded-[2rem] overflow-hidden shadow-inner border border-gray-100">
                  {/* Fake UI Header */}
                  <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                     <div className="w-24 h-4 bg-gray-200 rounded-full"></div>
                     <div className="w-8 h-8 bg-blue-100 rounded-full"></div>
                  </div>
                  {/* Fake UI Body */}
                  <div className="p-6 space-y-4">
                     <div className="h-40 bg-blue-50 rounded-2xl w-full flex items-center justify-center">
                        <Search size={48} className="text-blue-200" />
                     </div>
                     <div className="space-y-2">
                        <div className="h-4 bg-gray-100 rounded-full w-3/4"></div>
                        <div className="h-4 bg-gray-100 rounded-full w-1/2"></div>
                     </div>
                     <div className="grid grid-cols-3 gap-3 pt-4">
                        {[1,2,3].map(i => (
                           <div key={i} className="bg-gray-50 p-3 rounded-xl flex flex-col items-center space-y-2">
                              <div className="w-8 h-8 rounded-full bg-white shadow-sm"></div>
                              <div className="w-10 h-2 bg-gray-200 rounded-full"></div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
               
               {/* Floating Badge */}
               <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-2xl shadow-xl border border-gray-50 flex items-center space-x-3 animate-bounce">
                  <div className="bg-green-100 p-2 rounded-full text-green-600">
                     <Star size={24} fill="currentColor" />
                  </div>
                  <div>
                     <p className="text-xs font-bold text-gray-400 uppercase">Avaliação Média</p>
                     <p className="text-xl font-black text-gray-900">4.9/5.0</p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- HOW IT WORKS --- */}
      <section id="como-funciona" className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-5">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">Como funciona?</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Simples, rápido e seguro. Conectamos você aos melhores profissionais da sua região em poucos cliques.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gray-200 to-transparent z-0"></div>

            {[
              { 
                icon: Search, 
                title: "1. Busque", 
                desc: "Selecione a categoria do serviço que você precisa, como encanador, eletricista ou faxina." 
              },
              { 
                icon: Calendar, 
                title: "2. Agende", 
                desc: "Escolha o profissional, veja avaliações e solicite um orçamento ou agendamento direto." 
              },
              { 
                icon: Star, 
                title: "3. Avalie", 
                desc: "Após o serviço realizado, avalie o profissional e ajude a comunidade com seu feedback." 
              }
            ].map((step, i) => (
              <div key={i} className="relative z-10 bg-white p-8 rounded-[2rem] border border-gray-100 shadow-lg hover:shadow-xl transition-all text-center group">
                <div className="w-20 h-20 mx-auto bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform shadow-sm">
                  <step.icon size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-500 leading-relaxed text-sm">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- FOR WHOM SECTION --- */}
      <section id="beneficios" className="py-24 px-5">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Consumidor Card */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
              <div className="relative z-10">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8">
                  <Users size={32} />
                </div>
                <h3 className="text-3xl font-bold mb-4">Para Clientes</h3>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-start">
                    <CheckCircle className="mr-3 mt-1 flex-shrink-0 opacity-80" size={20} />
                    <span>Encontre profissionais de confiança rapidamente.</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="mr-3 mt-1 flex-shrink-0 opacity-80" size={20} />
                    <span>Compare preços e veja avaliações reais.</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="mr-3 mt-1 flex-shrink-0 opacity-80" size={20} />
                    <span>Pagamento seguro e suporte dedicado.</span>
                  </li>
                </ul>
                <button 
                  onClick={() => navigate('/login', { state: { isSignUp: true } })}
                  className="bg-white text-blue-900 px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-50 transition-colors"
                >
                  Quero Contratar
                </button>
              </div>
            </div>

            {/* Profissional Card */}
            <div className="bg-white rounded-[2.5rem] p-8 md:p-12 text-gray-900 shadow-vitrified border border-white relative overflow-hidden group">
              <div className="relative z-10">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-8 text-gray-900">
                  <Briefcase size={32} />
                </div>
                <h3 className="text-3xl font-bold mb-4">Para Profissionais</h3>
                <ul className="space-y-4 mb-8 text-gray-600">
                  <li className="flex items-start">
                    <CheckCircle className="mr-3 mt-1 flex-shrink-0 text-green-500" size={20} />
                    <span>Aumente sua visibilidade e conquiste mais clientes.</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="mr-3 mt-1 flex-shrink-0 text-green-500" size={20} />
                    <span>Gerencie sua agenda e orçamentos em um só lugar.</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="mr-3 mt-1 flex-shrink-0 text-green-500" size={20} />
                    <span>Receba avaliações e construa sua reputação.</span>
                  </li>
                </ul>
                <button 
                  onClick={() => navigate('/login', { state: { isSignUp: true } })}
                  className="bg-gray-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-gray-800 transition-colors"
                >
                  Quero Trabalhar
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- FEATURES HIGHLIGHT --- */}
      <section className="py-24 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-5">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="md:w-1/2">
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4 mt-8">
                     <div className="bg-blue-50 p-6 rounded-3xl h-48 flex flex-col justify-end">
                        <ShieldCheck size={32} className="text-blue-600 mb-2"/>
                        <span className="font-bold text-gray-800">Segurança Total</span>
                     </div>
                     <div className="bg-gray-100 p-6 rounded-3xl h-64 flex flex-col justify-end">
                        <Star size={32} className="text-yellow-600 mb-2"/>
                        <span className="font-bold text-gray-800">Avaliações 5 Estrelas</span>
                     </div>
                  </div>
                  <div className="space-y-4">
                     <div className="bg-gray-900 p-6 rounded-3xl h-64 flex flex-col justify-end text-white">
                        <Calendar size={32} className="mb-2"/>
                        <span className="font-bold">Agenda Inteligente</span>
                     </div>
                     <div className="bg-purple-50 p-6 rounded-3xl h-48 flex flex-col justify-end">
                        <Briefcase size={32} className="text-purple-600 mb-2"/>
                        <span className="font-bold text-gray-800">Orçamentos Rápidos</span>
                     </div>
                  </div>
               </div>
            </div>
            <div className="md:w-1/2">
              <h2 className="text-4xl font-black text-gray-900 mb-6 leading-tight">
                Tudo o que você precisa em uma única plataforma.
              </h2>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                Deixamos a burocracia de lado. O UAI Fix foi desenhado para facilitar a conexão entre quem precisa e quem resolve. Gestão de agenda, chat integrado, histórico de serviços e muito mais.
              </p>
              <div className="flex flex-col space-y-3">
                 {['Chat em tempo real', 'Histórico completo de pedidos', 'Notificações instantâneas', 'Suporte 24/7'].map((item, i) => (
                    <div key={i} className="flex items-center text-gray-700 font-medium">
                       <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mr-3">
                          <CheckCircle size={14} className="text-green-600" />
                       </div>
                       {item}
                    </div>
                 ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- FAQ SECTION --- */}
      <section id="faq" className="py-24 px-5 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Perguntas Frequentes</h2>
            <p className="text-gray-500 mt-2">Tire suas dúvidas sobre o UAI Fix.</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div 
                key={index}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden transition-all duration-300"
              >
                <button 
                  onClick={() => toggleFaq(index)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className="font-bold text-gray-900">{faq.question}</span>
                  {openFaqIndex === index ? <ChevronUp className="text-ios-blue"/> : <ChevronDown className="text-gray-400"/>}
                </button>
                {openFaqIndex === index && (
                  <div className="px-6 pb-6 text-gray-600 text-sm leading-relaxed animate-in slide-in-from-top-2">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="bg-white border-t border-gray-200 pt-20 pb-10 px-5">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                   <div className="w-4 h-4 bg-white rounded-sm"></div>
                </div>
                <span className="text-xl font-bold tracking-tight">UAI Fix</span>
              </div>
              <p className="text-gray-500 max-w-sm mb-6">
                A plataforma que simplifica sua vida conectando você aos melhores profissionais da cidade. Rápido, fácil e seguro.
              </p>
              <div className="flex space-x-4">
                {/* Social Icons Placeholder */}
                {[1,2,3].map(i => <div key={i} className="w-10 h-10 bg-gray-100 rounded-full hover:bg-gray-200 cursor-pointer transition-colors"></div>)}
              </div>
            </div>
            
            <div>
              <h4 className="font-bold text-gray-900 mb-6">Plataforma</h4>
              <ul className="space-y-4 text-sm text-gray-500">
                <li><a href="#" className="hover:text-ios-blue">Como Funciona</a></li>
                <li><a href="#" className="hover:text-ios-blue">Para Profissionais</a></li>
                <li><a href="#" className="hover:text-ios-blue">Segurança</a></li>
                <li><a href="#" className="hover:text-ios-blue">Ajuda</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-gray-900 mb-6">Legal</h4>
              <ul className="space-y-4 text-sm text-gray-500">
                <li><a href="#" className="hover:text-ios-blue">Termos de Uso</a></li>
                <li><a href="#" className="hover:text-ios-blue">Privacidade</a></li>
                <li><a href="#" className="hover:text-ios-blue">Cookies</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center text-xs text-gray-400">
            <p>&copy; {new Date().getFullYear()} UAI Fix. Todos os direitos reservados.</p>
            <p className="mt-2 md:mt-0">Feito com ❤️ em Minas Gerais.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
