/**
 * Validacao das variaveis de ambiente do Supabase.
 *
 * Errar essas duas variaveis nao da erro claro. URL com caminho a mais vira um
 * 404 com codigo do PostgREST; URL sem protocolo vira "Invalid supabaseUrl"
 * dentro do bundle minificado; e a pior de todas - colar a service_role no
 * lugar da anon key - FUNCIONA, e entrega a todo visitante uma chave que
 * ignora a RLS inteira.
 *
 * Por isso roda em dois momentos:
 *   - no build (vite.config.ts), para que um deploy mal configurado falhe na
 *     Netlify com a mensagem certa, em vez de publicar um site quebrado;
 *   - na inicializacao do app, para o desenvolvimento local.
 *
 * Funcoes puras e sem import.meta.env de proposito: o vite.config.ts roda em
 * Node, antes de existir bundle, e importa este arquivo.
 */

const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '[::1]']);

const ONDE_CORRIGIR =
  'Local: apps/web/.env.local. Netlify: Site configuration -> Environment ' +
  'variables, e depois um novo deploy - o valor e gravado no bundle durante o build.';

/** Devolve a mensagem de erro, ou null quando a URL serve. */
export function problemaNaUrlSupabase(valor: string | undefined): string | null {
  const v = valor?.trim();
  if (!v) return 'VITE_SUPABASE_URL nao esta definida.';

  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return (
      `VITE_SUPABASE_URL nao e uma URL: "${v}". ` +
      'Use o Project URL do painel (Project Settings -> API), no formato ' +
      'https://<ref>.supabase.co'
    );
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return `VITE_SUPABASE_URL precisa comecar com https://, recebi "${v}".`;
  }

  // http so faz sentido no stack local. Em producao o site e https, e o
  // navegador bloqueia calado qualquer chamada http feita a partir dele.
  if (url.protocol === 'http:' && !HOSTS_LOCAIS.has(url.hostname)) {
    return `VITE_SUPABASE_URL usa http num host remoto: "${v}". Use https.`;
  }

  // O cliente monta /rest/v1, /auth/v1 e /storage/v1 sozinho a partir da
  // origem. Qualquer caminho aqui e duplicado: /rest/v1/auth/v1/signup -> 404.
  if (url.pathname !== '/' || url.search || url.hash) {
    return (
      `VITE_SUPABASE_URL tem um caminho a mais: "${v}". ` +
      `Use so o dominio: ${url.origin}`
    );
  }

  return null;
}

/** So a origem, sem barra final. Chame apenas depois de validar. */
export function normalizarUrlSupabase(valor: string): string {
  return new URL(valor.trim()).origin;
}

const CHAVE_SECRETA =
  'VITE_SUPABASE_ANON_KEY contem a chave SECRETA (service_role). Ela ignora ' +
  'toda a RLS, e tudo que comeca com VITE_ vai para o navegador de qualquer ' +
  'visitante. Troque pela anon key - e se esta chave ja foi publicada alguma ' +
  'vez, gere uma nova no painel do Supabase.';

/** Devolve a mensagem de erro, ou null quando a chave serve. */
export function problemaNaChaveSupabase(valor: string | undefined): string | null {
  const v = valor?.trim();
  if (!v) return 'VITE_SUPABASE_ANON_KEY nao esta definida.';

  // Formato novo de chaves do Supabase.
  if (v.startsWith('sb_secret_')) return CHAVE_SECRETA;
  if (v.startsWith('sb_publishable_')) return null;

  // Formato classico: um JWT, cujo payload diz o papel da chave.
  const partes = v.split('.');
  const papel = partes.length === 3 ? lerPapel(partes[1] as string) : null;

  if (papel === 'service_role') return CHAVE_SECRETA;
  if (papel === 'anon') return null;

  return (
    'VITE_SUPABASE_ANON_KEY nao parece uma anon key do Supabase. Use a anon ' +
    '(ou publishable) key de Project Settings -> API.'
  );
}

/** Le o campo `role` do payload de um JWT, sem validar a assinatura. */
function lerPapel(segmento: string): string | null {
  try {
    const base64 = segmento.replace(/-/g, '+').replace(/_/g, '/');
    const preenchido = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload: unknown = JSON.parse(atob(preenchido));
    const papel = (payload as { role?: unknown } | null)?.role;
    return typeof papel === 'string' ? papel : null;
  } catch {
    return null;
  }
}

/** Junta os problemas das duas variaveis numa mensagem so, ou null. */
export function problemasDoAmbiente(env: {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}): string | null {
  const problemas = [
    problemaNaUrlSupabase(env.VITE_SUPABASE_URL),
    problemaNaChaveSupabase(env.VITE_SUPABASE_ANON_KEY),
  ].filter((p): p is string => p !== null);

  if (problemas.length === 0) return null;
  return (
    'Configuracao do Supabase invalida:\n' +
    [...problemas, ONDE_CORRIGIR].map((p) => `  - ${p}`).join('\n')
  );
}
