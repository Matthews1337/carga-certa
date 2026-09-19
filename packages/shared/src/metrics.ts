/**
 * Indicadores da viagem: consumo, custo por km e resultado.
 *
 * Estes calculos existem em dois lugares de proposito. No banco, a view
 * `vw_resultado_viagem` responde ao web com dados ja consolidados. Aqui, o
 * mobile calcula o mesmo em cima do SQLite local, offline, sem esperar rede.
 * Os dois precisam dar o mesmo numero - por isso os cortes replicados abaixo
 * (`deleted_at is null`, `status <> 'CANCELADA'`) seguem a view ao pe da letra.
 */

import { arredondar, somar } from './numeric';
import type { EscopoCategoria, StatusDespesa } from './enums';

// -----------------------------------------------------------------------------
// Consumo de combustivel
// -----------------------------------------------------------------------------

export interface AbastecimentoParaConsumo {
  odometro: number;
  litros: number;
  /** `abastecimento.tanque_cheio`. Sem isso nao ha como fechar o consumo. */
  tanqueCheio: boolean;
}

export interface SegmentoConsumo {
  odometroInicial: number;
  odometroFinal: number;
  km: number;
  litros: number;
  kmPorLitro: number;
}

/**
 * Quebra os abastecimentos em trechos de tanque cheio a tanque cheio.
 *
 * Por que so entre tanques cheios: ninguem sabe quanto sobrou no tanque no
 * momento do abastecimento parcial. Com o tanque cheio nas duas pontas, o
 * volume inicial e o final sao identicos, entao tudo que entrou no meio foi
 * exatamente o que se queimou no percurso - e ai o km/L e um numero real, nao
 * uma estimativa.
 *
 * Os litros do trecho incluem o abastecimento que o fecha e excluem o que o
 * abre, porque o combustivel do primeiro tanque cheio ja estava no veiculo
 * antes do trecho comecar.
 */
export function calcularSegmentosConsumo(
  abastecimentos: readonly AbastecimentoParaConsumo[],
): SegmentoConsumo[] {
  const ordenados = [...abastecimentos].sort((a, b) => a.odometro - b.odometro);
  const segmentos: SegmentoConsumo[] = [];

  let odometroAbertura: number | null = null;
  let litrosAcumulados = 0;

  for (const ab of ordenados) {
    if (odometroAbertura !== null) {
      litrosAcumulados += ab.litros;
    }

    if (!ab.tanqueCheio) continue;

    if (odometroAbertura !== null) {
      const km = ab.odometro - odometroAbertura;
      // km <= 0 e odometro digitado errado ou troca de veiculo na mesma lista.
      // Descartar o trecho e melhor que exibir um consumo impossivel.
      if (km > 0 && litrosAcumulados > 0) {
        segmentos.push({
          odometroInicial: odometroAbertura,
          odometroFinal: ab.odometro,
          km,
          litros: arredondar(litrosAcumulados, 3),
          kmPorLitro: arredondar(km / litrosAcumulados, 3),
        });
      }
    }

    // Todo tanque cheio fecha um trecho e abre o proximo.
    odometroAbertura = ab.odometro;
    litrosAcumulados = 0;
  }

  return segmentos;
}

/**
 * Consumo medio ponderado. Soma km e litros de todos os trechos antes de
 * dividir - a media das medias daria peso igual a um trecho de 50 km e a um de
 * 1.200 km, e o resultado nao bateria com o total de diesel gasto.
 *
 * Devolve null quando nao ha nenhum trecho fechado: melhor mostrar travessao na
 * tela do que um numero que o motorista nao consegue conferir.
 */
export function calcularConsumoMedio(
  abastecimentos: readonly AbastecimentoParaConsumo[],
): number | null {
  const segmentos = calcularSegmentosConsumo(abastecimentos);
  if (segmentos.length === 0) return null;

  let km = 0;
  let litros = 0;
  for (const s of segmentos) {
    km += s.km;
    litros += s.litros;
  }

  return litros > 0 ? arredondar(km / litros, 3) : null;
}

export function precoMedioLitro(
  abastecimentos: readonly { litros: number; precoLitro: number }[],
): number | null {
  let litros = 0;
  let gasto = 0;
  for (const a of abastecimentos) {
    litros += a.litros;
    gasto += a.litros * a.precoLitro;
  }
  return litros > 0 ? arredondar(gasto / litros, 3) : null;
}

// -----------------------------------------------------------------------------
// Resultado da viagem
// -----------------------------------------------------------------------------

export interface DespesaParaResultado {
  valor: number | string;
  status: StatusDespesa;
  /** Vem de `categoria_despesa.escopo`. Separa gasto do caminhao do gasto do piloto. */
  escopo: EscopoCategoria;
}

export interface ResumoDespesas {
  total: number;
  veiculo: number;
  pessoal: number;
  admin: number;
}

/**
 * Soma as despesas por escopo, ignorando as canceladas - exatamente o filtro
 * `de.status <> 'CANCELADA'` da view. Despesa PENDENTE entra: o dinheiro ja
 * saiu, so o comprovante e que nao foi conferido.
 */
export function resumirDespesas(despesas: readonly DespesaParaResultado[]): ResumoDespesas {
  const vivas = despesas.filter((d) => d.status !== 'CANCELADA');
  const porEscopo = (escopo: EscopoCategoria) =>
    somar(vivas.filter((d) => d.escopo === escopo).map((d) => d.valor));

  return {
    total: somar(vivas.map((d) => d.valor)),
    veiculo: porEscopo('VEICULO'),
    pessoal: porEscopo('PESSOAL'),
    admin: porEscopo('ADMIN'),
  };
}

export interface ResultadoViagem {
  receitaTotal: number;
  despesaTotal: number;
  despesaVeiculo: number;
  despesaPessoal: number;
  lucroLiquido: number;
  /** null quando a viagem ainda nao tem odometro final. */
  custoPorKm: number | null;
  /** Lucro sobre receita, em porcentagem. null quando nao houve receita. */
  margemPercentual: number | null;
}

export function calcularResultadoViagem(params: {
  receitas: readonly (number | string)[];
  despesas: readonly DespesaParaResultado[];
  kmTotal: number | null;
}): ResultadoViagem {
  const receitaTotal = somar(params.receitas);
  const d = resumirDespesas(params.despesas);
  const lucroLiquido = arredondar(receitaTotal - d.total);
  const km = params.kmTotal;

  return {
    receitaTotal,
    despesaTotal: d.total,
    despesaVeiculo: d.veiculo,
    despesaPessoal: d.pessoal,
    lucroLiquido,
    custoPorKm: km !== null && km > 0 ? arredondar(d.total / km, 4) : null,
    margemPercentual: receitaTotal > 0 ? arredondar((lucroLiquido / receitaTotal) * 100, 2) : null,
  };
}

/**
 * Quanto sobra por km rodado. E o numero que diz se vale aceitar o proximo
 * frete: se o lucro por km for menor que o custo por km do retorno vazio, a
 * viagem da prejuizo mesmo com o frete parecendo bom.
 */
export function lucroPorKm(lucroLiquido: number, kmTotal: number | null): number | null {
  if (kmTotal === null || kmTotal <= 0) return null;
  return arredondar(lucroLiquido / kmTotal, 4);
}
