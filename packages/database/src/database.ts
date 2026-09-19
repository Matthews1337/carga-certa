import { Database } from '@nozbe/watermelondb';
import type { DatabaseAdapter } from '@nozbe/watermelondb/adapters/type';
import { setGenerator } from '@nozbe/watermelondb/utils/common/randomId';
import { uuidv7 } from '@carga-certa/shared';

import { models } from './models';
import { schema } from './schema';

/**
 * Monta o Database a partir de um adapter.
 *
 * O adapter fica de fora de proposito: no React Native e o SQLiteAdapter com
 * JSI, e num teste em Node e o LokiJSAdapter. Fixar um aqui arrastaria modulo
 * nativo para dentro do pacote e impediria testar a camada de dados sem
 * emulador.
 */
export function criarDatabase(adapter: DatabaseAdapter): Database {
  configurarGeradorDeId();
  return new Database({ adapter, modelClasses: [...models] });
}

let geradorConfigurado = false;

/**
 * Troca o gerador de id do WatermelonDB por UUID v7.
 *
 * O padrao do WatermelonDB e uma string aleatoria curta, que o Postgres rejeita
 * na coluna `uuid`. Trocar aqui, e nao no app, garante que ninguem consiga criar
 * um registro com id invalido: o erro so apareceria no primeiro push, depois de
 * o dado ja estar salvo no aparelho e sem forma de corrigir o id.
 *
 * Idempotente porque o hot reload do Metro reexecuta o modulo.
 */
export function configurarGeradorDeId(): void {
  if (geradorConfigurado) return;
  setGenerator(uuidv7);
  geradorConfigurado = true;
}
