import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Loader2 } from 'lucide-react';

interface AdminGuardProps {
  children: React.ReactNode;
}

const SUPER_ADMIN_EMAILS = ['peboorba@gmail.com'];

export const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkAdminAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session || !session.user) {
          if (isMounted) {
            setIsAuthenticated(false);
            setIsAuthorized(false);
            setLoading(false);
          }
          return;
        }

        const userEmail = (session.user.email || '').toLowerCase().trim();
        const isCanonicalSuperAdmin = SUPER_ADMIN_EMAILS.includes(userEmail);

        const { data, error } = await supabase
          .from('users')
          .select('tipo, is_super_admin, email')
          .eq('uuid', session.user.id)
          .maybeSingle();

        if (error) {
          console.error('Erro ao verificar permissões de admin:', error);
        }

        const roleRaw = data?.tipo || '';
        const normRole = roleRaw
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim();

        const dbUserEmail = (data?.email || userEmail).toLowerCase().trim();
        const isSuperAdminUser = (data?.is_super_admin === true || normRole === 'super_admin') && SUPER_ADMIN_EMAILS.includes(dbUserEmail);

        // Acesso ao portal /admin restrito ao Super Admin autorizado (peboorba@gmail.com) ou gestores autorizados
        const hasAccess = isCanonicalSuperAdmin || isSuperAdminUser || normRole === 'gestor' || normRole === 'admin';

        if (isMounted) {
          setIsAuthenticated(true);
          setIsAuthorized(hasAccess);
          setLoading(false);
        }
      } catch (err) {
        console.error('Falha na validação de permissões administrativas:', err);
        if (isMounted) {
          setIsAuthorized(false);
          setLoading(false);
        }
      }
    };

    checkAdminAccess();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        if (isMounted) {
          setIsAuthenticated(false);
          setIsAuthorized(false);
          setLoading(false);
        }
      } else {
        checkAdminAccess();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-3">
        <Loader2 className="animate-spin text-blue-500" size={36} />
        <p className="text-xs text-slate-400 font-medium tracking-wide">Validando credenciais administrativas...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAuthorized) {
    // Redireciona usuários sem permissão (ex: consumidores e prestadores) para o fluxo principal
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
};

export default AdminGuard;
