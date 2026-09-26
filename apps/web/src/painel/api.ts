import { CAMPO_DO_MES, intervaloDoMes, resumirMes, type ResumoMensal } from '@carga-certa/shared';

import { supabase } from '@/lib/supabase';

export const chavesPainel = {
  resumo: (mes: string) => ['painel', 'resumo', mes] as const,
};

/**
 * Busca o mes no servidor e delega o calculo a `resumirMes`, do pacote shared.
 *
 * O filtro por data aqui e so otimizacao - baixa um mes, e nao o historico
 * inteiro. A regra que vale e a de `resumirMes`, que refiltra pelo mesmo
 * intervalo e pelos mesmos campos (CAMPO_DO_MES). Por isso os campos abaixo sao
 * lidos pela constante: se a regra mudar de campo, o TypeScript acusa aqui se
 * o novo campo nao estiver no select.
 */
export async function carregarResumoDoMes(mes: string): Promise<ResumoMensal> {
  const { inicio, fim } = intervaloDoMes(mes);
  const de = inicio.toISOString();
  const ate = fim.toISOString();

  const [despesas, receitas, viagens] = await Promise.all([
    supabase
      .from('despesa')
      .select('valor, status, data_hora')
      .is('deleted_at', null)
      .gte(CAMPO_DO_MES.despesa, de)
      .lt(CAMPO_DO_MES.despesa, ate),

    // gte em recebido_em ja deixa de fora a receita sem data - a que ainda nao
    // foi recebida e, portanto, nao "entrou".
    supabase
      .from('receita')
      .select('valor, recebido_em')
      .is('deleted_at', null)
      .gte(CAMPO_DO_MES.receita, de)
      .lt(CAMPO_DO_MES.receita, ate),

    supabase
      .from('viagem')
      .select('status, inicio_em, km_total')
      .is('deleted_at', null)
      .neq('status', 'CANCELADA')
      .gte(CAMPO_DO_MES.viagem, de)
      .lt(CAMPO_DO_MES.viagem, ate),
  ]);

  for (const r of [despesas, receitas, viagens]) {
    if (r.error) throw new Error(r.error.message);
  }

  return resumirMes({
    mes,
    despesas: (despesas.data ?? []).map((d) => ({
      valor: d.valor,
      status: d.status,
      dataHora: d[CAMPO_DO_MES.despesa],
    })),
    receitas: (receitas.data ?? []).map((r) => ({
      valor: r.valor,
      recebidoEm: r[CAMPO_DO_MES.receita],
    })),
    viagens: (viagens.data ?? []).map((v) => ({
      status: v.status,
      inicioEm: v[CAMPO_DO_MES.viagem],
      kmTotal: v.km_total,
    })),
  });
}
