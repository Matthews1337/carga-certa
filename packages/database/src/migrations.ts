import { addColumns, createTable, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

import { COLUNAS_POSICAO_VIAGEM, COLUNAS_ROTA_VIAGEM } from './schema';

/**
 * Migrations do SQLite local.
 *
 * Toda alteracao em schema.ts exige duas coisas juntas: subir `version` no
 * appSchema e acrescentar o passo correspondente abaixo. O teste em
 * __tests__/schema.test.ts acusa se a versao do schema passar a da ultima
 * migration.
 *
 * Esquecer o passo nao da erro de compilacao. O WatermelonDB detecta que o banco
 * do aparelho esta numa versao sem caminho de migracao, apaga tudo e recria do
 * zero. O usuario perde o que ainda nao tinha subido - que, num app feito para
 * funcionar sem sinal, e exatamente o dado mais caro que existe.
 *
 * Passo so ACRESCENTA. O WatermelonDB nao sabe remover nem alterar coluna; e o
 * que sai do servidor pode continuar existindo aqui, ignorado.
 */
export const migrations = schemaMigrations({
  migrations: [
    {
      // Supabase: 20260929230000_rota_e_posicao_da_viagem.sql
      toVersion: 2,
      steps: [
        addColumns({ table: 'viagem', columns: [...COLUNAS_ROTA_VIAGEM] }),
        createTable({ name: 'posicao_viagem', columns: [...COLUNAS_POSICAO_VIAGEM] }),
      ],
    },
  ],
});
