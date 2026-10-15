import {
  parseNumericOu0,
  uuidv7,
  type FormaPagamento,
  type StatusFrete,
  type TipoReceita,
} from '@carga-certa/shared';

import type { RegistroFrete } from '@/fretes/esquema';
import { supabase } from '@/lib/supabase';
import {
  COLUNAS_VIAGEM,
  apagarComAsViagens,
  concluirViagem,
  gravarPeloPush,
  idsAtivos,
  normalizarViagem,
  ultimasPosicoes,
  type PosicaoAtual,
  type ViagemNaTela,
} from '@/viagens/api';
import type { RegistroViagem } from '@/viagens/esquema';

/**
 * Consultas e gravacoes da tela de fretes.
 *
 * No web, frete e viagem andam juntos: um card e um frete com a sua viagem
 * (no maximo uma, por ux_viagem_frete). A viagem sem frete fica na tela de
 * Viagens. O que e da viagem (colunas, posicao, despesas) vem de viagens/api.ts.
 */

export const chavesFretes = {
  todos: ['fretes'] as const,
  lista: ['fretes', 'lista'] as const,
};

// ------------------------------------------------------------------ lista ---

export interface Recebimento {
  id: string;
  tipo: TipoReceita;
  valor: number;
  forma_recebimento: FormaPagamento;
  /** Nulo = lancado, ainda nao caiu. */
  recebido_em: string | null;
  observacao: string | null;
}

export interface FreteDaLista {
  id: string;
  valor_total: number;
  status: StatusFrete;
  contratante_id: string | null;
  /** Vem mesmo se o contratante foi excluido: o frete antigo continua com o nome. */
  contratante: { id: string; nome: string } | null;
  viagem: ViagemNaTela | null;
  recebimentos: Recebimento[];
  posicao: PosicaoAtual | null;
  created_at: string;
}

export async function listarFretes(): Promise<FreteDaLista[]> {
  const { data, error } = await supabase
    .from('frete')
    .select(
      `id, valor_total, status, contratante_id, created_at,
       contratante:contratante ( id, nome ),
       viagens:viagem ( ${COLUNAS_VIAGEM} ),
       recebimentos:receita ( id, tipo, valor, forma_recebimento, recebido_em, observacao, deleted_at )`,
    )
    .is('deleted_at', null)
    // Sem estes filtros, viagem e recebimento excluidos continuariam no card.
    .is('viagens.deleted_at', null)
    .is('recebimentos.deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  type Linha = Omit<FreteDaLista, 'viagem' | 'recebimentos' | 'posicao'> & {
    viagens: (ViagemNaTela & { deleted_at: string | null })[] | null;
    recebimentos: (Recebimento & { deleted_at: string | null })[] | null;
  };

  const fretes = (data ?? []).map((bruta): FreteDaLista => {
    const linha = bruta as unknown as Linha;
    const viagem = (linha.viagens ?? []).find((v) => v.deleted_at === null) ?? null;
    return {
      id: linha.id,
      valor_total: parseNumericOu0(linha.valor_total),
      status: linha.status,
      contratante_id: linha.contratante_id,
      contratante: linha.contratante,
      created_at: linha.created_at,
      viagem: viagem ? normalizarViagem(viagem) : null,
      recebimentos: (linha.recebimentos ?? [])
        .filter((r) => r.deleted_at === null)
        .map((r) => ({ ...r, valor: parseNumericOu0(r.valor) })),
      posicao: null,
    };
  });

  // A ultima posicao vem da view, numa segunda consulta so para as viagens da
  // tela. Ver a migration 20260929230000 para o motivo de nao estar na viagem.
  const posicoes = await ultimasPosicoes(fretes.flatMap((f) => (f.viagem ? [f.viagem.id] : [])));
  for (const f of fretes) {
    if (f.viagem) f.posicao = posicoes.get(f.viagem.id) ?? null;
  }

  // Mais recente primeiro, pela data de inicio da viagem.
  return fretes.sort((a, b) => chaveDeOrdem(b).localeCompare(chaveDeOrdem(a)));
}

