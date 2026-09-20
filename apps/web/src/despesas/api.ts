import {
  BUCKET_COMPROVANTES,
  caminhoComprovante,
  parseNumericOu0,
  uuidv7,
  type EscopoCategoria,
  type ExtensaoArquivo,
  type FormaPagamento,
  type StatusDespesa,
} from '@carga-certa/shared';

import { supabase } from '@/lib/supabase';

/**
 * Consultas e gravacoes de despesa.
 *
 * Duas regras valem para tudo aqui:
 *
 *   * `.is('deleted_at', null)` em TODA leitura. Nenhuma policy esconde
 *     registro excluido - se escondesse, a propria exclusao logica seria
 *     impossivel no Postgres.
 *   * `piloto_id` nunca e enviado. A coluna tem DEFAULT auth.uid() e a policy
 *     rejeita qualquer outro valor; mandar o campo so abriria espaco para erro.
 */

const SELECT_LISTA = `
  id, viagem_id, veiculo_id, categoria_id, valor, data_hora, forma_pagamento,
  descricao, comprovante_path, status,
  categoria:categoria_despesa!inner ( id, nome, escopo, is_padrao ),
  viagem:viagem ( id, status ),
  veiculo:veiculo ( id, placa, marca, modelo )
` as const;

export interface DespesaDaLista {
  id: string;
  viagem_id: string | null;
  veiculo_id: string | null;
  categoria_id: string;
  valor: number;
  data_hora: string;
  forma_pagamento: FormaPagamento;
  descricao: string | null;
  comprovante_path: string | null;
  status: StatusDespesa;
  categoria: { id: string; nome: string; escopo: EscopoCategoria; is_padrao: boolean } | null;
  viagem: { id: string; status: string } | null;
  veiculo: { id: string; placa: string; marca: string | null; modelo: string | null } | null;
}

export interface FiltrosDespesa {
  /** 'AAAA-MM-DD', inclusivo. Vira instante no fuso do navegador na consulta. */
  de?: string;
  /** 'AAAA-MM-DD', inclusivo. */
  ate?: string;
  categoriaId?: string;
  escopo?: EscopoCategoria;
  status?: StatusDespesa;
  /** 'viagem' = so gasto de frete; 'avulsa' = so gasto fora de frete. */
  vinculo?: 'viagem' | 'avulsa';
  busca?: string;
}

export const chavesDespesa = {
  todas: ['despesas'] as const,
  lista: (filtros: FiltrosDespesa) => ['despesas', 'lista', filtros] as const,
  categorias: ['categorias-despesa'] as const,
  viagens: ['viagens-abertas'] as const,
  veiculos: ['veiculos-ativos'] as const,
};

