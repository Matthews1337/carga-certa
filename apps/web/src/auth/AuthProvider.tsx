import type { Session, User } from '@supabase/supabase-js';
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

interface ContextoAuth {
  session: Session | null;
  user: User | null;
  /** True ate a sessao guardada no navegador ser recuperada. */
  carregando: boolean;
  sair: () => Promise<void>;
}

const AuthContext = createContext<ContextoAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    // A sessao vive no localStorage. Sem esta leitura inicial, um F5 jogaria o
    // usuario de volta para o login antes de o onAuthStateChange responder.
    void supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      setSession(data.session);
      setCarregando(false);
    });

    const { data: inscricao } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSession(novaSessao);
      setCarregando(false);
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
      sair: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, carregando],
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