function chaveDeOrdem(f: FreteDaLista): string {
  return f.viagem?.inicio_em ?? f.created_at;
}

// --------------------------------------------------------------- gravacao ---

/**
 * Grava frete e viagem numa chamada so, pelo `push_changes`: duas gravacoes
 * separadas poderiam deixar um frete sem viagem se a segunda falhasse. Ver
 * gravarPeloPush.
 */
export function salvarFrete(frete: RegistroFrete, viagem: RegistroViagem): Promise<void> {
  return gravarPeloPush(
    { frete: [frete], viagem: [viagem] },
    'O veículo ou o contratante escolhido foi excluído. Escolha outro.',
  );
}

/**
 * "Frete concluido", o botao do detalhe: frete e viagem concluidos sem abrir o
 * formulario. Sao dois updates (ver concluirViagem), a viagem primeiro: se o
 * do frete falhar, o card continua aberto e o botao continua la para tentar
 * de novo - o contrario deixaria a viagem aberta sem botao para fecha-la.
 */
export async function concluirFrete(frete: Pick<FreteDaLista, 'id' | 'viagem'>): Promise<void> {
  if (frete.viagem) await concluirViagem(frete.viagem);
  const { error } = await supabase.from('frete').update({ status: 'CONCLUIDO' }).eq('id', frete.id);
  if (error) throw new Error(error.message);
}

/**
 * Apaga o frete com a viagem dele, os recebimentos e as cargas, numa transacao
 * so; as despesas da viagem ficam, sem viagem. Ver apagarComAsViagens.
 *
 * Os recebimentos saem porque o banco os apagaria junto (on delete cascade), e
 * porque o "Entrou" do Painel conta recebimento sem olhar o frete.
 */
export async function apagarFrete(frete: Pick<FreteDaLista, 'id' | 'viagem'>): Promise<void> {
  const [receitas, cargas] = await Promise.all([
    idsAtivos('receita', 'frete_id', [frete.id]),
    idsAtivos('carga', 'frete_id', [frete.id]),
  ]);
  await apagarComAsViagens(
    frete.viagem ? [frete.viagem.id] : [],
    { frete: [frete.id], receita: receitas, carga: cargas },
    'Este frete não pôde ser apagado. Recarregue a página.',
  );
}

// --------------------------------------------------------- recebimentos ---

export interface DadosRecebimento {
  id: string;
  frete_id: string;
  tipo: TipoReceita;
  valor: number;
  forma_recebimento: FormaPagamento;
  recebido_em: string | null;
  observacao: string | null;
}

export async function salvarRecebimento(dados: DadosRecebimento): Promise<void> {
  const { error } = await supabase.from('receita').upsert(dados, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

/**
 * "Valor recebido", o botao do detalhe: o que planoDoValorRecebido mandar,
 * caido agora. O saldo novo vai por Pix - o caso comum; outro valor ou outra
 * forma se corrige na lista de recebimentos. Um upsert so, para nao ficar
 * metade confirmada.
 */
export async function receberOQueFalta(
  freteId: string,
  plano: { confirmar: Recebimento[]; saldoNovo: number },
): Promise<void> {
  const agora = new Date().toISOString();
  const linhas: DadosRecebimento[] = plano.confirmar.map((r) => ({
    id: r.id,
    frete_id: freteId,
    tipo: r.tipo,
    valor: r.valor,
    forma_recebimento: r.forma_recebimento,
    recebido_em: agora,
    observacao: r.observacao,
  }));
  if (plano.saldoNovo > 0) {
    linhas.push({
      id: uuidv7(),
      frete_id: freteId,
      tipo: 'SALDO',
      valor: plano.saldoNovo,
      forma_recebimento: 'PIX',
      recebido_em: agora,
      observacao: null,
    });
  }
  if (linhas.length === 0) return;

  const { error } = await supabase.from('receita').upsert(linhas, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export async function excluirRecebimento(id: string): Promise<void> {
  const { error } = await supabase
    .from('receita')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
