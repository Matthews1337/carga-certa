import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { migrations } from '../migrations';
import { models } from '../models';
import { normalizarPush } from '../normalize';
import { COLUNAS_NUMERICAS, TABELAS_GRAVAVEIS, TABELAS_SINCRONIZADAS, schema } from '../schema';

const PASTA_MIGRATIONS = join(__dirname, '../../../../supabase/migrations');

/**
 * Le a lista de tabelas da definicao MAIS RECENTE de uma funcao de whitelist
 * nas migrations do Supabase. E o que o banco de producao executa.
 */
function listaDoSql(funcao: string): string[] {
  const arquivos = readdirSync(PASTA_MIGRATIONS)
    .filter((a) => a.endsWith('.sql'))
    .sort();
  let ultima: string | null = null;
  for (const arquivo of arquivos) {
    const sql = readFileSync(join(PASTA_MIGRATIONS, arquivo), 'utf8');
    const re = new RegExp(
      `function public\\.${funcao}\\(\\)[\\s\\S]*?select array\\[([\\s\\S]*?)\\]::text\\[\\]`,
      'g',
    );
    for (const m of sql.matchAll(re)) ultima = m[1] ?? null;
  }
  if (ultima === null) throw new Error(`${funcao} nao encontrada nas migrations`);
  // Tira os comentarios de linha antes de pegar os nomes entre aspas.
  const semComentario = ultima.replace(/--.*$/gm, '');
  return [...semComentario.matchAll(/'([a-z_]+)'/g)].map((m) => m[1] as string);
}

describe('schema x migrations locais', () => {
  it('toda versao do schema tem passo de migracao', () => {
    // Sem o passo, o WatermelonDB apaga o banco do aparelho ao atualizar o app.
    expect(migrations.maxVersion).toBe(schema.version);
  });

  it('toda tabela do schema tem model, e vice-versa', () => {
    const doSchema = Object.keys(schema.tables).sort();
    const dosModels = models.map((m) => m.table).sort();
    expect(dosModels).toEqual(doSchema);
  });
});

describe('listas do sync x Supabase', () => {
  it('TABELAS_GRAVAVEIS e igual a sync_writable_tables(), na mesma ordem', () => {
    // A ordem importa: e nela que o push grava, pai antes de filho.
    expect([...TABELAS_GRAVAVEIS]).toEqual(listaDoSql('sync_writable_tables'));
  });

  it('TABELAS_SINCRONIZADAS tem as mesmas tabelas de sync_tables()', () => {
    expect([...TABELAS_SINCRONIZADAS].sort()).toEqual(listaDoSql('sync_tables').sort());
  });

  it('posicao_viagem sobe mas nao desce', () => {
    expect(TABELAS_GRAVAVEIS).toContain('posicao_viagem');
    expect(TABELAS_SINCRONIZADAS).not.toContain('posicao_viagem');
  });

  it('toda tabela sincronizada ou gravavel existe no schema local', () => {
    for (const tabela of new Set<string>([...TABELAS_SINCRONIZADAS, ...TABELAS_GRAVAVEIS])) {
      expect(schema.tables, tabela).toHaveProperty(tabela);
    }
  });
});

describe('colunas da rota e da posicao', () => {
  it('coordenadas e km previsto sao numericos: chegam como string do numeric', () => {
    expect(COLUNAS_NUMERICAS.viagem).toEqual(
      expect.arrayContaining(['origem_lat', 'origem_lng', 'destino_lat', 'destino_lng', 'km_previsto']),
    );
    expect(COLUNAS_NUMERICAS.posicao_viagem).toEqual(
      expect.arrayContaining(['latitude', 'longitude', 'precisao_m']),
    );
  });

  it('a hora do GPS volta a ISO no push, senao o cast para timestamptz falha', () => {
    const saida = normalizarPush({
      posicao_viagem: {
        created: [{ id: 'p', viagem_id: 'v', latitude: -17.3, longitude: -50.1, registrado_em: 1_790_000_000_000 }],
        updated: [],
        deleted: [],
      },
    });
    expect(saida.posicao_viagem?.created[0]?.registrado_em).toBe(new Date(1_790_000_000_000).toISOString());
    expect(saida.posicao_viagem?.created[0]?.latitude).toBe(-17.3);
  });
});
