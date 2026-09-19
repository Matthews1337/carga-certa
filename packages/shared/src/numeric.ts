/**
 * Conversao e soma de valores `numeric` do Postgres.
 *
 * Duas armadilhas justificam este arquivo:
 *
 * 1. Dependendo do caminho (PostgREST direto, `to_jsonb` da RPC de sync, ou um
 *    driver diferente), um `numeric(12,2)` chega ora como number, ora como
 *    string. `parseNumeric` aceita os dois em vez de apostar em um.
 *
 * 2. Somar reais em ponto flutuante acumula erro: 0.1 + 0.2 === 0.30000000000000004.
 *    Numa viagem com 300 despesas isso vira centavos de diferenca entre o total
 *    do app e o total da view no banco - o tipo de divergencia que destroi a
 *    confianca do usuario no aplicativo. `somar` trabalha em centavos inteiros.
 */

/** Aceita number, string numerica ou nulo. Retorna null no que nao for numero. */
export function parseNumeric(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor === 'string') {
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Como `parseNumeric`, mas com piso: usa 0 quando o valor nao existe. */
export function parseNumericOu0(valor: unknown): number {
  return parseNumeric(valor) ?? 0;
}

/**
 * Converte reais em centavos inteiros. `Math.round` e obrigatorio: 19.99 * 100
 * da 1998.9999999999998 em ponto flutuante, e `Math.trunc` perderia um centavo.
 */
export function paraCentavos(valor: number): number {
  return Math.round(valor * 100);
}

export function deCentavos(centavos: number): number {
  return centavos / 100;
}

/** Soma monetaria exata: acumula em centavos e volta para reais no fim. */
export function somar(valores: readonly (number | string | null | undefined)[]): number {
  let centavos = 0;
  for (const v of valores) {
    centavos += paraCentavos(parseNumericOu0(v));
  }
  return deCentavos(centavos);
}

/**
 * Le o que o usuario digitou num campo de valor.
 *
 * Aceita "1.234,56" (teclado brasileiro), "1234.56" (teclado numerico do
 * celular) e "1234". A regra para desempatar: se ha virgula, ela e o separador
 * decimal e todo ponto e milhar. Sem virgula, o ponto e decimal - exceto quando
 * aparece mais de uma vez ("1.234.567"), que so pode ser milhar.
 */
export function parseValorDigitado(texto: string): number | null {
  const limpo = texto.trim().replace(/\s|R\$/g, '');
  if (limpo === '') return null;
  if (!/^-?[\d.,]+$/.test(limpo)) return null;

  let normalizado: string;
  if (limpo.includes(',')) {
    normalizado = limpo.replace(/\./g, '').replace(',', '.');
  } else if ((limpo.match(/\./g) ?? []).length > 1) {
    normalizado = limpo.replace(/\./g, '');
  } else {
    normalizado = limpo;
  }

  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/** Arredonda para N casas sem o vies de `toFixed` em binarios de meio exato. */
export function arredondar(valor: number, casas = 2): number {
  const fator = 10 ** casas;
  return Math.round((valor + Number.EPSILON) * fator) / fator;
}
