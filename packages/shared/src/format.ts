/**
 * Formatacao para exibicao. Nada aqui volta para o banco - o banco guarda o
 * valor cru e a tela decide como mostrar.
 */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const DECIMAL = (casas: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

export function formatarBRL(valor: number | string | null | undefined): string {
  const n = typeof valor === 'string' ? Number(valor) : valor;
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return BRL.format(n);
}

/** Odometro e distancia. Inteiro, porque decimal de km nao ajuda ninguem. */
export function formatarKm(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  return `${DECIMAL(0).format(Math.round(valor))} km`;
}

export function formatarLitros(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  return `${DECIMAL(2).format(valor)} L`;
}

export function formatarConsumo(kmPorLitro: number | null | undefined): string {
  if (kmPorLitro === null || kmPorLitro === undefined || !Number.isFinite(kmPorLitro)) return '—';
  return `${DECIMAL(2).format(kmPorLitro)} km/L`;
}

/** Custo por km: tres casas, porque a diferenca relevante esta no milesimo. */
export function formatarCustoPorKm(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  return `${BRL.format(valor)}/km`;
}

export function formatarPeso(kg: number | null | undefined): string {
  if (kg === null || kg === undefined || !Number.isFinite(kg)) return '—';
  if (kg >= 1000) return `${DECIMAL(kg % 1000 === 0 ? 0 : 1).format(kg / 1000)} t`;
  return `${DECIMAL(0).format(kg)} kg`;
}

export function formatarTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return valor;
}

/**
 * Duracao em horas e minutos. Usada em parada (chegada/saida) e em viagem.
 * Nao passa de "dias" porque uma viagem de 3 dias lida melhor como "72h 10min"
 * na comparacao entre viagens.
 */
export function formatarDuracao(inicioMs: number, fimMs: number): string {
  const minutos = Math.max(0, Math.round((fimMs - inicioMs) / 60_000));
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}
