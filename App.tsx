
import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Session } from '@supabase/supabase-js';
import Layout from './components/Layout';
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
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
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

        {/* Protected Routes: Require Session */}
        <Route
          path="/*"
          element={
            session ? (
              <Layout>
                <Routes>
                  {/* Internal Dashboard Home */}
                  <Route path="/home" element={<Home />} />
                  
                  <Route path="/search" element={<Search />} />
                  <Route path="/category/:id" element={<SubCategory />} />
                  <Route path="/professionals/:serviceId" element={<ProfessionalList />} />
                  <Route path="/professional/:uuid" element={<ProfessionalProfile />} />
                  <Route path="/request/:serviceId" element={<Planning />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/execution" element={<Execution />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/chamados" element={<Chamados />} />
                  <Route path="/orders" element={<ClientOrders />} />
                  
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
