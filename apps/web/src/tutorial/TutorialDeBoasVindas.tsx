import { useEffect } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { encerrarTour, esperarElemento, executarTour } from '@/tutorial/executar';
import { ALVO_DO_CABECALHO, TOUR_DE_BOAS_VINDAS } from '@/tutorial/passos';
import {
  chaveLocalDoTutorial,
  fimRegistradoNoAparelho,
  fimRegistradoNoServidor,
  tutorialPendente,
  type FimDoTutorial,
} from '@/tutorial/situacao';

/**
 * Abre o tutorial na primeira entrada de cada usuario, em qualquer tela.
 * Montado dentro do AppShell, entao nunca aparece no login nem na tela de
 * senha nova.
 */
export function TutorialDeBoasVindas() {
  const { user } = useAuth();
  const usuarioId = user?.id ?? null;
  const pendente = user ? tutorialPendente(user, armazenamento()) : false;
  // Marcado no aparelho, mas nao no servidor: a gravacao anterior falhou (sem
  // sinal, por exemplo). Tenta de novo, sem mostrar o tour outra vez.
  const fimParaReenviar =
    user && fimRegistradoNoServidor(user) === null
      ? fimRegistradoNoAparelho(user.id, armazenamento())
      : null;

  useEffect(() => {
    if (!usuarioId || !pendente) return;
    let cancelado = false;
    let rodando = false;

    void (async () => {
      // Espera o titulo da tela: o roteiro termina no botao "i" dele, e a
      // tela pode ser um pedaco lazy ainda baixando.
      await esperarElemento(ALVO_DO_CABECALHO, 3000);
      if (cancelado) return;
      try {
        rodando = true;
        const fim = await executarTour(TOUR_DE_BOAS_VINDAS, { comPular: true });
        rodando = false;
        await registrar(usuarioId, fim);
      } catch {
        // Sem rede para baixar o pedaco do tour: tenta na proxima entrada.
        rodando = false;
      }
    })();

    return () => {
      cancelado = true;
      // Saiu da conta com o tour aberto. So encerra o tour DESTE efeito: um
      // tour do botao "i" aberto depois nao tem nada com isso.
      if (rodando) encerrarTour();
    };
  }, [usuarioId, pendente]);

  useEffect(() => {
    if (usuarioId && fimParaReenviar) void registrar(usuarioId, fimParaReenviar);
  }, [usuarioId, fimParaReenviar]);

  return null;
}

async function registrar(usuarioId: string, fim: FimDoTutorial): Promise<void> {
  try {
    localStorage.setItem(chaveLocalDoTutorial(usuarioId), fim);
  } catch {
    // Sem localStorage, fica so a marca do servidor.
  }
  // updateUser mescla `data` com os metadados que ja existem (o `nome` do
  // cadastro continua la). Falha de rede e silenciosa: a marca local segura
  // o tour neste aparelho, e o reenvio acima tenta de novo depois.
  await supabase.auth.updateUser({
    data: { tutorial: fim, tutorial_em: new Date().toISOString() },
  });
}

function armazenamento(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
