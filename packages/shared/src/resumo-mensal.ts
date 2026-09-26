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
    total: number;
    /** Viagens que entraram na soma de km. */
    viagensComKm: number;
    /** Viagens do mes ainda sem odometro final, e por isso fora da soma. */
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
  const kms = doMes.map((v) => parseNumeric(v.kmTotal));
  const conhecidos = kms.filter((k): k is number => k !== null);

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
      total: conhecidos.reduce((a, b) => a + b, 0),
      viagensComKm: conhecidos.length,
      viagensSemKm: kms.length - conhecidos.length,
    },
  };
}
