import {
  dataLocal,
  descreverVencimento,
  situacaoVencimento,
  type SituacaoVencimento,
} from '@carga-certa/shared';

import type { DocumentoResumo } from '@/veiculos/api';

/**
 * Aviso de vencimento do card de veiculo: o documento mais urgente, em uma
 * linha. O motorista nao precisa abrir os documentos para saber se o CRLV esta
 * para vencer; precisa abrir so quando o card avisa.
 */

const GRAVIDADE: Record<SituacaoVencimento, number> = {
  VENCIDO: 0,
  CRITICO: 1,
  ATENCAO: 2,
  OK: 3,
};

export interface AvisoVencimento {
  situacao: SituacaoVencimento;
  /** "CRLV vence em 5 dias", ou "Documentos em dia". */
  texto: string;
  /** Quantos outros documentos tambem estao vencidos ou perto de vencer. */
  outros: number;
}

/** Null quando nenhum documento tem validade: nao ha o que avisar. */
export function avisoDeVencimento(
  documentos: DocumentoResumo[],
  hoje: Date = new Date(),
): AvisoVencimento | null {
  const comValidade = documentos.flatMap((d) => {
    if (!d.validade) return [];
    // dataLocal, e nao new Date(): 'AAAA-MM-DD' seria lido como UTC e o
    // vencimento recuaria um dia no horario de Brasilia.
    const validade = dataLocal(d.validade);
    const situacao = situacaoVencimento(validade, undefined, hoje) ?? 'OK';
    return [{ nome: d.tipo?.nome ?? 'Documento', validade, situacao }];
  });

  if (comValidade.length === 0) return null;

  // O mais grave primeiro; na mesma faixa, o que vence (ou venceu) antes.
  comValidade.sort(
    (a, b) =>
      GRAVIDADE[a.situacao] - GRAVIDADE[b.situacao] || a.validade.getTime() - b.validade.getTime(),
  );

  const [maisUrgente] = comValidade as [(typeof comValidade)[number]];
  if (maisUrgente.situacao === 'OK') {
    return { situacao: 'OK', texto: 'Documentos em dia', outros: 0 };
  }

  const pendentes = comValidade.filter((d) => d.situacao !== 'OK').length;
  return {
    situacao: maisUrgente.situacao,
    texto: `${maisUrgente.nome} ${descreverVencimento(maisUrgente.validade, hoje)}`,
    outros: pendentes - 1,
  };
}
