import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, ClipboardList, Users, Settings, LogOut, 
  ChevronRight, Shield, Menu, X, ArrowLeft, Bell, Sparkles, MessageSquare, BarChart3, FileSpreadsheet, Link2, GitFork, Layers, Building2
} from 'lucide-react';
import { supabase } from '../supabaseClient';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export type AdminViewMode = 'super_admin' | 'tenant_admin';

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState<string>('');
  const [isActualSuperAdmin, setIsActualSuperAdmin] = useState<boolean>(false);

  // Modo de Simulação de Visão
  const [viewMode, setViewMode] = useState<AdminViewMode>(() => {
    return (localStorage.getItem('uai_admin_view_mode') as AdminViewMode) || 'super_admin';
  });

  const [simulatedOrgId, setSimulatedOrgId] = useState<string>(() => {
    return localStorage.getItem('uai_active_simulated_org_id') || '';
  });

  const SUPER_ADMIN_EMAILS = [
    'peboorba@gmail.com',
    'joubertlima@gmail.com',
    'telmo.mateus@gmail.com',
    'cainhomo57@gmail.com',
    'caio@gmail.com'
  ];

  useEffect(() => {
    const verifyAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }

      const emailNorm = (session.user.email || '').toLowerCase().trim();
      setUserEmail(emailNorm);

      const isSuper = SUPER_ADMIN_EMAILS.includes(emailNorm);
      setIsActualSuperAdmin(isSuper);

      // Buscar lista de organizações para o switcher
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, nome, slug, plano')
        .order('nome', { ascending: true });

      if (orgs && orgs.length > 0) {
        setOrganizations(orgs);
        if (!simulatedOrgId) {
          setSimulatedOrgId(orgs[0].id);
          localStorage.setItem('uai_active_simulated_org_id', orgs[0].id);
        }
      }
    };
    verifyAccess();
  }, [navigate]);

  const handleToggleViewMode = (mode: AdminViewMode) => {
    setViewMode(mode);
    localStorage.setItem('uai_admin_view_mode', mode);

    if (mode === 'tenant_admin' && organizations.length > 0 && !simulatedOrgId) {
      setSimulatedOrgId(organizations[0].id);
      localStorage.setItem('uai_active_simulated_org_id', organizations[0].id);
      localStorage.setItem('active_tenant_filter', organizations[0].id);
    } else if (mode === 'super_admin') {
      localStorage.removeItem('active_tenant_filter');
    }

    window.dispatchEvent(new CustomEvent('admin_view_mode_changed', { 
      detail: { 
        viewMode: mode, 
        orgId: mode === 'tenant_admin' ? simulatedOrgId : null 
      } 
    }));
  };

  const handleSelectSimulatedOrg = (orgId: string) => {
    setSimulatedOrgId(orgId);
    localStorage.setItem('uai_active_simulated_org_id', orgId);
    localStorage.setItem('active_tenant_filter', orgId);

    window.dispatchEvent(new CustomEvent('admin_view_mode_changed', { 
      detail: { 
        viewMode: 'tenant_admin', 
        orgId 
      } 
    }));
  };

  const currentSimulatedOrg = organizations.find(o => o.id === simulatedOrgId);

  const isActive = (path: string) => {
    return location.pathname === path
      ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-500/20'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium';
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const isSuperAdminView = viewMode === 'super_admin';

  return (
    <div className="h-screen max-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 overflow-hidden">

      {/* Top Mobile Bar */}
      <div className="md:hidden bg-slate-900 text-white px-5 py-4 flex items-center justify-between shadow-md flex-shrink-0">
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
        fixed md:static inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white flex flex-col justify-between p-5 transition-transform duration-300 transform shadow-xl md:shadow-none flex-shrink-0 h-full overflow-y-auto
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="space-y-6">
          
          {/* Header Logo & View Mode Switcher */}
          <div className="space-y-4 pb-4 border-b border-slate-800">
            <div className="hidden md:flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-white p-0.5 shadow-sm flex-shrink-0">
                <img src="/logo.jpg" alt="UAI Fix Admin" className="w-full h-full object-cover rounded-lg" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  UAI Fix
                  <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded tracking-wider ${
                    isSuperAdminView ? 'bg-amber-500 text-slate-950' : 'bg-blue-500 text-white'
                  }`}>
                    {isSuperAdminView ? 'Super Admin' : 'Admin Comum'}
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  {isSuperAdminView ? 'Governança Global 360º' : (currentSimulatedOrg?.nome || 'Visão Empresa')}
                </p>
              </div>
            </div>

            {/* SWITCHER DE VISÃO: SUPER ADMIN vs ADMIN COMUM */}
            <div className="bg-slate-950/80 p-1 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex items-center text-[10px] font-bold text-slate-400 px-2 pt-1">
                <span>Modo de Visualização:</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => handleToggleViewMode('super_admin')}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1 ${
                    isSuperAdminView 
                      ? 'bg-amber-500 text-slate-950 shadow-xs' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <span>👑</span> Super Admin
                </button>
                <button
                  onClick={() => handleToggleViewMode('tenant_admin')}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1 ${
                    !isSuperAdminView 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <span>🏢</span> Admin Comum
                </button>
              </div>

              {/* Seletor de Empresa para simulação */}
              {!isSuperAdminView && organizations.length > 0 && (
                <div className="pt-1.5 px-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Simulando Empresa:
                  </label>
                  <select
                    value={simulatedOrgId}
                    onChange={(e) => handleSelectSimulatedOrg(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                  >
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>
                        {org.nome} ({org.slug})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1 pt-1">
            <p className="px-3 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider mb-2">
              {isSuperAdminView ? 'Visão Geral & Operação Global' : 'Operação da Empresa'}
            </p>

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

            {/* Módulo Organizações (Exclusivo Super Admin) */}
            {isSuperAdminView && (
              <button
                onClick={() => { navigate('/admin/organizations'); setIsSidebarOpen(false); }}
                className={`w-full h-11 flex items-center justify-between px-3.5 rounded-xl transition-all ${isActive('/admin/organizations')}`}
              >
                <div className="flex items-center space-x-3 truncate">
                  <Building2 size={18} className="flex-shrink-0 text-amber-500" />
                  <span className="text-xs font-bold tracking-tight whitespace-nowrap">Organizações & Empresas</span>
                </div>
                <ChevronRight size={14} className="opacity-50 flex-shrink-0" />
              </button>
            )}

            <button
              onClick={() => { navigate('/admin/chamados'); setIsSidebarOpen(false); }}
              className={`w-full h-11 flex items-center justify-between px-3.5 rounded-xl transition-all ${isActive('/admin/chamados')}`}
            >
              <div className="flex items-center space-x-3 truncate">
                <ClipboardList size={18} className="flex-shrink-0" />
                <span className="text-xs font-bold tracking-tight whitespace-nowrap">
                  {isSuperAdminView ? 'Central de Chamados (Todos)' : 'Chamados da Empresa'}
                </span>
              </div>
              <ChevronRight size={14} className="opacity-50 flex-shrink-0" />
            </button>

            <button
              onClick={() => { navigate('/admin/users'); setIsSidebarOpen(false); }}
              className={`w-full h-11 flex items-center justify-between px-3.5 rounded-xl transition-all ${isActive('/admin/users')}`}
            >
              <div className="flex items-center space-x-3 truncate">
                <Users size={18} className="flex-shrink-0" />
                <span className="text-xs font-bold tracking-tight whitespace-nowrap">
                  {isSuperAdminView ? 'Usuários & Profissionais' : 'Equipe da Empresa'}
                </span>
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

            {isSuperAdminView && (
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
            )}

            {/* Seção Inteligência & Marketing (Exclusivo Super Admin) */}
            {isSuperAdminView && (
              <>
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
              </>
            )}

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
            <Shield size={18} className={isSuperAdminView ? 'text-amber-400' : 'text-blue-400'} />
            <div className="truncate">
              <p className="text-xs font-bold text-slate-200 truncate">
                {isSuperAdminView ? '👑 Super Admin' : '🏢 Admin Comum'}
              </p>
              <p className="text-[10px] text-slate-400 truncate">{userEmail || 'Sessão Ativa'}</p>
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
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* BANNER FLUTUANTE DE SIMULAÇÃO (QUANDO EM MODO ADMIN COMUM) */}
        {!isSuperAdminView && (
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between shadow-md text-xs font-bold flex-shrink-0 gap-2 border-b border-blue-400/30 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-center sm:text-left">
              <span className="px-2 py-0.5 bg-white text-blue-900 rounded text-[10px] font-black uppercase tracking-wider shadow-xs">
                Modo Simulação
              </span>
              <span>Visualizando painel como <b>Admin Comum</b> da empresa: <u className="decoration-amber-300">{currentSimulatedOrg?.nome || 'Organização'}</u></span>
            </div>
            <button 
              onClick={() => handleToggleViewMode('super_admin')}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1"
            >
              <span>👑</span>
              <span>Voltar para Super Admin</span>
            </button>
          </div>
        )}

        <header className="hidden md:flex bg-white border-b border-slate-200 px-8 py-3.5 items-center justify-between shadow-xs flex-shrink-0">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <span>Painel Administrativo UAI Fix</span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                isSuperAdminView ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}>
                {isSuperAdminView ? 'Visão Super Admin (360º)' : `Visão Admin: ${currentSimulatedOrg?.nome || 'Tenant'}`}
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              {isSuperAdminView 
                ? 'Governança centralizada de todas as empresas parceiras, equipes e métricas globais'
                : 'Gestão operacional exclusiva dos chamados e equipe técnica da sua organização'
              }
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => handleToggleViewMode(isSuperAdminView ? 'tenant_admin' : 'super_admin')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <span>{isSuperAdminView ? '🏢 Simular Admin Comum' : '👑 Ver como Super Admin'}</span>
            </button>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Online
            </span>
          </div>
        </header>

        <div className={`flex-1 min-h-0 ${location.pathname === '/admin/whatsapp' ? 'p-3 sm:p-4 md:p-6 flex flex-col overflow-hidden' : 'p-4 sm:p-6 md:p-8 overflow-y-auto'}`}>
          {children}
        </div>
      </main>

    </div>
  );
};

export default AdminLayout;
