import {
  parseNumeric,
  parseNumericOu0,
  somar,
  type EscopoCategoria,
  type Json,
  type StatusDespesa,
  type StatusViagem,
} from '@carga-certa/shared';

import { supabase } from '@/lib/supabase';
import type { RegistroViagem } from '@/viagens/esquema';

/**
 * Consultas e gravacoes de viagem.
 *
 * A tela de Viagens lista as viagens SEM frete (deslocamento vazio, retorno,
 * oficina). As partes que a tela de Fretes tambem usa - colunas da viagem,
 * ultima posicao do celular, despesas da viagem, gravacao pelo push - moram
 * aqui, para as duas telas lerem e gravarem a viagem do mesmo jeito.
 */

export const chavesViagens = {
  todos: ['viagens'] as const,
  lista: ['viagens', 'lista'] as const,
  despesas: (viagemId: string) => ['viagens', 'despesas', viagemId] as const,
};

// ---------------------------------------------------------------- viagem ---

export interface ViagemNaTela {
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

export interface PosicaoAtual {
  latitude: number;
  longitude: number;
  registrado_em: string;
}

/** Colunas de ViagemNaTela, mais deleted_at para filtrar o embed. */
export const COLUNAS_VIAGEM = `id, status, inicio_em, km_total, km_previsto,
  origem_nome, origem_lat, origem_lng, destino_nome, destino_lat, destino_lng,
  rota_polyline, veiculo_tracao_id, veiculo_reboque_id, deleted_at`;

/** numeric pode chegar como string; aqui vira number (ou null). */
export function normalizarViagem(v: ViagemNaTela): ViagemNaTela {
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

/**
 * Ultima posicao do celular em cada viagem, pela view vw_posicao_atual. Fica
 * fora da viagem de proposito: ver a migration 20260929230000.
 */
export async function ultimasPosicoes(viagemIds: string[]): Promise<Map<string, PosicaoAtual>> {
  const mapa = new Map<string, PosicaoAtual>();
  if (viagemIds.length === 0) return mapa;

  const { data, error } = await supabase
    .from('vw_posicao_atual')
    .select('viagem_id, latitude, longitude, registrado_em')
    .in('viagem_id', viagemIds);
  if (error) throw new Error(error.message);

  for (const p of data ?? []) {
    const lat = parseNumeric(p.latitude);
    const lng = parseNumeric(p.longitude);
    if (p.viagem_id && lat !== null && lng !== null && p.registrado_em) {
      mapa.set(p.viagem_id, { latitude: lat, longitude: lng, registrado_em: p.registrado_em });
    }
  }
  return mapa;
}

// ------------------------------------------------------- viagens sem frete ---

export interface ViagemDaLista extends ViagemNaTela {
  created_at: string;
  /** Soma das despesas da viagem, sem as canceladas. */
  gastos: number;
  posicao: PosicaoAtual | null;
}

export async function listarViagensSemFrete(): Promise<ViagemDaLista[]> {
  const { data, error } = await supabase
    .from('viagem')
    .select(`${COLUNAS_VIAGEM}, created_at, despesas:despesa ( valor, status, deleted_at )`)
    .is('deleted_at', null)
    .is('frete_id', null)
    // Sem este filtro, despesa excluida entraria nos gastos do card.
    .is('despesas.deleted_at', null);

  if (error) throw new Error(error.message);

  type Linha = ViagemNaTela & {
    created_at: string;
    despesas: { valor: number | string; status: StatusDespesa; deleted_at: string | null }[] | null;
  };

  const viagens = (data ?? []).map((bruta): ViagemDaLista => {
    const linha = bruta as unknown as Linha;
    const despesas = (linha.despesas ?? []).filter((d) => d.deleted_at === null);
    return {
      ...normalizarViagem(linha),
      created_at: linha.created_at,
      // Mesmo corte da tela de Despesas e do Painel: cancelada nao conta.
      gastos: somar(despesas.filter((d) => d.status !== 'CANCELADA').map((d) => d.valor)),
      posicao: null,
    };
  });

  const posicoes = await ultimasPosicoes(viagens.map((v) => v.id));
  for (const v of viagens) v.posicao = posicoes.get(v.id) ?? null;

  // Mais recente primeiro, pela data de inicio.
  const chave = (v: ViagemDaLista) => v.inicio_em ?? v.created_at;
  return viagens.sort((a, b) => chave(b).localeCompare(chave(a)));
}

// --------------------------------------------------------------- gravacao ---

/**
 * Grava pelo `push_changes`, a mesma RPC do sync do celular: uma transacao, com
 * a RLS valendo, gravando o pai antes do filho (frete antes da viagem). E
 * upsert que so toca nas colunas enviadas - o que o celular gravou
 * (odometros, fim) fica.
 */
export async function gravarPeloPush(
  changes: Record<string, Record<string, unknown>[]>,
  seRecusarDono: string,
): Promise<void> {
  const payload = Object.fromEntries(
    Object.entries(changes).map(([tabela, linhas]) => [tabela, { created: [], updated: linhas, deleted: [] }]),
  );
  const { error } = await supabase.rpc('push_changes', { changes: payload as Json });
  if (error) {
    // valida_parente: veiculo ou contratante excluido entre abrir e salvar.
    if (error.code === '42501') throw new Error(seRecusarDono);
    throw new Error(error.message);
  }
}

export function salvarViagem(viagem: RegistroViagem): Promise<void> {
  return gravarPeloPush({ viagem: [viagem] }, 'O veículo escolhido foi excluído. Escolha outro.');
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
