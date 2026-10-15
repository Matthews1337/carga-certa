/**
 * Resumo do mes para o Painel: o que entrou, o que saiu, viagens e km.
 *
 * Mora em packages/shared porque o app mobile precisa dos mesmos numeros
 * offline, a partir do banco local. A regra fica escrita uma vez.
 *
 * A funcao recebe os registros e ela mesma aplica o filtro do mes. Quem busca
 * no servidor pode (e deve) pre-filtrar pelo mesmo intervalo para baixar menos
 * dado - mas a regra que vale e a daqui, e e ela que esta testada.
 */

import { DESPESA_CONTABILIZA, VIAGEM_ABERTA, type StatusDespesa, type StatusViagem } from './enums';
import { intervaloDoMes } from './mes';
import { deCentavos, paraCentavos, parseNumeric, somar } from './numeric';

/**
 * Qual campo define o mes de cada registro. Exportado para que a consulta ao
 * servidor filtre exatamente pelo mesmo campo que o calculo usa.
 *
 *   despesa -> data do gasto.
 *   receita -> data em que o dinheiro CAIU. Receita lancada e ainda nao
 *              recebida nao "entrou", e fica fora do mes.
 *   viagem  -> data de inicio. Uma viagem de 28/09 a 03/10 conta inteira em
 *              setembro: dividir os km entre meses exigiria o odometro dia a
 *              dia, que o app nao registra.
 *
 * Km de cada viagem: o do odometro (final - inicial) quando existe. Sem ele, a
 * distancia da rota calculada (km previsto) - mas so na viagem CONCLUIDA: a
 * planejada ou em andamento ainda nao rodou a rota inteira, e uma viagem
 * marcada para o fim do mes nao pode contar como rodada. O previsto e
 * estimativa e sai separado, para a tela poder dizer isso.
 */
export const CAMPO_DO_MES = {
  despesa: 'data_hora',
  receita: 'recebido_em',
  viagem: 'inicio_em',
} as const;

/** Aceita ISO do PostgREST, epoch em ms do WatermelonDB ou Date. */
type Instante = string | number | Date | null | undefined;

export interface DespesaParaResumo {
  valor: number | string;
  status: StatusDespesa;
  dataHora: Instante;
}

export interface ReceitaParaResumo {
  valor: number | string;
  recebidoEm: Instante;
}

export interface ViagemParaResumo {
  status: StatusViagem;
  inicioEm: Instante;
  /** Coluna gerada no banco (odometro final - inicial). Nulo sem odometro final. */
  kmTotal: number | string | null | undefined;
  /** Distancia da rota calculada. Usada so na viagem concluida sem odometro. */
  kmPrevisto?: number | string | null | undefined;
}

export interface ResumoMensal {
  entrou: number;
  saiu: number;
  /** entrou - saiu. Negativo quando o mes deu prejuizo. */
  saldo: number;
  viagens: {
    total: number;
    concluidas: number;
    /** Planejada, em andamento ou pausada. */
    emAberto: number;
  };
  km: {
    /** odometro + previsto. */
    total: number;
    /** Medido pelo odometro. */
    odometro: number;
    /** Estimado pela rota, nas viagens concluidas sem odometro. */
    previsto: number;
    viagensComOdometro: number;
    viagensComPrevisto: number;
    /** Fora da soma: sem odometro e ainda nao concluidas (ou concluidas sem rota). */
    viagensSemKm: number;
  };
}

function paraMs(valor: Instante): number | null {
  if (valor === null || valor === undefined) return null;
  const ms = valor instanceof Date ? valor.getTime() : typeof valor === 'number' ? valor : Date.parse(valor);
  return Number.isNaN(ms) ? null : ms;
}

export function resumirMes({
  mes,
  despesas,
  receitas,
  viagens,
}: {
  mes: string;
  despesas: readonly DespesaParaResumo[];
  receitas: readonly ReceitaParaResumo[];
  viagens: readonly ViagemParaResumo[];
}): ResumoMensal {
  const { inicio, fim } = intervaloDoMes(mes);
  const noMes = (valor: Instante) => {
    const ms = paraMs(valor);
    return ms !== null && ms >= inicio.getTime() && ms < fim.getTime();
  };

  // Saiu: canceladas ficam fora; pendentes entram - o dinheiro ja saiu, so o
  // comprovante e que nao foi conferido. Mesmo corte da tela de Despesas e da
  // view vw_resultado_viagem.
  const saiu = somar(
    despesas
      .filter((d) => noMes(d.dataHora) && DESPESA_CONTABILIZA.includes(d.status))
      .map((d) => d.valor),
  );

  // Entrou: so receita com data de recebimento no mes. Sem data = ainda nao
  // recebida, e noMes(null) e falso.
  const entrou = somar(receitas.filter((r) => noMes(r.recebidoEm)).map((r) => r.valor));

  const doMes = viagens.filter((v) => noMes(v.inicioEm) && v.status !== 'CANCELADA');
  let odometro = 0;
  let previsto = 0;
  let viagensComOdometro = 0;
  let viagensComPrevisto = 0;
  for (const v of doMes) {
    const medido = parseNumeric(v.kmTotal);
    const estimado = v.status === 'CONCLUIDA' ? parseNumeric(v.kmPrevisto) : null;
    if (medido !== null) {
      odometro += medido;
      viagensComOdometro += 1;
    } else if (estimado !== null) {
      previsto += estimado;
      viagensComPrevisto += 1;
    }
  }

  return {
    entrou,
    saiu,
    // Em centavos: 0.3 - 0.1 em ponto flutuante da 0.19999999999999998.
    saldo: deCentavos(paraCentavos(entrou) - paraCentavos(saiu)),
    viagens: {
      total: doMes.length,
      concluidas: doMes.filter((v) => v.status === 'CONCLUIDA').length,
      emAberto: doMes.filter((v) => VIAGEM_ABERTA.includes(v.status)).length,
    },
    km: {
      total: odometro + previsto,
      odometro,
      previsto,
      viagensComOdometro,
      viagensComPrevisto,
      viagensSemKm: doMes.length - viagensComOdometro - viagensComPrevisto,
    },
  };
}
