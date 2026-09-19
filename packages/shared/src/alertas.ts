/**
 * Vencimentos: CNH, documentos do veiculo e manutencao programada.
 *
 * Caminhoneiro parado na balanca com CRLV vencido perde o dia e leva multa. O
 * app precisa avisar antes, e o aviso tem que funcionar offline - por isso o
 * calculo e local e nao uma consulta ao banco.
 */

/** Dias de antecedencia de cada faixa de aviso. */
export const ANTECEDENCIA_PADRAO = { critico: 7, atencao: 30 } as const;

export type SituacaoVencimento = 'VENCIDO' | 'CRITICO' | 'ATENCAO' | 'OK';

/**
 * Dias ate a data, contados em data local e nao em milissegundos.
 *
 * `Math.ceil` sobre a diferenca bruta erra por um quando os horarios do dia
 * diferem: um documento que vence hoje as 23h daria "1 dia" se a conta rodasse
 * as 10h da manha. Zerando a hora dos dois lados, "vence hoje" e sempre 0.
 */
export function diasAte(data: Date, hoje: Date = new Date()): number {
  const a = Date.UTC(data.getFullYear(), data.getMonth(), data.getDate());
  const b = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((a - b) / 86_400_000);
}

export function situacaoVencimento(
  validade: Date | null | undefined,
  antecedencia = ANTECEDENCIA_PADRAO,
): SituacaoVencimento | null {
  if (!validade) return null;
  const dias = diasAte(validade);
  if (dias < 0) return 'VENCIDO';
  if (dias <= antecedencia.critico) return 'CRITICO';
  if (dias <= antecedencia.atencao) return 'ATENCAO';
  return 'OK';
}

/**
 * Manutencao programada pode vencer por data ou por odometro, o que vier
 * primeiro. Vale a situacao mais grave das duas.
 */
export function situacaoManutencao(params: {
  proximaData: Date | null | undefined;
  proximaOdometro: number | null | undefined;
  odometroAtual: number | null | undefined;
  /** Km de antecedencia para o aviso. 1.000 km e cerca de um dia de estrada. */
  folgaKm?: number;
}): SituacaoVencimento | null {
  const porData = situacaoVencimento(params.proximaData);

  let porKm: SituacaoVencimento | null = null;
  const { proximaOdometro, odometroAtual, folgaKm = 1000 } = params;
  if (proximaOdometro !== null && proximaOdometro !== undefined &&
      odometroAtual !== null && odometroAtual !== undefined) {
    const restante = proximaOdometro - odometroAtual;
    if (restante < 0) porKm = 'VENCIDO';
    else if (restante <= folgaKm) porKm = 'CRITICO';
    else if (restante <= folgaKm * 3) porKm = 'ATENCAO';
    else porKm = 'OK';
  }

  const ordem: SituacaoVencimento[] = ['VENCIDO', 'CRITICO', 'ATENCAO', 'OK'];
  const candidatos = [porData, porKm].filter((s): s is SituacaoVencimento => s !== null);
  if (candidatos.length === 0) return null;
  return ordem.find((s) => candidatos.includes(s)) ?? 'OK';
}

/** Texto curto para a lista de pendencias. */
export function descreverVencimento(validade: Date): string {
  const dias = diasAte(validade);
  if (dias < -1) return `vencido ha ${Math.abs(dias)} dias`;
  if (dias === -1) return 'vencido ontem';
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanha';
  return `vence em ${dias} dias`;
}
