/**
 * Telefone brasileiro, sempre com DDD.
 *
 * O banco guarda so os digitos, sem codigo do pais: 62999998888. A tela formata
 * com `formatarTelefone` e monta o link de ligacao ou de WhatsApp na hora.
 */

/**
 * So digitos, sem +55 e sem o 0 de operadora. E nesta forma que vai para o banco.
 *
 * Quem copia o numero do WhatsApp cola "+55 62 99999-8888" (13 digitos), e
 * quem aprendeu a discar interurbano digita "062 3212-3456". Os dois viram o
 * mesmo numero de 10 ou 11 digitos. Tirar o 55 so quando sobram 12 ou 13
 * digitos nao confunde com o DDD 55 (RS): com DDD, o numero tem 10 ou 11.
 */
export function limparTelefone(valor: string): string {
  let d = valor.replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  // DDD nao tem zero, entao um 0 na frente so pode ser o prefixo de interurbano.
  if ((d.length === 11 || d.length === 12) && d.startsWith('0')) d = d.slice(1);
  return d;
}

/** Celular: 11 digitos, com 9 logo depois do DDD. */
export function ehCelular(valor: string): boolean {
  return /^[1-9]{2}9\d{8}$/.test(limparTelefone(valor));
}

/**
 * Fixo (10 digitos) ou celular (11). DDD sem zero; fixo comeca de 2 a 8.
 * Mais frouxo que a tabela da Anatel de proposito: recusar um numero valido
 * seria pior do que aceitar um DDD que nao existe.
 */
export function isTelefoneValido(valor: string): boolean {
  const d = limparTelefone(valor);
  return /^[1-9]{2}[2-8]\d{7}$/.test(d) || ehCelular(d);
}
