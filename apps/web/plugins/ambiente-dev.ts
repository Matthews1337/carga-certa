import type { Plugin } from 'vite';

/**
 * Avisos no terminal do `pnpm dev` sobre o banco em uso.
 *
 * O dev existe para testar sem medo, contra o Supabase local do Docker. Dois
 * jeitos de isso dar errado sem ninguem perceber, e o que este plugin diz em
 * cada um:
 *
 *   - O Docker esta parado. Sem aviso, o sintoma seria so erro de rede no
 *     console do navegador, longe da causa.
 *   - O dev foi apontado para um banco remoto (por um .env.development.local).
 *     Sem aviso, testar "de brincadeira" apagaria despesa de verdade.
 *
 * So avisa, nunca bloqueia: apontar para outro banco pode ser intencional.
 */

const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function ehHostLocal(url: string): boolean {
  try {
    return HOSTS_LOCAIS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * true se o servidor respondeu qualquer coisa - ate um 401 prova que ele esta
 * de pe. false so quando nem a conexao abriu.
 */
export async function supabaseResponde(
  url: string,
  anonKey: string | undefined,
  timeoutMs = 2000,
): Promise<boolean> {
  try {
    await fetch(`${new URL(url).origin}/auth/v1/health`, {
      headers: anonKey ? { apikey: anonKey } : {},
      signal: AbortSignal.timeout(timeoutMs),
    });
    return true;
  } catch {
    return false;
  }
}

export function avisosDoDev({
  urlSupabase,
  anonKey,
}: {
  urlSupabase: string | undefined;
  anonKey: string | undefined;
}): Plugin {
  return {
    name: 'carga-certa:avisos-do-dev',
    apply: 'serve',

    configureServer(servidor) {
      // O Vitest tambem sobe um servidor do Vite; teste nao precisa de banco.
      if (process.env.VITEST || !urlSupabase) return;
      const log = servidor.config.logger;

      if (!ehHostLocal(urlSupabase)) {
        log.warn(
          [
            '',
            `  ATENÇÃO: o dev está usando um banco REMOTO (${urlSupabase}).`,
            '  Tudo o que você criar, editar ou excluir aqui altera dados reais.',
            '  Para voltar ao banco do Docker, apague apps/web/.env.development.local.',
            '',
          ].join('\n'),
        );
        return;
      }

      // Nao segura a subida do servidor: a checagem roda em paralelo.
      void supabaseResponde(urlSupabase, anonKey).then((responde) => {
        if (responde) {
          log.info(`  Banco: Supabase local do Docker (${urlSupabase})`);
          return;
        }
        log.warn(
          [
            '',
            `  O Supabase local não está respondendo em ${urlSupabase}.`,
            '  Abra o Docker Desktop e rode, na raiz do projeto:',
            '    corepack pnpm db:start',
            '  Sem isso, o login e todas as telas vão falhar.',
            '',
          ].join('\n'),
        );
      });
    },
  };
}
