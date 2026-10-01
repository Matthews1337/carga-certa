import {
  parseNumeric,
  parseNumericOu0,
  type EscopoCategoria,
  type FormaPagamento,
  type StatusDespesa,
  type StatusFrete,
  type StatusViagem,
  type TipoReceita,
} from '@carga-certa/shared';

import type { RegistroFrete, RegistroViagem } from '@/fretes/esquema';
import { supabase } from '@/lib/supabase';

/**
 * Consultas e gravacoes da tela de fretes.
 *
 * No web, frete e viagem andam juntos: um card e um frete com a sua viagem
 * (no maximo uma, por ux_viagem_frete). Viagem sem frete - retorno vazio - e
 * coisa do celular e nao aparece aqui.
 */

export const chavesFretes = {
  todos: ['fretes'] as const,
  lista: ['fretes', 'lista'] as const,
  despesas: (viagemId: string) => ['fretes', 'despesas', viagemId] as const,
};

// ------------------------------------------------------------------ lista ---

export interface ViagemDoFrete {
  id: string;
  status: StatusViagem;
  inicio_em: string | null;
  /** Dos odometros; nulo ate a viagem terminar. */
  km_total: number | null;
  km_previsto: number | null;
  origem_nome: string | null;
  origem_lat: number | null;
  origem_lng: number | null;
  destino_nome: string | null;
  destino_lat: number | null;
  destino_lng: number | null;
  rota_polyline: string | null;
  veiculo_tracao_id: string;
  veiculo_reboque_id: string | null;
}

export interface Recebimento {
  id: string;
  tipo: TipoReceita;
  valor: number;
  forma_recebimento: FormaPagamento;
  /** Nulo = lancado, ainda nao caiu. */
  recebido_em: string | null;
  observacao: string | null;
}

export interface PosicaoAtual {
  latitude: number;
  longitude: number;
  registrado_em: string;
}

export interface FreteDaLista {
  id: string;
  valor_total: number;
  status: StatusFrete;
  contratante_id: string | null;
  /** Vem mesmo se o contratante foi excluido: o frete antigo continua com o nome. */
  contratante: { id: string; nome: string } | null;
  viagem: ViagemDoFrete | null;
  recebimentos: Recebimento[];
  posicao: PosicaoAtual | null;
  created_at: string;
}

const COLUNAS_VIAGEM = `id, status, inicio_em, km_total, km_previsto,
  origem_nome, origem_lat, origem_lng, destino_nome, destino_lat, destino_lng,
  rota_polyline, veiculo_tracao_id, veiculo_reboque_id, deleted_at`;

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
    viagens: (ViagemDoFrete & { deleted_at: string | null })[] | null;
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
  const ids = fretes.flatMap((f) => (f.viagem ? [f.viagem.id] : []));
  if (ids.length > 0) {
    const posicoes = await ultimasPosicoes(ids);
    for (const f of fretes) {
      if (f.viagem) f.posicao = posicoes.get(f.viagem.id) ?? null;
    }
  }

  // Mais recente primeiro, pela data de inicio da viagem.
  return fretes.sort((a, b) => chaveDeOrdem(b).localeCompare(chaveDeOrdem(a)));
}

function chaveDeOrdem(f: FreteDaLista): string {
  return f.viagem?.inicio_em ?? f.created_at;
}

function normalizarViagem(v: ViagemDoFrete): ViagemDoFrete {
  return {
    id: v.id,
    status: v.status,
    inicio_em: v.inicio_em,
    km_total: parseNumeric(v.km_total),
    km_previsto: parseNumeric(v.km_previsto),
    origem_nome: v.origem_nome,
    origem_lat: parseNumeric(v.origem_lat),
    origem_lng: parseNumeric(v.origem_lng),
    destino_nome: v.destino_nome,
    destino_lat: parseNumeric(v.destino_lat),
    destino_lng: parseNumeric(v.destino_lng),
    rota_polyline: v.rota_polyline,
    veiculo_tracao_id: v.veiculo_tracao_id,
    veiculo_reboque_id: v.veiculo_reboque_id,
  };
}

async function ultimasPosicoes(viagemIds: string[]): Promise<Map<string, PosicaoAtual>> {
  const { data, error } = await supabase
    .from('vw_posicao_atual')
    .select('viagem_id, latitude, longitude, registrado_em')
    .in('viagem_id', viagemIds);
  if (error) throw new Error(error.message);

  const mapa = new Map<string, PosicaoAtual>();
  for (const p of data ?? []) {
    const lat = parseNumeric(p.latitude);
    const lng = parseNumeric(p.longitude);
    if (p.viagem_id && lat !== null && lng !== null && p.registrado_em) {
      mapa.set(p.viagem_id, { latitude: lat, longitude: lng, registrado_em: p.registrado_em });
    }
  }
  return mapa;
}

// --------------------------------------------------------------- gravacao ---

/**
 * Grava frete e viagem numa chamada so, pelo `push_changes` - a mesma RPC do
 * sync do celular.
 *
 * Duas gravacoes separadas pelo PostgREST poderiam deixar um frete sem viagem
 * se a segunda falhasse. A RPC roda numa transacao, com a RLS valendo, e desde
 * a migration 20260929230000 grava na ordem de dependencia: o frete antes da
 * viagem que aponta para ele. E upsert: serve para criar e para editar, e so
 * toca nas colunas enviadas - o que o celular gravou (odometros, fim) fica.
 */
export async function salvarFrete(frete: RegistroFrete, viagem: RegistroViagem): Promise<void> {
  const { error } = await supabase.rpc('push_changes', {
    changes: {
      frete: { created: [], updated: [frete], deleted: [] },
      viagem: { created: [], updated: [viagem], deleted: [] },
    },
  });
  if (error) {
    // valida_parente: veiculo ou contratante excluido entre abrir e salvar.
    if (error.code === '42501') {
      throw new Error('O veículo ou o contratante escolhido foi excluído. Escolha outro.');
    }
    throw new Error(error.message);
  }
}

// ------------------------------------------------------------- despesas ---

export interface DespesaDaViagem {
  id: string;
  valor: number;
  status: StatusDespesa;
  data_hora: string;
  descricao: string | null;
  categoria: { nome: string; escopo: EscopoCategoria } | null;
}

export async function listarDespesasDaViagem(viagemId: string): Promise<DespesaDaViagem[]> {
  const { data, error } = await supabase
    .from('despesa')
    .select('id, valor, status, data_hora, descricao, categoria:categoria_despesa ( nome, escopo )')
    .eq('viagem_id', viagemId)
    .is('deleted_at', null)
    .order('data_hora', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => ({
    ...(d as unknown as DespesaDaViagem),
    valor: parseNumericOu0(d.valor),
  }));
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

export async function excluirRecebimento(id: string): Promise<void> {
  const { error } = await supabase
    .from('receita')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
