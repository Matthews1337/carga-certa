import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  CHAVE_TEMA,
  CONSULTA_ESCURO,
  lerTema,
  resolverTema,
  type Tema,
  type TemaResolvido,
} from '@/tema/tema';

interface ContextoTema {
  /** A escolha do usuario, que pode ser 'sistema'. */
  tema: Tema;
  /** O tema que esta na tela agora, com 'sistema' ja resolvido. */
  resolvido: TemaResolvido;
  definirTema: (tema: Tema) => void;
}

const TemaContext = createContext<ContextoTema | null>(null);

export function TemaProvider({ children }: { children: ReactNode }) {
  // O script inline do index.html ja aplicou a classe antes do primeiro paint;
  // aqui so recuperamos a mesma decisao para o estado do React.
  const [tema, setTema] = useState<Tema>(() => lerTema(lerGuardado()));
  const [preferenciaSistema, setPreferenciaSistema] = useState<TemaResolvido>(prefereEscuro);

  // O sistema troca de tema sozinho ao anoitecer em boa parte dos aparelhos. Sem
  // este listener, quem esta em 'sistema' so veria a mudanca no proximo F5 -
  // justamente na hora em que a tela clara ofusca dentro da cabine.
  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_ESCURO);
    const aoMudar = (evento: MediaQueryListEvent) => {
      setPreferenciaSistema(evento.matches ? 'escuro' : 'claro');
    };

    consulta.addEventListener('change', aoMudar);
    return () => consulta.removeEventListener('change', aoMudar);
  }, []);

  const resolvido = resolverTema(tema, preferenciaSistema);

  useEffect(() => {
    // A classe vai no <html>, e nao no <body>: a variante do Tailwind e
    // `&:is(.dark *)`, entao precisa de um ancestral, e `color-scheme` no
    // :root e o que faz barra de rolagem e campo nativo acompanharem.
    document.documentElement.classList.toggle('dark', resolvido === 'escuro');
  }, [resolvido]);

  const definirTema = useCallback((novo: Tema) => {
    setTema(novo);
    // Navegacao anonima e cookie bloqueado derrubam o localStorage. A escolha
    // vale so para a sessao nesse caso, mas o app nao pode quebrar por isso.
    try {
      window.localStorage.setItem(CHAVE_TEMA, novo);
    } catch {
      /* sem persistencia disponivel */
    }
  }, []);

  const valor = useMemo<ContextoTema>(
    () => ({ tema, resolvido, definirTema }),
    [tema, resolvido, definirTema],
  );

  return <TemaContext value={valor}>{children}</TemaContext>;
}

export function useTema(): ContextoTema {
  const ctx = use(TemaContext);
  if (!ctx) throw new Error('useTema precisa estar dentro de <TemaProvider>');
  return ctx;
}

function lerGuardado(): string | null {
  try {
    return window.localStorage.getItem(CHAVE_TEMA);
  } catch {
    return null;
  }
}

function prefereEscuro(): TemaResolvido {
  return window.matchMedia(CONSULTA_ESCURO).matches ? 'escuro' : 'claro';
}
