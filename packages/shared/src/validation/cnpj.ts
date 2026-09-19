/**
 * CNPJ - digito verificador, na regra alfanumerica.
 *
 * Desde julho de 2026 (IN RFB 2.229/2024) os 12 primeiros caracteres podem ser
 * letras. O calculo do DV mudou junto: em vez do valor numerico do digito, usa-se
 * `charCodeAt - 48`, o que faz '0'..'9' valerem 0..9 e 'A'..'Z' valerem 17..42.
 *
 * Como '0' - 48 = 0, a formula alfanumerica devolve exatamente o mesmo resultado
 * da antiga para um CNPJ so de digitos. Uma implementacao cobre os dois formatos,
 * e nao existe data de corte no codigo para esquecer de virar.
 *
 * Os dois ultimos caracteres continuam sendo digitos em qualquer caso.
 */

const PESOS_DV1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const PESOS_DV2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;

/** Maiusculas, sem pontuacao. E nesta forma que o CNPJ vai para o banco. */
export function limparCnpj(valor: string): string {
  return valor.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

function valorDoCaractere(c: string): number {
  return c.charCodeAt(0) - 48;
}

function calcularDv(base: string, pesos: readonly number[]): number {
  let soma = 0;
  for (let i = 0; i < base.length; i += 1) {
    soma += valorDoCaractere(base[i] as string) * (pesos[i] as number);
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function isCnpjValido(valor: string): boolean {
  const cnpj = limparCnpj(valor);
  if (cnpj.length !== 14) return false;

  // Raiz alfanumerica, DV sempre numerico.
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj)) return false;

  // AAAAAAAAAAAAAA e 00000000000000 fecham a conta mas nao sao CNPJ.
  if (/^(.)\1{13}$/.test(cnpj)) return false;

  const base = cnpj.slice(0, 12);
  const dv1 = calcularDv(base, PESOS_DV1);
  if (dv1 !== Number(cnpj[12])) return false;

  const dv2 = calcularDv(base + String(dv1), PESOS_DV2);
  return dv2 === Number(cnpj[13]);
}

/** 00.000.000/0000-00. Devolve a entrada intacta se nao tiver 14 caracteres. */
export function formatarCnpj(valor: string): string {
  const cnpj = limparCnpj(valor);
  if (cnpj.length !== 14) return valor;
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}
