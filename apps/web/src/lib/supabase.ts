import { createClient } from '@supabase/supabase-js';
import type { Database } from '@carga-certa/shared';

/**
 * Cliente do Supabase, tipado pelo schema real.
 *
 * A anon key e publica por natureza: ela viaja no bundle e qualquer um a extrai
 * do navegador. Quem protege os dados e a RLS, nao a chave. A service_role key,
 * essa sim, NUNCA pode aparecer aqui - ela ignora RLS por definicao.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY sao obrigatorias. ' +
      'Copie apps/web/.env.example para apps/web/.env.local e preencha.',
  );
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * LEMBRETE PARA TODA CONSULTA: `.is('deleted_at', null)`.
 *
 * Nenhuma policy de RLS esconde registro excluido - se escondesse, a propria
 * exclusao logica seria impossivel, porque o Postgres exige que a linha
 * resultante de um UPDATE continue visivel sob as policies de SELECT. Esquecer
 * o filtro faz despesa apagada reaparecer na lista.
 */
