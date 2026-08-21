import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, ClipboardList, Users, Settings, LogOut, 
  ChevronRight, Shield, Menu, X, ArrowLeft, Bell, Sparkles, MessageSquare, BarChart3, FileSpreadsheet, Link2, GitFork, Layers
} from 'lucide-react';
import { supabase } from '../supabaseClient';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const verifyAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }
      const { data } = await supabase
        .from('users')
        .select('tipo')
        .eq('uuid', session.user.id)
        .maybeSingle();

      const normRole = (data?.tipo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      if (normRole !== 'gestor' && normRole !== 'admin') {
        navigate('/home', { replace: true });
      }
    };
    verifyAccess();
  }, [navigate]);

  const isActive = (path: string) => {
    return location.pathname === path
      ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-500/20'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium';
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800">

      {/* Top Mobile Bar */}
      <div className="md:hidden bg-slate-900 text-white px-5 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-white p-0.5 shadow-sm">
            <img src="/logo.jpg" alt="UAI Fix Admin" className="w-full h-full object-cover rounded-lg" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              UAI Fix <span className="bg-blue-500 text-white text-[10px] uppercase font-black px-1.5 py-0.5 rounded">Admin</span>
            </h1>
          </div>
        </div>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-slate-300 hover:text-white bg-slate-800 rounded-lg"
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar Desktop & Mobile Drawer */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white flex flex-col justify-between p-5 transition-transform duration-300 transform shadow-xl md:shadow-none flex-shrink-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="space-y-6">
          
          {/* Header Logo */}
          <div className="hidden md:flex items-center space-x-3 pb-5 border-b border-slate-800">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white p-0.5 shadow-sm flex-shrink-0">
              <img src="/logo.jpg" alt="UAI Fix Admin" className="w-full h-full object-cover rounded-lg" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                UAI Fix
                <span className="bg-blue-500 text-white text-[9px] uppercase font-black px-1.5 py-0.5 rounded tracking-wider">Admin</span>
              </h1>
              <p className="text-xs text-slate-400">Painel de Gestão</p>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1 pt-1">
            <p className="px-3 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider mb-2">Visão Geral & Operação</p>

            <button
              onClick={() => { navigate('/admin/dashboard'); setIsSidebarOpen(false); }}
              className={`w-full h-11 flex items-center justify-between px-3.5 rounded-xl transition-all ${isActive('/admin/dashboard')}`}
            >
              <div className="flex items-center space-x-3 truncate">
                <LayoutDashboard size={18} className="flex-shrink-0" />
                <span className="text-xs font-bold tracking-tight whitespace-nowrap">Dashboard</span>
              </div>
              <ChevronRight size={14} className="opacity-50 flex-shrink-0" />
            </button>

            <button
              onClick={() => { navigate('/admin/fluxo'); setIsSidebarOpen(false); }}
              className={`w-full h-11 flex items-center justify-between px-3.5 rounded-xl transition-all ${isActive('/admin/fluxo')}`}
            >
              <div className="flex items-center space-x-3 truncate">
                <GitFork size={18} className="flex-shrink-0" />
                <span className="text-xs font-bold tracking-tight whitespace-nowrap">Fluxo do Serviço</span>
              </div>
              <ChevronRight size={14} className="opacity-50 flex-shrink-0" />
            </button>

            <button
              onClick={() => { navigate('/admin/chamados'); setIsSidebarOpen(false); }}
              className={`w-full h-11 flex items-center justify-between px-3.5 rounded-xl transition-all ${isActive('/admin/chamados')}`}
            >
              <div className="flex items-center space-x-3 truncate">
                <ClipboardList size={18} className="flex-shrink-0" />
                <span className="text-xs font-bold tracking-tight whitespace-nowrap">Gestão de Chamados</span>
              </div>
              <ChevronRight size={14} className="opacity-50 flex-shrink-0" />
            </button>

            <button
              onClick={() => { navigate('/admin/atividades'); setIsSidebarOpen(false); }}
              className={`w-full h-11 flex items-center justify-between px-3.5 rounded-xl transition-all ${isActive('/admin/atividades')}`}
            >
              <div className="flex items-center space-x-3 truncate">
                <Layers size={18} className="flex-shrink-0" />
                <span className="text-xs font-bold tracking-tight whitespace-nowrap">Atividades & Serviços</span>
              </div>
              <ChevronRight size={14} className="opacity-50 flex-shrink-0" />
            </button>

            <button
              onClick={() => { navigate('/admin/users'); setIsSidebarOpen(false); }}
              className={`w-full h-11 flex items-center justify-between px-3.5 rounded-xl transition-all ${isActive('/admin/users')}`}
            >
              <div className="flex items-center space-x-3 truncate">
                <Users size={18} className="flex-shrink-0" />
                <span className="text-xs font-bold tracking-tight whitespace-nowrap">Usuários & Profissionais</span>
              </div>
              <ChevronRight size={14} className="opacity-50 flex-shrink-0" />
            </button>

            <p className="px-3 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider mb-2 pt-4">Inteligência & Marketing</p>

            <button
              onClick={() => { navigate('/admin/relatorios'); setIsSidebarOpen(false); }}
              className={`w-full h-11 flex items-center justify-between px-3.5 rounded-xl transition-all ${isActive('/admin/relatorios')}`}
            >
              <div className="flex items-center space-x-3 truncate">
                <BarChart3 size={18} className="flex-shrink-0" />
                <span className="text-xs font-bold tracking-tight whitespace-nowrap">Relatórios & Desempenho</span>
              </div>
              <ChevronRight size={14} className="opacity-50 flex-shrink-0" />
            </button>

            <button
              onClick={() => { navigate('/admin/links'); setIsSidebarOpen(false); }}
              className={`w-full h-11 flex items-center justify-between px-3.5 rounded-xl transition-all ${isActive('/admin/links')}`}
            >
              <div className="flex items-center space-x-3 truncate">
                <Link2 size={18} className="flex-shrink-0" />
                <span className="text-xs font-bold tracking-tight whitespace-nowrap">Gerador de Links / UTMs</span>
              </div>
              <ChevronRight size={14} className="opacity-50 flex-shrink-0" />
            </button>

            <button
              onClick={() => { navigate('/admin/importar-orcamentos'); setIsSidebarOpen(false); }}
              className={`w-full h-11 flex items-center justify-between px-3.5 rounded-xl transition-all ${isActive('/admin/importar-orcamentos')}`}
            >
              <div className="flex items-center space-x-3 truncate">
                <FileSpreadsheet size={18} className="flex-shrink-0" />
                <span className="text-xs font-bold tracking-tight whitespace-nowrap">Importar Orçamentos</span>
              </div>
              <ChevronRight size={14} className="opacity-50 flex-shrink-0" />
            </button>

            <button
              onClick={() => { navigate('/admin/whatsapp'); setIsSidebarOpen(false); }}
              className={`w-full h-11 flex items-center justify-between px-3.5 rounded-xl transition-all ${isActive('/admin/whatsapp')}`}
            >
              <div className="flex items-center space-x-3 truncate">
                <MessageSquare size={18} className="flex-shrink-0" />
                <span className="text-xs font-bold tracking-tight whitespace-nowrap">WhatsApp / Atendimento</span>
              </div>
              <ChevronRight size={14} className="opacity-50 flex-shrink-0" />
            </button>

            <button
              onClick={() => { navigate('/admin/whatsapp-config'); setIsSidebarOpen(false); }}
              className={`w-full h-11 flex items-center justify-between px-3.5 rounded-xl transition-all ${isActive('/admin/whatsapp-config')}`}
            >
              <div className="flex items-center space-x-3 truncate">
                <Settings size={18} className="flex-shrink-0" />
                <span className="text-xs font-bold tracking-tight whitespace-nowrap">Configurações WhatsApp</span>
              </div>
              <ChevronRight size={14} className="opacity-50 flex-shrink-0" />
            </button>

            <p className="px-3 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider mb-2 pt-4">Navegação Geral</p>

            <button
              onClick={() => { navigate('/home'); setIsSidebarOpen(false); }}
              className="w-full h-11 flex items-center space-x-3 px-3.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all text-xs font-bold"
            >
              <ArrowLeft size={18} className="flex-shrink-0" />
              <span className="whitespace-nowrap">Voltar ao App Usuário</span>
            </button>
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="pt-5 border-t border-slate-800 space-y-2.5">
          <div className="flex items-center space-x-3 px-3 py-2 bg-slate-800/60 rounded-xl">
            <Shield size={18} className="text-blue-400 flex-shrink-0" />
            <div className="truncate">
              <p className="text-xs font-bold text-slate-200">Sessão Segura</p>
              <p className="text-[10px] text-slate-400 truncate">Administrador do Sistema</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-all text-sm font-medium"
          >
            <LogOut size={18} />
            <span>Sair do Painel</span>
          </button>
        </div>
      </aside>

      {/* Main Content Container */}
      <main className="flex-1 overflow-y-auto">
        <header className="hidden md:flex bg-white border-b border-slate-200 px-8 py-4 items-center justify-between shadow-xs">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Painel Administrativo UAI Fix</h2>
            <p className="text-xs text-slate-500">Gestão centralizada de chamados, usuários e indicadores de desempenho</p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Sistema Operacional
            </span>
          </div>
        </header>

        <div className="p-4 sm:p-6 md:p-8">
          {children}
        </div>
      </main>

    </div>
  );
};

export default AdminLayout;
