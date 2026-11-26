import type { Session, User } from '@supabase/supabase-js';
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

interface ContextoAuth {
  session: Session | null;
  user: User | null;
  /** True ate a sessao guardada no navegador ser recuperada. */
  carregando: boolean;
  /**
   * True entre a chegada pelo link de redefinicao e a senha nova ser gravada.
   * O link ja entra com sessao, e sem esta marca o app trataria a pessoa como
   * logada e a levaria para as Despesas sem nunca pedir a senha nova.
   */
  recuperandoSenha: boolean;
  sair: () => Promise<void>;
}

const AuthContext = createContext<ContextoAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [recuperandoSenha, setRecuperandoSenha] = useState(false);

  useEffect(() => {
    let ativo = true;

    // A sessao vive no localStorage. Sem esta leitura inicial, um F5 jogaria o
    // usuario de volta para o login antes de o onAuthStateChange responder.
    void supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      setSession(data.session);
      setCarregando(false);
    });

    const { data: inscricao } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      setSession(novaSessao);
      setCarregando(false);
      // O supabase-js le o link do e-mail ao iniciar e avisa com este evento
      // depois de gravar a sessao - a inscricao acima ja existe nessa hora.
      if (evento === 'PASSWORD_RECOVERY') setRecuperandoSenha(true);
      if (evento === 'USER_UPDATED' || evento === 'SIGNED_OUT') setRecuperandoSenha(false);
    });

    return () => {
      ativo = false;
      inscricao.subscription.unsubscribe();
    };
  }, []);

  const valor = useMemo<ContextoAuth>(
    () => ({
      session,
      user: session?.user ?? null,
      carregando,
      recuperandoSenha,
      sair: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, carregando, recuperandoSenha],
  );

  return <AuthContext value={valor}>{children}</AuthContext>;
}

export function useAuth(): ContextoAuth {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}

/**
 * Id do usuario logado. Usado para montar o caminho do comprovante no Storage,
 * cuja policy compara o primeiro segmento da pasta com auth.uid().
 */
export function usePilotoId(): string {
  const { user } = useAuth();
  if (!user) throw new Error('usePilotoId chamado fora de uma rota protegida');
  return user.id;
}
