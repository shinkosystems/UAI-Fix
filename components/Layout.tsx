
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, Calendar, User, LogOut, Settings, Menu, X, FileText, ShoppingBag, PlayCircle, CalendarCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userType, setUserType] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loadingUserType, setLoadingUserType] = useState(true);

  useEffect(() => {
    const fetchUserType = async (user: any) => {
      setLoadingUserType(true);
      if (user) {
        try {
          // Use maybeSingle() to handle 0 or 1 result gracefully without erroring on 0 rows
          const { data, error } = await supabase
            .from('users')
            .select('tipo')
            .eq('uuid', user.id)
            .maybeSingle();
          
          if (error) {
             // Fix: Log actual message instead of [object Object]
             console.error("Supabase error fetching user type:", error.message || error);
             throw error;
          }
          
          setUserType(data?.tipo || null);
        } catch (error: any) {
          console.error("Error fetching user type:", error.message || error);
          setUserType(null);
        }
      } else {
        setUserType(null);
      }
      setLoadingUserType(false);
    };

    // Get initial user state on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchUserType(session?.user ?? null);
    });

    // Listen for auth state changes (login, logout)
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      fetchUserType(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Close drawer when route changes
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => {
    return location.pathname === path ? 'text-ios-blue bg-blue-50' : 'text-gray-500 hover:bg-gray-100';
  };

  const isActiveMobile = (path: string) => {
    return location.pathname === path ? 'text-ios-blue' : 'text-gray-400';
  };

  // Logic to hide Bottom Navbar on specific detail pages (Mobile Only)
  const shouldHideNav = location.pathname.includes('/professional/') || location.pathname.includes('/planning/');
  
  const normType = userType?.toLowerCase() || '';
  const isManager = !loadingUserType && normType === 'gestor';
  // Internal users (Gestor, Planejista, Orcamentista)
  const isInternal = !loadingUserType && (normType === 'gestor' || normType === 'planejista' || normType === 'orcamentista');
  
  // Logic for Agenda vs Execution
  // Agenda: Everyone EXCEPT Consumidor and Profissional
  const showAgenda = !loadingUserType && normType !== '' && normType !== 'consumidor' && normType !== 'profissional';
  
  // Execution (Now labeled Agenda for Pros/Clients): ONLY Consumidor and Profissional
  const showExecution = !loadingUserType && (normType === 'consumidor' || normType === 'profissional');


  return (
    <div className="flex min-h-screen bg-[#F2F4F8]">
      
      {/* --- MOBILE HEADER BUTTON (Hamburger) --- */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button 
          onClick={() => setIsDrawerOpen(true)}
          className="bg-white/90 backdrop-blur-md p-2.5 rounded-full shadow-lg border border-white/50 text-gray-700 active:scale-95 transition-transform"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* --- MOBILE DRAWER OVERLAY --- */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm md:hidden animate-in fade-in duration-300"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* --- SIDEBAR (Desktop & Mobile Drawer) --- */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-[60] w-72 bg-white border-r border-gray-200 flex flex-col h-full
          transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
          md:translate-x-0 md:static md:h-screen md:z-30 md:w-64
          ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shadow-sm">
               <img 
                 src="https://uehyjyyvkrlggwmfdhgh.supabase.co/storage/v1/object/public/imagens/imagens/994ff870-5268-4a13-8378-0661a9ffe9b9.jpeg" 
                 alt="Logo" 
                 className="w-full h-full object-cover"
               />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">UAI Fix</h1>
              <p className="text-xs text-gray-400 font-medium">Painel de Gestão</p>
            </div>
          </div>
          {/* Close button for mobile */}
          <button 
            onClick={() => setIsDrawerOpen(false)}
            className="md:hidden p-2 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-4">Menu Principal</p>
          
          <button 
            onClick={() => navigate('/')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium ${isActive('/')}`}
          >
            <Home size={20} />
            <span>Início</span>
          </button>

          <button 
            onClick={() => navigate('/search')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium ${isActive('/search')}`}
          >
            <Search size={20} />
            <span>Buscar Serviços</span>
          </button>

          <button 
            onClick={() => navigate('/orders')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium ${isActive('/orders')}`}
          >
            <ShoppingBag size={20} />
            <span>Meus Pedidos</span>
          </button>

          {showAgenda && (
            <button 
              onClick={() => navigate('/calendar')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium ${isActive('/calendar')}`}
            >
              <Calendar size={20} />
              <span>Agenda</span>
            </button>
          )}

          {showExecution && (
            <button 
              onClick={() => navigate('/execution')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium ${isActive('/execution')}`}
            >
              <CalendarCheck size={20} />
              <span>Agenda</span>
            </button>
          )}

          <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-6">Conta</p>

          <button 
            onClick={() => navigate('/profile')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium ${isActive('/profile')}`}
          >
            <User size={20} />
            <span>Meu Perfil</span>
          </button>
          
          {isInternal && (
            <button 
              onClick={() => navigate('/chamados')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium ${isActive('/chamados')}`}
            >
              <FileText size={20} />
              <span>Chamados</span>
            </button>
          )}

          {isManager && (
            <button 
              onClick={() => navigate('/settings')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium ${isActive('/settings')}`}
            >
              <Settings size={20} />
              <span>Configurações</span>
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-gray-100">
            <button 
                onClick={async () => { await supabase.auth.signOut(); navigate('/login'); }}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all font-medium"
            >
                <LogOut size={20} />
                <span>Sair</span>
            </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 min-h-screen relative w-full max-w-[100vw] overflow-x-hidden min-w-0">
        <div className={`h-full w-full mx-auto md:p-8 ${shouldHideNav ? 'pb-8' : 'pb-28 md:pb-8'}`}>
          <div className="md:max-w-7xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>

      {/* --- MOBILE BOTTOM NAV (Optional: Keep for quick access to main tabs, hide if overlapping) --- */}
      {!isDrawerOpen && (
        <div 
            className={`md:hidden fixed bottom-6 left-6 right-6 z-40 transition-transform duration-500 ease-in-out ${shouldHideNav ? 'translate-y-[200%]' : 'translate-y-0'}`}
        >
            <nav className="vitrified rounded-[2rem] shadow-floating max-w-md mx-auto">
            <div className="flex justify-around items-center h-16 px-2">
                <button 
                onClick={() => navigate('/')} 
                className={`flex flex-col items-center justify-center w-full space-y-1 group ${isActiveMobile('/')}`}
                >
                <div className={`p-1.5 rounded-full transition-all duration-300 ${location.pathname === '/' ? 'bg-blue-50/50' : 'bg-transparent'}`}>
                    <Home size={22} strokeWidth={location.pathname === '/' ? 2.5 : 2} className="transition-transform group-active:scale-90" />
                </div>
                </button>
                
                <button 
                onClick={() => navigate('/search')} 
                className={`flex flex-col items-center justify-center w-full space-y-1 group ${isActiveMobile('/search')}`}
                >
                <div className={`p-1.5 rounded-full transition-all duration-300 ${location.pathname === '/search' ? 'bg-blue-50/50' : 'bg-transparent'}`}>
                    <Search size={22} strokeWidth={location.pathname === '/search' ? 2.5 : 2} className="transition-transform group-active:scale-90" />
                </div>
                </button>
                
                <button 
                onClick={() => navigate('/orders')} 
                className={`flex flex-col items-center justify-center w-full space-y-1 group ${isActiveMobile('/orders')}`}
                >
                <div className={`p-1.5 rounded-full transition-all duration-300 ${location.pathname === '/orders' ? 'bg-blue-50/50' : 'bg-transparent'}`}>
                    <ShoppingBag size={22} strokeWidth={location.pathname === '/orders' ? 2.5 : 2} className="transition-transform group-active:scale-90" />
                </div>
                </button>
                
                {/* Dynamic 4th Button Mobile */}
                {showExecution ? (
                    <button 
                    onClick={() => navigate('/execution')} 
                    className={`flex flex-col items-center justify-center w-full space-y-1 group ${isActiveMobile('/execution')}`}
                    >
                    <div className={`p-1.5 rounded-full transition-all duration-300 ${location.pathname === '/execution' ? 'bg-blue-50/50' : 'bg-transparent'}`}>
                        <CalendarCheck size={22} strokeWidth={location.pathname === '/execution' ? 2.5 : 2} className="transition-transform group-active:scale-90" />
                    </div>
                    </button>
                ) : (
                    <button 
                    onClick={() => navigate('/profile')} 
                    className={`flex flex-col items-center justify-center w-full space-y-1 group ${isActiveMobile('/profile')}`}
                    >
                    <div className={`p-1.5 rounded-full transition-all duration-300 ${location.pathname === '/profile' ? 'bg-blue-50/50' : 'bg-transparent'}`}>
                        <User size={22} strokeWidth={location.pathname === '/profile' ? 2.5 : 2} className="transition-transform group-active:scale-90" />
                    </div>
                    </button>
                )}
            </div>
            </nav>
        </div>
      )}
    </div>
  );
};

export default Layout;