export async function listarDespesas(filtros: FiltrosDespesa): Promise<DespesaDaLista[]> {
  let q = supabase
    .from('despesa')
    .select(SELECT_LISTA)
    .is('deleted_at', null)
    .order('data_hora', { ascending: false })
    .limit(500);

  // O usuario escolhe um dia no calendario, mas a coluna e timestamptz. Mandar
  // '2026-09-19' cru faria o Postgres assumir o fuso do servidor (UTC) e o
  // filtro cortaria as tres primeiras horas do dia no horario de Brasilia.
  if (filtros.de) q = q.gte('data_hora', new Date(`${filtros.de}T00:00:00`).toISOString());
  if (filtros.ate) q = q.lte('data_hora', new Date(`${filtros.ate}T23:59:59.999`).toISOString());
  if (filtros.categoriaId) q = q.eq('categoria_id', filtros.categoriaId);
  if (filtros.status) q = q.eq('status', filtros.status);
  // `!inner` no select e o que permite filtrar a despesa pelo escopo da
  // categoria; sem ele o filtro apenas recortaria o objeto aninhado.
  if (filtros.escopo) q = q.eq('categoria.escopo', filtros.escopo);
  if (filtros.vinculo === 'viagem') q = q.not('viagem_id', 'is', null);
  if (filtros.vinculo === 'avulsa') q = q.is('viagem_id', null);
  if (filtros.busca) q = q.ilike('descricao', `%${filtros.busca}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (data ?? []).map((linha) => ({
    ...(linha as unknown as DespesaDaLista),
    // numeric pode chegar como string dependendo do caminho ate o JSON, e
    // "150.00" + "150.00" numa soma daria "150.00150.00".
    valor: parseNumericOu0((linha as { valor: unknown }).valor),
  }));
}

export interface CategoriaOpcao {
  id: string;
  nome: string;
  escopo: EscopoCategoria;
  categoria_pai_id: string | null;
  is_padrao: boolean;
  ordem: number;
}

export async function listarCategorias(): Promise<CategoriaOpcao[]> {
  const { data, error } = await supabase
    .from('categoria_despesa')
    .select('id, nome, escopo, categoria_pai_id, is_padrao, ordem')
    .is('deleted_at', null)
    .eq('ativo', true)
    .order('ordem');

  if (error) throw new Error(error.message);
  return (data ?? []) as CategoriaOpcao[];
}

export interface ViagemOpcao {
  id: string;
  status: string;
  inicio_em: string | null;
}

export async function listarViagens(): Promise<ViagemOpcao[]> {
  const { data, error } = await supabase
    .from('viagem')
    .select('id, status, inicio_em')
    .is('deleted_at', null)
    .order('inicio_em', { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []) as ViagemOpcao[];
}

export interface VeiculoOpcao {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
}

export async function listarVeiculos(): Promise<VeiculoOpcao[]> {
  const { data, error } = await supabase
    .from('veiculo')
    .select('id, placa, marca, modelo')
    .is('deleted_at', null)
    .eq('ativo', true)
    .order('placa');

  if (error) throw new Error(error.message);
  return (data ?? []) as VeiculoOpcao[];
}

export interface DadosDespesa {
  /** Ausente ao criar. */
  id?: string;
  categoria_id: string;
  valor: number;
  data_hora: string;
  forma_pagamento: FormaPagamento;
  status: StatusDespesa;
  descricao: string | null;
  viagem_id: string | null;
  veiculo_id: string | null;
  comprovante_path: string | null;
}

/**
 * Cria ou atualiza. O id e gerado aqui, e nao pelo banco, porque o caminho do
 * comprovante no Storage precisa dele antes do insert - e porque e o mesmo
 * UUID v7 que o app mobile gera offline.
 */
export async function salvarDespesa(dados: DadosDespesa): Promise<string> {
  const id = dados.id ?? uuidv7();

  const { error } = await supabase.from('despesa').upsert(
    {
      id,
      categoria_id: dados.categoria_id,
      valor: dados.valor,
      data_hora: dados.data_hora,
      forma_pagamento: dados.forma_pagamento,
      status: dados.status,
      descricao: dados.descricao,
      viagem_id: dados.viagem_id,
      veiculo_id: dados.veiculo_id,
      comprovante_path: dados.comprovante_path,
    },
    { onConflict: 'id' },
  );

  if (error) throw new Error(error.message);
  return id;
}

/**
 * Exclusao logica, nunca DELETE.
 *
 * O mobile sincroniza por `deleted_at`: um delete fisico nao deixaria linha
 * para o pull informar, e o registro apagado aqui continuaria no celular.
 */
export async function excluirDespesa(id: string): Promise<void> {
  const { error } = await supabase
    .from('despesa')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

const EXTENSOES: Record<string, ExtensaoArquivo> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/**
 * Sobe o comprovante e devolve o caminho a gravar na despesa.
 *
 * O caminho comeca com o id do usuario porque a policy do Storage compara o
 * primeiro segmento da pasta com auth.uid(). O banco guarda o caminho, nunca a
 * URL: URL publica tornaria o bucket enumeravel.
 */
export async function subirComprovante(
  pilotoId: string,
  despesaId: string,
  arquivo: File,
): Promise<string> {
  const extensao = EXTENSOES[arquivo.type];
  if (!extensao) {
    throw new Error('Formato nao aceito. Envie JPG, PNG, WEBP ou PDF.');
  }

  const caminho = caminhoComprovante(pilotoId, despesaId, extensao);

  const { error } = await supabase.storage
    .from(BUCKET_COMPROVANTES)
    // upsert porque trocar a foto de uma despesa existente reusa o caminho.
    .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });

  if (error) throw new Error(error.message);
  return caminho;
}

/** URL temporaria para exibir o comprovante. Expira em uma hora. */
export async function urlDoComprovante(caminho: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_COMPROVANTES)
    .createSignedUrl(caminho, 3600);

  if (error) throw new Error(error.message);
  return data.signedUrl;
}
