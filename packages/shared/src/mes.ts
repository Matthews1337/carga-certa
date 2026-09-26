/**
 * Mes de referencia dos relatorios, no formato 'AAAA-MM'.
 *
 * O mes e sempre o do FUSO LOCAL do aparelho, nunca UTC. Uma despesa lancada
 * as 23h do dia 30 de setembro em Brasilia e 02h de 1o de outubro em UTC: se o
 * limite do mes fosse calculado em UTC, ela apareceria no relatorio de outubro,
 * e o motorista nao acharia o gasto onde o lancou.
 */

const RE_MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function ehMesValido(mes: string | null | undefined): mes is string {
  return typeof mes === 'string' && RE_MES.test(mes);
}

function partes(mes: string): [ano: number, indiceMes: number] {
  const m = RE_MES.exec(mes);
  if (!m) throw new Error(`Mes invalido: "${mes}". Use o formato AAAA-MM.`);
  return [Number(m[1]), Number(m[2]) - 1];
}

/** Mes (local) em que a data cai. */
export function mesDe(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

export function mesAtual(agora: Date = new Date()): string {
  return mesDe(agora);
}

/** Avanca ou recua meses. Atravessa a virada de ano: '2026-01' - 1 = '2025-12'. */
export function deslocarMes(mes: string, delta: number): string {
  const [ano, indice] = partes(mes);
  return mesDe(new Date(ano, indice + delta, 1));
}

/**
 * Limites do mes para filtro: `inicio` inclusivo, `fim` EXCLUSIVO (o primeiro
 * instante do mes seguinte).
 *
 * Fim exclusivo, e nao "23:59:59.999 do ultimo dia", porque nao depende de
 * saber quantos dias o mes tem nem da precisao do relogio do banco.
 */
export function intervaloDoMes(mes: string): { inicio: Date; fim: Date } {
  const [ano, indice] = partes(mes);
  return { inicio: new Date(ano, indice, 1), fim: new Date(ano, indice + 1, 1) };
}

/** "Setembro de 2026". */
export function rotuloDoMes(mes: string): string {
  const [ano, indice] = partes(mes);
  const texto = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(ano, indice, 1),
  );
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
