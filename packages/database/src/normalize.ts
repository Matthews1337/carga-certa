import { COLUNAS_INSTANTE, COLUNAS_NUMERICAS } from './schema';

/**
 * Traducao entre o formato do Postgres e o do WatermelonDB.
 *
 * As RPCs `pull_changes` / `push_changes` ja resolvem piloto_id, exclusao logica
 * e o par created_at/updated_at. Sobram duas diferencas de tipo que o SQL nao
 * cobre e que, silenciosas, produzem bug de calculo em vez de erro:
 *
 *   numeric     -> pode chegar como string, dependendo do caminho ate o JSON.
 *                  Em coluna declarada `number` o WatermelonDB guarda a string
 *                  como esta, e "1500.00" + "1500.00" vira "1500.001500.00".
 *   timestamptz -> chega como texto ISO com offset. Precisa virar epoch ms para
 *                  ordenar certo e para o decorator @date funcionar.
 */

type Registro = Record<string, unknown>;

interface ConjuntoDeMudancas {
  [tabela: string]: {
    created: Registro[];
    updated: Registro[];
    deleted: string[];
  };
}

function paraNumero(valor: unknown): unknown {
  if (valor === null || valor === undefined) return valor;
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string') {
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof valor === 'boolean') return valor ? 1 : 0;
  return null;
}

function paraEpoch(valor: unknown): unknown {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string') {
    const ms = Date.parse(valor);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

function paraIso(valor: unknown): unknown {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return new Date(valor).toISOString();
  return valor;
}

/** Aplica as conversoes de entrada num registro vindo do servidor. */
function normalizarEntrada(tabela: string, registro: Registro): Registro {
  const instantes = COLUNAS_INSTANTE[tabela] ?? [];
  const numericas = COLUNAS_NUMERICAS[tabela] ?? [];
  const saida: Registro = { ...registro };

  // As colunas de instante tambem estao declaradas como `number` no schema -
  // guardamos epoch ms. Por isso a passada numerica precisa pula-las: aplicada
  // ao texto ISO, `Number('2026-09-19T12:00:00+00:00')` da NaN, o valor viraria
  // null e a data da despesa sumiria sem nenhum erro no caminho.
  for (const coluna of numericas) {
    if (instantes.includes(coluna)) continue;
    if (coluna in saida) saida[coluna] = paraNumero(saida[coluna]);
  }

  for (const coluna of instantes) {
    if (coluna in saida) saida[coluna] = paraEpoch(saida[coluna]);
  }

  return saida;
}

/** Converte o payload inteiro de `pull_changes` para o formato local. */
export function normalizarPull(changes: ConjuntoDeMudancas): ConjuntoDeMudancas {
  const saida: ConjuntoDeMudancas = {};

  for (const [tabela, conjunto] of Object.entries(changes)) {
    saida[tabela] = {
      created: (conjunto.created ?? []).map((r) => normalizarEntrada(tabela, r)),
      updated: (conjunto.updated ?? []).map((r) => normalizarEntrada(tabela, r)),
      deleted: conjunto.deleted ?? [],
    };
  }

  return saida;
}

/**
 * Converte o payload local de volta ao formato do Postgres.
 *
 * So os instantes precisam voltar: `jsonb_populate_record` nao aceita um numero
 * onde a coluna e timestamptz, e o push falharia com erro de cast - justamente
 * no momento em que o motorista reencontrou sinal e espera que suba tudo.
 *
 * `_status`, `_changed`, `created_at` e `updated_at` seguem como estao: o
 * servidor os descarta, e removar aqui duplicaria a regra em dois lugares.
 */
export function normalizarPush(changes: ConjuntoDeMudancas): ConjuntoDeMudancas {
  const saida: ConjuntoDeMudancas = {};

  for (const [tabela, conjunto] of Object.entries(changes)) {
    const instantes = COLUNAS_INSTANTE[tabela] ?? [];

    const converter = (registros: Registro[]) =>
      instantes.length === 0
        ? registros
        : registros.map((r) => {
            const copia: Registro = { ...r };
            for (const coluna of instantes) {
              if (coluna in copia) copia[coluna] = paraIso(copia[coluna]);
            }
            return copia;
          });

    saida[tabela] = {
      created: converter(conjunto.created ?? []),
      updated: converter(conjunto.updated ?? []),
      deleted: conjunto.deleted ?? [],
    };
  }

  return saida;
}
