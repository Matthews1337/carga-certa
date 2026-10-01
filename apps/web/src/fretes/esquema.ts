import {
  dataLocal,
  parseValorDigitado,
  type StatusFrete,
  type StatusViagem,
} from '@carga-certa/shared';
import { z } from 'zod';

/**
 * Regras do formulario de frete e a conversao para as linhas do banco.
 *
 * No web, o frete (o contrato: quem paga, quanto) e a viagem (a execucao: que
 * caminhao, de onde para onde) sao um formulario so. Por isso uma "situacao"
 * so, que vira o status dos dois.
 */

export const SEM_VINCULO = 'nenhum';

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

const lugar = z.object({ nome: z.string(), lat: z.number(), lng: z.number() });
export type LugarDoFrete = z.infer<typeof lugar>;

export const esquemaFrete = z.object({
  origem: lugar.nullable().refine((v): boolean => v !== null, 'Marque onde o frete começa'),
  destino: lugar.nullable().refine((v): boolean => v !== null, 'Marque onde o frete termina'),
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

/** Rota calculada pelo ORS, ja simplificada. Nula se o calculo falhou. */
export interface RotaDoFrete {
  polyline: string;
  distanciaKm: number;
}

// `type`, e nao `interface`: vao como JSON para o push_changes, e so tipo
// literal e aceito onde o supabase-js espera Json.
export type RegistroFrete = {
  id: string;
  contratante_id: string | null;
  valor_total: number;
  status: StatusFrete;
};

export type RegistroViagem = {
  id: string;
  frete_id: string;
  veiculo_tracao_id: string;
  veiculo_reboque_id: string | null;
  inicio_em: string;
  status: StatusViagem;
  origem_nome: string;
  origem_lat: number;
  origem_lng: number;
  destino_nome: string;
  destino_lat: number;
  destino_lng: number;
  rota_polyline: string | null;
  km_previsto: number | null;
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
 *  - a data de inicio so muda se o usuario mudou o DIA. A viagem iniciada pelo
 *    celular as 05:32 continua 05:32 depois de editar o valor do frete;
 *  - o status da viagem so muda se o usuario mudou a situacao. Uma viagem
 *    PAUSADA no celular nao volta a EM_ANDAMENTO porque alguem corrigiu o
 *    contratante no web.
 */
export function paraRegistros(
  campos: CamposFrete,
  rota: RotaDoFrete | null,
  ids: { frete: string; viagem: string },
  original?: Original,
): { frete: RegistroFrete; viagem: RegistroViagem } {
  const { origem, destino } = campos;
  if (!origem || !destino) throw new Error('Origem e destino sao obrigatorios');

  const mesmoDia = original?.inicioEm ? diaLocal(original.inicioEm) === campos.inicio : false;
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
      inicio_em: mesmoDia && original?.inicioEm ? original.inicioEm : meioDiaLocal(campos.inicio),
      status: mesmaSituacao && original ? original.statusViagem : STATUS_DA_VIAGEM[campos.situacao],
      origem_nome: origem.nome,
      origem_lat: arredondarCoordenada(origem.lat),
      origem_lng: arredondarCoordenada(origem.lng),
      destino_nome: destino.nome,
      destino_lat: arredondarCoordenada(destino.lat),
      destino_lng: arredondarCoordenada(destino.lng),
      rota_polyline: rota?.polyline ?? null,
      km_previsto: rota ? Math.round(rota.distanciaKm * 10) / 10 : null,
    },
  };
}

/**
 * 'AAAA-MM-DD' -> instante ao MEIO-DIA local.
 *
 * Meia-noite seria o obvio, e erraria o mes: 01/10 a 00:00 em Brasilia ainda e
 * 30/09 as 23:00 em Manaus, e o frete apareceria no mes anterior para quem
 * abrisse o app de la. Meio-dia fica no mesmo dia em qualquer fuso do Brasil.
 */
export function meioDiaLocal(dia: string): string {
  const d = dataLocal(dia);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

/** Instante ISO -> 'AAAA-MM-DD' no fuso do navegador. */
export function diaLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A coluna e numeric(9,6): mais casas o banco arredondaria do jeito dele. */
function arredondarCoordenada(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}
