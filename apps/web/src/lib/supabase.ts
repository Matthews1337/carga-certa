import { createClient } from '@supabase/supabase-js';
import type { Database } from '@carga-certa/shared';

import { normalizarUrlSupabase, problemasDoAmbiente } from '@/lib/env';

/**
 * Cliente do Supabase, tipado pelo schema real.
 *
 * A anon key e publica por natureza: ela viaja no bundle e qualquer um a extrai
 * do navegador. Quem protege os dados e a RLS, nao a chave. A service_role key,
 * essa sim, NUNCA pode aparecer aqui - ela ignora RLS por definicao.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// A mesma checagem do build (vite.config.ts), aqui para o dev server. Troca o
// 404 enigmatico por uma mensagem que diz exatamente o que corrigir e onde.
const problema = problemasDoAmbiente({
  VITE_SUPABASE_URL: url,
  VITE_SUPABASE_ANON_KEY: anonKey,
});
if (problema) throw new Error(problema);

export const supabase = createClient<Database>(
  normalizarUrlSupabase(url as string),
  anonKey as string,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

/**
 * LEMBRETE PARA TODA CONSULTA: `.is('deleted_at', null)`.
 *
 * Nenhuma policy de RLS esconde registro excluido - se escondesse, a propria
 * exclusao logica seria impossivel, porque o Postgres exige que a linha
 * resultante de um UPDATE continue visivel sob as policies de SELECT. Esquecer
 * o filtro faz despesa apagada reaparecer na lista.
 */
