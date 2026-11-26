import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { CAMINHO_NOVA_SENHA } from '@/auth/PedirLinkDeSenha';

/**
 * Leva para a tela da senha nova quem chegou pelo link de redefinicao em outro
 * endereco.
 *
 * Acontece quando o endereco de `redirectTo` nao esta na lista de Redirect URLs
 * do painel: o Supabase manda para o Site URL, a raiz do app, e o link - que ja
 * entra logado - deixaria a pessoa nas Despesas sem pedir a senha nova.
 */
export function DesvioDaRecuperacao() {
  const { recuperandoSenha } = useAuth();
  const { pathname } = useLocation();

  if (recuperandoSenha && pathname !== CAMINHO_NOVA_SENHA) {
    return <Navigate to={CAMINHO_NOVA_SENHA} replace />;
  }
  return null;
}
