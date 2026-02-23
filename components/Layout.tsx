
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
    const fetchUserType = async (user: any, retryCount = 0) => {
      if (!user) {
        setUserType(null);
        setLoadingUserType(false);
        return;
      }

      setLoadingUserType(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('tipo')
          .eq('uuid', user.id)
          .maybeSingle();
        
        if (error) {
           console.error(`Supabase error fetching user type (attempt ${retryCount + 1}):`, error.message || error);
           throw error;
        }
        
        setUserType(data?.tipo || null);
        setLoadingUserType(false);
      } catch (error: any) {
        console.error(`Error fetching user type (attempt ${retryCount + 1}):`, error.message || error);
        
        if (retryCount < 2) {
          console.log(`Retrying user type fetch in 1.5s...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          return fetchUserType(user, retryCount + 1);
        }
        
        setUserType(null);
        setLoadingUserType(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchUserType(session?.user ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      fetchUserType(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setIsDrawerOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => {
    return location.pathname === path ? 'text-ios-blue bg-blue-50' : 'text-gray-500 hover:bg-gray-100';
  };

  const isActiveMobile = (path: string) => {
    return location.pathname === path ? 'text-ios-blue' : 'text-gray-400';
  };

  const normType = userType?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
  
  const isManager = !loadingUserType && normType === 'gestor';
  
  // Regras de visibilidade de itens de menu
  const showMyOrders = !loadingUserType && (normType === 'consumidor');
  const showTicketManagement = !loadingUserType && (normType === 'gestor' || normType === 'planejista' || normType === 'orcamentista' || normType === 'profissional');
  const showAgenda = !loadingUserType && normType !== '' && normType !== 'consumidor';
  const showSearch = !loadingUserType && (normType === 'consumidor');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen w-full bg-[#F2F4F8] overflow-hidden">
      
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
          md:static md:translate-x-0 md:z-30 md:w-64
          ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
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
              <p className="text-xs text-gray-400 font-medium capitalize">{userType || 'Usuário'}</p>
            </div>
          </div>
          <button 
            onClick={() => setIsDrawerOpen(false)}
            className="md:hidden p-2 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto no-scrollbar">
          <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-4">Menu Principal</p>
          
          <button 
            onClick={() => navigate('/home')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium ${isActive('/home')}`}
          >
            <Home size={20} />
            <span>Início</span>
          </button>

          {showSearch && (
            <button 
              onClick={() => navigate('/search')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium ${isActive('/search')}`}
            >
              <Search size={20} />
              <span>Buscar Serviços</span>
            </button>
          )}

          {showMyOrders && (
            <button 
              onClick={() => navigate('/orders')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium ${isActive('/orders')}`}
            >
              <ShoppingBag size={20} />
              <span>Meus Pedidos</span>
            </button>
          )}

          {showAgenda && (
            <button 
              onClick={() => navigate('/calendar')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium ${isActive('/calendar')}`}
            >
              <CalendarCheck size={20} />
              <span>Agenda</span>
            </button>
          )}

          <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-8">Conta</p>
          
          <button 
            onClick={() => navigate('/profile')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium ${isActive('/profile')}`}
          >
            <User size={20} />
            <span>Meu Perfil</span>
          </button>

          {showTicketManagement && (
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
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all font-medium"
          >
            <LogOut size={20} />
            <span>Sair da Conta</span>
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {children}
        </div>

        {/* --- MOBILE BOTTOM TAB BAR --- */}
        <nav className="md:hidden flex items-center justify-around bg-white/80 backdrop-blur-xl border-t border-gray-200 px-2 py-3 pb-8 shrink-0">
          <button onClick={() => navigate('/home')} className={`flex flex-col items-center space-y-1 ${isActiveMobile('/home')}`}>
            <Home size={22} />
            <span className="text-[10px] font-bold uppercase tracking-tight">Início</span>
          </button>
          
          {showSearch && (
            <button onClick={() => navigate('/search')} className={`flex flex-col items-center space-y-1 ${isActiveMobile('/search')}`}>
              <Search size={22} />
              <span className="text-[10px] font-bold uppercase tracking-tight">Buscar</span>
            </button>
          )}
          
          {showAgenda ? (
            <button onClick={() => navigate('/calendar')} className={`flex flex-col items-center space-y-1 ${isActiveMobile('/calendar')}`}>
              <Calendar size={22} />
              <span className="text-[10px] font-bold uppercase tracking-tight">Agenda</span>
            </button>
          ) : showMyOrders && (
            <button onClick={() => navigate('/orders')} className={`flex flex-col items-center space-y-1 ${isActiveMobile('/orders')}`}>
              <ShoppingBag size={22} />
              <span className="text-[10px] font-bold uppercase tracking-tight">Pedidos</span>
            </button>
          )}

          <button onClick={() => navigate('/profile')} className={`flex flex-col items-center space-y-1 ${isActiveMobile('/profile')}`}>
            <User size={22} />
            <span className="text-[10px] font-bold uppercase tracking-tight">Perfil</span>
          </button>
        </nav>
      </main>
    </div>
  );
};

export default Layout;
