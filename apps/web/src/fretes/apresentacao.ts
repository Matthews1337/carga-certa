/**
 * Textos do card e do detalhe do frete. Funcoes puras, testadas a parte.
 */

const UF = /^[A-Z]{2}$/;

/**
 * "Rua Minas Gerais, Rio Verde, GO" -> "Rio Verde, GO".
 *
 * No titulo do card o motorista pensa em cidade, e o nome que o ORS devolve
 * pode ser um endereco inteiro. Quando o ultimo pedaco e uma UF, fica a
 * cidade (penultimo pedaco) com ela; senao, o nome todo.
 */
export function cidadeDoLugar(nome: string | null | undefined): string {
  if (!nome) return 'Sem local';
  const partes = nome.split(',').map((p) => p.trim()).filter(Boolean);
  const uf = partes.at(-1);
  if (partes.length >= 2 && uf && UF.test(uf)) return `${partes.at(-2)}, ${uf}`;
  return nome.trim();
}

/** "out/2026", no fuso do navegador. Curto para caber numa linha do card. */
export function mesDoInicio(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const mes = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${mes}/${d.getFullYear()}`;
}

/**
 * Km do card: o dos odometros quando a viagem terminou; antes disso, o da rota
 * calculada, marcado como previsto.
 */
export function kmDoFrete(viagem: { km_total: number | null; km_previsto: number | null } | null): {
  km: number | null;
  previsto: boolean;
} {
  if (viagem?.km_total !== null && viagem?.km_total !== undefined) {
    return { km: viagem.km_total, previsto: false };
  }
  return { km: viagem?.km_previsto ?? null, previsto: true };
}

/** "agora há pouco", "há 25 min", "há 3 h", "há 2 dias". */
export function tempoDesde(iso: string, agora: Date = new Date()): string {
  const minutos = Math.max(0, Math.round((agora.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutos < 2) return 'agora há pouco';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}
