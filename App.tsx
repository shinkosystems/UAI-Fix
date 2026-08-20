
import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Session } from '@supabase/supabase-js';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import AdminGuard from './components/AdminGuard';
import Home from './pages/Home';
import Search from './pages/Search';
import SubCategory from './pages/SubCategory';
import ProfessionalList from './pages/ProfessionalList';
import ProfessionalProfile from './pages/ProfessionalProfile';
import Planning from './pages/Planning';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Chamados from './pages/Chamados';
import ClientOrders from './pages/ClientOrders';
import CalendarPage from './pages/Calendar';
import Execution from './pages/Execution';
import LandingPage from './pages/LandingPage';
import Whatsapp from './pages/Whatsapp';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminChamados from './pages/admin/AdminChamados';
import AdminUsers from './pages/admin/AdminUsers';
import AdminRelatorios from './pages/admin/AdminRelatorios';
import AdminImportOrcamentos from './pages/admin/AdminImportOrcamentos';
import AdminLinks from './pages/admin/AdminLinks';
import AdminFluxoServico from './pages/admin/AdminFluxoServico';
import { Loader2 } from 'lucide-react';
import { initTrackingCapture } from './utils/tracking';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Inicializa a captura de parâmetros de aquisição e UTMs da URL/Referrer
    initTrackingCapture();

    const checkInactivity = async () => {
      const lastAccess = localStorage.getItem('last_access');
      if (lastAccess) {
        const lastAccessTime = parseInt(lastAccess);
        const twentyFourHours = 24 * 60 * 60 * 1000;

        if (Date.now() - lastAccessTime > twentyFourHours) {
          await supabase.auth.signOut();
          localStorage.removeItem('last_access');
          return true;
        }
      }
      return false;
    };

    const initAuth = async () => {
      const loggedOut = await checkInactivity();
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (!loggedOut && currentSession) {
        localStorage.setItem('last_access', Date.now().toString());
      }

      setSession(currentSession);
      setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        localStorage.setItem('last_access', Date.now().toString());
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ios-bg">
        <Loader2 className="animate-spin text-ios-blue" size={32} />
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/"
          element={!session ? <LandingPage /> : <Navigate to="/home" replace />}
        />
        <Route
          path="/login"
          element={!session ? <Login /> : <Navigate to="/home" replace />}
        />

        {/* Admin Portal Protected Routes (Requer perfil de Gestor/Admin) */}
        <Route
          path="/admin/*"
          element={
            <AdminGuard>
              <AdminLayout>
                <Routes>
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="fluxo" element={<AdminFluxoServico />} />
                  <Route path="chamados" element={<AdminChamados />} />
                  <Route path="relatorios" element={<AdminRelatorios />} />
                  <Route path="links" element={<AdminLinks />} />
                  <Route path="importar-orcamentos" element={<AdminImportOrcamentos />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="whatsapp" element={<Whatsapp />} />
                  <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
                </Routes>
              </AdminLayout>
            </AdminGuard>
          }
        />

        {/* Protected Routes: Require Session */}
        <Route
          path="/*"
          element={
            session ? (
              <Layout>
                <Routes>
                  {/* Internal Dashboard Home */}
                  <Route path="home" element={<Home />} />

                  <Route path="search" element={<Search />} />
                  <Route path="category/:id" element={<SubCategory />} />
                  <Route path="professionals/:serviceId" element={<ProfessionalList />} />
                  <Route path="professional/:uuid" element={<ProfessionalProfile />} />
                  <Route path="request/:serviceId" element={<Planning />} />
                  <Route path="calendar" element={<CalendarPage />} />
                  <Route path="execution" element={<Execution />} />
                  <Route path="profile" element={<Profile />} />
                  <Route 
                    path="settings" 
                    element={
                      <AdminGuard>
                        <Settings />
                      </AdminGuard>
                    } 
                  />
                  <Route path="chamados" element={<Chamados />} />
                  <Route path="orders" element={<ClientOrders />} />
                  <Route path="fluxo" element={<AdminFluxoServico />} />

                  {/* Redirect catch-all for authenticated users */}
                  <Route path="*" element={<Navigate to="/home" replace />} />
                </Routes>
              </Layout>
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
      </Routes>
    </HashRouter>
  );
};

export default App;
