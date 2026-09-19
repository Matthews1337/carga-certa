import type { Database } from '@nozbe/watermelondb';
import { synchronize, hasUnsyncedChanges } from '@nozbe/watermelondb/sync';

import { normalizarPull, normalizarPush } from './normalize';

/**
 * Sincronizacao com o Supabase via as RPCs `pull_changes` e `push_changes`.
 *
 * O cliente do Supabase e um wrapper HTTP sobre o PostgREST: nao tem fila, nao
 * tem retry, nao funciona sem rede. Quem cobre isso e o WatermelonDB, e o
 * contrato entre os dois sao essas duas funcoes.
 */

/** So o que este modulo precisa do cliente Supabase - o suficiente para testar sem rede. */
export interface ClienteRpc {
  rpc(
    nome: string,
    parametros?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export interface ResultadoSync {
  status: 'sincronizado' | 'em_andamento' | 'falhou';
  erro?: Error;
}

interface RespostaPull {
  changes: Parameters<typeof normalizarPull>[0];
  timestamp: number;
}

/**
 * Um sync por vez.
 *
 * Os tres gatilhos do app - abrir, reconectar e gravar - disparam juntos com
 * facilidade: o motorista sai da sombra do viaduto, o NetInfo avisa e ele salva
 * uma despesa no mesmo segundo. Sem a trava, o `synchronize()` concorrente
 * levanta erro e o segundo push some.
 */
let emAndamento: Promise<void> | null = null;

export async function sincronizar(
  database: Database,
  cliente: ClienteRpc,
): Promise<ResultadoSync> {
  if (emAndamento) {
    await emAndamento;
    return { status: 'em_andamento' };
  }

  const execucao = executarSync(database, cliente);
  emAndamento = execucao.then(
    () => undefined,
    () => undefined,
  );

  try {
    await execucao;
    return { status: 'sincronizado' };
  } catch (erro) {
    return { status: 'falhou', erro: erro instanceof Error ? erro : new Error(String(erro)) };
  } finally {
    emAndamento = null;
  }
}

async function executarSync(database: Database, cliente: ClienteRpc): Promise<void> {
  await synchronize({
    database,

    pullChanges: async ({ lastPulledAt }) => {
      const { data, error } = await cliente.rpc('pull_changes', {
        last_pulled_at: lastPulledAt,
      });
      if (error) throw new Error(`pull_changes: ${error.message}`);

      const resposta = data as RespostaPull;
      return {
        changes: normalizarPull(resposta.changes),
        timestamp: resposta.timestamp,
      };
    },

    pushChanges: async ({ changes, lastPulledAt }) => {
      const { error } = await cliente.rpc('push_changes', {
        changes: normalizarPush(changes as Parameters<typeof normalizarPush>[0]),
        last_pulled_at: lastPulledAt,
      });
      if (error) throw new Error(`push_changes: ${error.message}`);
    },

    /**
     * Manda os registros novos dentro de `updated`.
     *
     * O `push_changes` concatena created e updated e faz upsert, entao a
     * distincao nao muda nada no servidor. O que ela muda e o reenvio: se a
     * conexao cair depois de o banco commitar e antes de a resposta chegar, o
     * proximo push repete o lote - e como `created`, um insert puro daria
     * violacao de chave.
     */
    sendCreatedAsUpdated: true,
  });
}

/** Se ha algo gravado no aparelho que ainda nao subiu. Serve para o indicador de status. */
export function temAlteracoesPendentes(database: Database): Promise<boolean> {
  return hasUnsyncedChanges({ database });
}
