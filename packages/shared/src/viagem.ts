/**
 * Regras do fim da viagem: que data de fim gravar e ate quando a viagem
 * aparece no menu de viagem da despesa. No shared porque o celular, que lanca
 * a despesa na estrada, precisa do mesmo menu.
 */

import { VIAGEM_ABERTA, type StatusViagem } from './enums';
import { intervaloDoMes, mesAtual } from './mes';

type Instante = string | number | Date | null | undefined;

/**
 * Fim a gravar na viagem, pelo status com que ela vai ficar.
 *
 *  - CONCLUIDA: o fim que ja estava gravado (o celular grava a hora em que o
 *    motorista encerrou); sem ele, agora.
 *  - PLANEJADA, EM_ANDAMENTO, PAUSADA: nenhum. Viagem reaberta ainda nao
 *    acabou, e o fim antigo a tiraria do menu quando fosse concluida de novo.
 *  - CANCELADA: o que ja estava gravado.
 *
 * Nunca antes do inicio: o banco recusa (ck_viagem_periodo), e a viagem
 * marcada para amanha e concluida hoje terminaria antes de comecar.
 */
export function fimDaViagem(
  status: StatusViagem,
  inicioEm: Instante,
  fimGravado: Instante,
  agora: Date = new Date(),
): string | null {
  if (VIAGEM_ABERTA.includes(status)) return null;

  const fim = fimGravado ?? (status === 'CONCLUIDA' ? agora : null);
  if (fim === null) return null;

  const instante = Math.max(new Date(fim).getTime(), inicioEm ? new Date(inicioEm).getTime() : -Infinity);
  return new Date(instante).toISOString();
}

/**
 * Se a viagem (com ou sem frete) aparece no menu "Viagem/Frete" da despesa.
 *
 * Pedido do usuario em 2026-10-15: a viagem encerrada em mes anterior sai do
 * menu - o gasto de hoje nao e dela, e a lista so cresceria. Fica a aberta
 * (planejada, em andamento, pausada) e a encerrada no mes atual, porque o
 * gasto da ultima semana as vezes e lancado depois de chegar.
 *
 * A data do encerramento e o fim; sem ele (concluida antes de o web gravar o
 * fim, ou cancelada), o inicio. Sem data nenhuma, fica: nao ha como saber.
 */
export function entraNoMenuDeDespesa(
  viagem: { status: StatusViagem; inicioEm: Instante; fimEm: Instante },
  agora: Date = new Date(),
): boolean {
  if (VIAGEM_ABERTA.includes(viagem.status)) return true;

  const encerrouEm = viagem.fimEm ?? viagem.inicioEm;
  if (encerrouEm === null || encerrouEm === undefined) return true;

  return new Date(encerrouEm) >= intervaloDoMes(mesAtual(agora)).inicio;
}
