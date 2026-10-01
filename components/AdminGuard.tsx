import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Loader2 } from 'lucide-react';

interface AdminGuardProps {
  children: React.ReactNode;
}

const SUPER_ADMIN_EMAILS = [
  'peboorba@gmail.com',
  'joubertlima@gmail.com',
  'telmo.mateus@gmail.com',
  'cainhomo57@gmail.com',
  'caio@gmail.com'
];

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

        // Se o usuário autenticado for peboorba@gmail.com, concede acesso direto como Super Admin Canônico
        if (isCanonicalSuperAdmin) {
          if (isMounted) {
            setIsAuthenticated(true);
            setIsAuthorized(true);
            setLoading(false);
          }
          return;
        }

        // Caso contrário, busca na tabela users com fallback caso a coluna is_super_admin ainda não exista
        let userData: any = null;
        const { data: primaryData, error: primaryErr } = await supabase
          .from('users')
          .select('tipo, email')
          .eq('uuid', session.user.id)
          .maybeSingle();

        if (primaryErr) {
          console.warn('Erro ao consultar tipo/email de usuário:', primaryErr);
        } else {
          userData = primaryData;
        }

        const roleRaw = userData?.tipo || '';
        const normRole = roleRaw
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim();

        const dbUserEmail = (userData?.email || userEmail).toLowerCase().trim();
        const hasAccess = SUPER_ADMIN_EMAILS.includes(dbUserEmail) || normRole === 'gestor' || normRole === 'admin' || normRole === 'super_admin';

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
