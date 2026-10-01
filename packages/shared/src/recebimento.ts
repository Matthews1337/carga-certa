/**
 * Situacao do recebimento de um frete: a cor do valor no card.
 *
 * Regra combinada com o usuario em 2026-09-29:
 *
 *   CANCELADO  frete cancelado, nao importa o que caiu (cinza);
 *   RECEBIDO   o pagamento final (tipo SALDO) ja caiu, OU o que caiu do frete
 *              ja cobre o valor combinado (verde);
 *   A_RECEBER  todo o resto (laranja).
 *
 * O "OU" cobre o contratante que desconta quebra ou avaria: ele paga menos que
 * o combinado, o motorista lanca o saldo com o valor que caiu, e o frete fica
 * verde mesmo assim - sem botao "dar como recebido" nem coluna nova.
 *
 * So conta o que tem data de recebimento: lancado e ainda nao caiu nao e
 * dinheiro na mao. E so ADIANTAMENTO e SALDO pagam o frete: estadia, extra e
 * devolucao de pedagio sao outros dinheiros, e nao podem fazer um frete pela
 * metade parecer quitado.
 */

import type { StatusFrete, TipoReceita } from './enums';
import { deCentavos, paraCentavos, parseNumericOu0 } from './numeric';

export type SituacaoRecebimento = 'RECEBIDO' | 'A_RECEBER' | 'CANCELADO';

/** Tipos que pagam o valor combinado do frete. */
export const TIPOS_QUE_PAGAM_O_FRETE: readonly TipoReceita[] = ['ADIANTAMENTO', 'SALDO'];

export interface RecebimentoParaResumo {
  tipo: TipoReceita;
  valor: number | string;
  /** Nulo = lancado, mas ainda nao caiu. */
  recebidoEm: string | number | Date | null | undefined;
}

export interface ResumoRecebimento {
  situacao: SituacaoRecebimento;
  /** Tudo o que ja caiu, de qualquer tipo. */
  recebido: number;
  /** O que ja caiu de adiantamento e saldo. */
  pagoDoFrete: number;
  /** Valor combinado menos o pago do frete, nunca negativo. Sugestao do proximo lancamento. */
  faltaReceber: number;
}

export function resumirRecebimento({
  statusFrete,
  valorCombinado,
  recebimentos,
}: {
  statusFrete: StatusFrete;
  valorCombinado: number | string;
  recebimentos: readonly RecebimentoParaResumo[];
}): ResumoRecebimento {
  const caiu = recebimentos.filter((r) => r.recebidoEm !== null && r.recebidoEm !== undefined);

  // Em centavos: 0,1 + 0,2 nao pode deixar um frete de R$ 0,30 como "a receber".
  const centavos = (lista: readonly RecebimentoParaResumo[]) =>
    lista.reduce((soma, r) => soma + paraCentavos(parseNumericOu0(r.valor)), 0);

  const recebido = centavos(caiu);
  const pagoDoFrete = centavos(caiu.filter((r) => TIPOS_QUE_PAGAM_O_FRETE.includes(r.tipo)));
  const combinado = paraCentavos(parseNumericOu0(valorCombinado));

  let situacao: SituacaoRecebimento;
  if (statusFrete === 'CANCELADO') situacao = 'CANCELADO';
  else if (caiu.some((r) => r.tipo === 'SALDO')) situacao = 'RECEBIDO';
  else if (combinado > 0 && pagoDoFrete >= combinado) situacao = 'RECEBIDO';
  else situacao = 'A_RECEBER';

  return {
    situacao,
    recebido: deCentavos(recebido),
    pagoDoFrete: deCentavos(pagoDoFrete),
    faltaReceber: deCentavos(Math.max(0, combinado - pagoDoFrete)),
  };
}
