/**
 * UUID v7 - identificador ordenavel por tempo (RFC 9562).
 *
 * O app gera o ID offline, antes de qualquer contato com o servidor. Com UUID
 * v4 os ids chegariam em ordem aleatoria e o indice B-tree da PK fragmentaria a
 * cada lote sincronizado; o v7 carrega o timestamp nos 48 bits mais altos,
 * entao um lote de 200 despesas de uma viagem cai em paginas vizinhas.
 *
 * Layout (RFC 9562, secao 5.7):
 *   bytes 0-5   unix_ts_ms  - 48 bits, big-endian
 *   byte  6-7   ver + rand_a - 4 bits de versao (0111) + 12 bits de sequencia
 *   byte  8     var + rand_b - 2 bits de variante (10) + aleatorio
 *   bytes 9-15  rand_b       - aleatorio
 *
 * IMPORTANTE (React Native): o Hermes nao traz `crypto.getRandomValues`.
 * Importe `react-native-get-random-values` no topo do entrypoint do app,
 * antes de qualquer import que alcance este modulo.
 */

const RE_UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Tipado a mao em vez de puxar a lib "DOM": este pacote roda tambem no React
// Native, onde o DOM nao existe e habilitar a lib deixaria `document` e
// `window` visiveis para o autocomplete de codigo que vai quebrar no aparelho.
type ComCrypto = { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };

function getRandomValues(bytes: Uint8Array): Uint8Array {
  const c = (globalThis as ComCrypto).crypto;
  if (!c?.getRandomValues) {
    throw new Error(
      'crypto.getRandomValues indisponivel. No React Native, importe ' +
        '"react-native-get-random-values" no topo do entrypoint do app.',
    );
  }
  return c.getRandomValues(bytes);
}

// Estado da sequencia monotonica dentro do mesmo milissegundo.
let ultimoMs = -1;
let sequencia = 0;

/**
 * Gera um UUID v7.
 *
 * Dois ids gerados no mesmo milissegundo continuam ordenados, porque os 12 bits
 * de `rand_a` viram contador em vez de aleatorio puro - o metodo 2 da secao 6.2
 * da RFC. Sem isso, salvar cinco despesas de uma vez produziria ids fora de
 * ordem entre si, e a lista ordenada por id nao bateria com a ordem de digitacao.
 */
export function uuidv7(): string {
  const bytes = new Uint8Array(16);
  getRandomValues(bytes);

  // Relogio de celular anda para tras: troca de fuso, ajuste de NTP, usuario
  // mexendo na data. Congelar em `ultimoMs` mantem os ids crescentes; o custo e
  // um timestamp embutido levemente adiantado, que ninguem usa como data.
  const agora = Date.now();
  const ms = agora < ultimoMs ? ultimoMs : agora;

  if (ms === ultimoMs) {
    sequencia = (sequencia + 1) & 0x0fff;
    if (sequencia === 0) {
      // 4096 ids no mesmo milissegundo. Avanca o relogio logico em 1ms em vez de
      // travar a thread esperando: o proximo id continua maior que este.
      ultimoMs = ms + 1;
      return uuidv7();
    }
  } else {
    ultimoMs = ms;
    // Comeca em ponto aleatorio da primeira metade para nao vazar a contagem de
    // registros do milissegundo nem estourar o contador logo de cara.
    sequencia = ((bytes[6] ?? 0) << 4 | (bytes[7] ?? 0) >> 4) & 0x07ff;
  }

  const view = new DataView(bytes.buffer);
  view.setUint16(0, Math.floor(ms / 0x1_0000_0000));
  view.setUint32(2, ms % 0x1_0000_0000);
  view.setUint16(6, 0x7000 | sequencia); // versao 7 + sequencia
  view.setUint8(8, (view.getUint8(8) & 0x3f) | 0x80); // variante RFC 4122

  let hex = '';
  for (let i = 0; i < 16; i += 1) {
    hex += view.getUint8(i).toString(16).padStart(2, '0');
  }

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Valida formato e versao. Nao garante que o id exista no banco. */
export function isUuidV7(valor: string): boolean {
  return RE_UUID_V7.test(valor);
}

/**
 * Extrai o instante de criacao embutido no id. Serve para depuracao e para
 * ordenar em memoria - nunca como substituto de `created_at`, que e o relogio
 * do servidor e e o unico confiavel.
 */
export function dataDoUuidV7(id: string): Date | null {
  if (!isUuidV7(id)) return null;
  const ms = Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
  return new Date(ms);
}
