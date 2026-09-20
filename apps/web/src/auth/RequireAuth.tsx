import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { Carregando } from '@/components/ui/feedback';

export function RequireAuth() {
  const { session, carregando } = useAuth();
  const local = useLocation();

  // Sem esta espera, o F5 numa rota interna piscaria a tela de login antes de a
  // sessao do localStorage ser lida.
  if (carregando) return <Carregando texto="Verificando sessao..." />;

  if (!session) {
    // `state` guarda para onde o usuario queria ir, para voltar apos o login.
    return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  }

  return <Outlet />;
}
