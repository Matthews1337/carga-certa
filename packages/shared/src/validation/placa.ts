/**
 * Placa de veiculo.
 *
 * A expressao e a mesma do `ck_veiculo_placa` no banco - AAA0X00, onde a quinta
 * posicao aceita letra ou digito. Isso cobre os dois padroes em circulacao com
 * uma regra so:
 *
 *   antiga   AAA0000   quinta posicao e digito
 *   Mercosul AAA0A00   quinta posicao e letra
 *
 * Duplicar a expressao aqui e no banco e proposital: o cliente rejeita antes de
 * gastar a viagem de rede, e o banco rejeita de novo porque cliente mente.
 */

const RE_PLACA = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

export type PadraoPlaca = 'ANTIGA' | 'MERCOSUL';

/** Maiusculas, sem hifen nem espaco. E nesta forma que a placa vai para o banco. */
export function limparPlaca(valor: string): string {
  return valor.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function isPlacaValida(valor: string): boolean {
  return RE_PLACA.test(limparPlaca(valor));
}

export function padraoDaPlaca(valor: string): PadraoPlaca | null {
  const placa = limparPlaca(valor);
  if (!RE_PLACA.test(placa)) return null;
  return /\d/.test(placa[4] as string) ? 'ANTIGA' : 'MERCOSUL';
}

/** AAA-0000 no padrao antigo, AAA0A00 no Mercosul (que nao leva hifen). */
export function formatarPlaca(valor: string): string {
  const placa = limparPlaca(valor);
  if (padraoDaPlaca(placa) !== 'ANTIGA') return placa;
  return `${placa.slice(0, 3)}-${placa.slice(3)}`;
}
