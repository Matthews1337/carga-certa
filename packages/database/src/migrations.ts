import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

/**
 * Migrations do SQLite local.
 *
 * Vazio porque a versao 1 e a inicial - nao ha de onde migrar. A partir daqui,
 * toda alteracao em schema.ts exige duas coisas juntas: subir `version` no
 * appSchema e acrescentar o passo correspondente abaixo.
 *
 * Esquecer o passo nao da erro de compilacao. O WatermelonDB detecta que o banco
 * do aparelho esta numa versao sem caminho de migracao, apaga tudo e recria do
 * zero. O usuario perde o que ainda nao tinha subido - que, num app feito para
 * funcionar sem sinal, e exatamente o dado mais caro que existe.
 *
 * Exemplo do passo, para quando a primeira mudanca vier:
 *
 *   import { addColumns } from '@nozbe/watermelondb/Schema/migrations';
 *
 *   migrations: [
 *     {
 *       toVersion: 2,
 *       steps: [
 *         addColumns({
 *           table: 'despesa',
 *           columns: [{ name: 'nota_fiscal', type: 'string', isOptional: true }],
 *         }),
 *       ],
 *     },
 *   ]
 */
export const migrations = schemaMigrations({
  migrations: [],
});
