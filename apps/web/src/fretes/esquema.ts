import { parseValorDigitado, type StatusFrete, type StatusViagem } from '@carga-certa/shared';
import { z } from 'zod';

import {
  SEM_VINCULO,
  inicioDaViagem,
  lugarObrigatorio,
  trechoDaViagem,
  type RegistroViagem,
  type RotaParaGravar,
} from '@/viagens/esquema';

/**
 * Regras do formulario de frete e a conversao para as linhas do banco.
 *
 * No web, o frete (o contrato: quem paga, quanto) e a viagem (a execucao: que
 * caminhao, de onde para onde) sao um formulario so. Por isso uma "situacao"
 * so, que vira o status dos dois. O que e da viagem (lugar, rota, datas) vem de
 * viagens/esquema.ts, o mesmo da tela de Viagens.
 */

/** As situacoes que o web oferece. RASCUNHO existe no banco, mas nao aqui. */
export const SITUACOES_FRETE = ['CONTRATADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO'] as const;
export type SituacaoFrete = (typeof SITUACOES_FRETE)[number];

/**
 * A viagem acompanha o frete. Importa para o Painel: viagem cancelada nao conta
 * no mes, e concluida conta como concluida.
 */
export const STATUS_DA_VIAGEM: Record<SituacaoFrete, StatusViagem> = {
  CONTRATADO: 'PLANEJADA',
  EM_ANDAMENTO: 'EM_ANDAMENTO',
  CONCLUIDO: 'CONCLUIDA',
  CANCELADO: 'CANCELADA',
};

export const esquemaFrete = z.object({
  origem: lugarObrigatorio('Marque onde o frete começa'),
  destino: lugarObrigatorio('Marque onde o frete termina'),
  veiculoTracaoId: z.string().uuid('Escolha o caminhão ou o cavalo'),
  veiculoReboqueId: z.string(),
  contratanteId: z.string(),
  valor: z
    .string()
    .min(1, 'Informe o valor combinado')
    .refine((v) => {
      const n = parseValorDigitado(v);
      return n !== null && n > 0;
    }, 'Valor inválido'),
  /** 'AAAA-MM-DD' do <input type="date">. */
  inicio: z.string().min(1, 'Informe a data de início'),
  situacao: z.enum(SITUACOES_FRETE),
});

export type CamposFrete = z.infer<typeof esquemaFrete>;

// `type`, e nao `interface`: vai como JSON para o push_changes, e so tipo
// literal e aceito onde o supabase-js espera Json.
export type RegistroFrete = {
  id: string;
  contratante_id: string | null;
  valor_total: number;
  status: StatusFrete;
};

/** O que ja estava gravado, para a edicao nao atropelar o que o celular fez. */
export interface Original {
  situacao: SituacaoFrete;
  statusViagem: StatusViagem;
  inicioEm: string | null;
}

/**
 * Converte o formulario nas duas linhas.
 *
 * Duas protecoes na edicao, para nao desfazer o que veio do celular:
 *  - a data de inicio so muda se o usuario mudou o DIA (inicioDaViagem);
 *  - o status da viagem so muda se o usuario mudou a situacao. Uma viagem
 *    PAUSADA no celular nao volta a EM_ANDAMENTO porque alguem corrigiu o
 *    contratante no web.
 */
export function paraRegistros(
  campos: CamposFrete,
  rota: RotaParaGravar | null,
  ids: { frete: string; viagem: string },
  original?: Original,
): { frete: RegistroFrete; viagem: RegistroViagem } {
  const { origem, destino } = campos;
  if (!origem || !destino) throw new Error('Origem e destino sao obrigatorios');

  const mesmaSituacao = original ? original.situacao === campos.situacao : false;

  return {
    frete: {
      id: ids.frete,
      contratante_id: campos.contratanteId === SEM_VINCULO ? null : campos.contratanteId,
      valor_total: parseValorDigitado(campos.valor) ?? 0,
      status: campos.situacao,
    },
    viagem: {
      id: ids.viagem,
      frete_id: ids.frete,
      veiculo_tracao_id: campos.veiculoTracaoId,
      veiculo_reboque_id: campos.veiculoReboqueId === SEM_VINCULO ? null : campos.veiculoReboqueId,
      inicio_em: inicioDaViagem(campos.inicio, original?.inicioEm),
      status: mesmaSituacao && original ? original.statusViagem : STATUS_DA_VIAGEM[campos.situacao],
      ...trechoDaViagem(origem, destino, rota),
    },
  };
}
