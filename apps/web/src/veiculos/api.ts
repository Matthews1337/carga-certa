import {
  BUCKET_DOCUMENTOS,
  caminhoDocumento,
  parseNumeric,
  uuidv7,
  type CarroceriaVeiculo,
  type ExtensaoArquivo,
  type NaturezaVeiculo,
} from '@carga-certa/shared';

import { supabase } from '@/lib/supabase';
import type { RegistroVeiculo } from '@/veiculos/esquema';

/**
 * Consultas e gravacoes de veiculo e de documento de veiculo.
 *
 * Mesmas regras de despesas/api.ts: `.is('deleted_at', null)` em toda leitura,
 * exclusao logica, e piloto_id nunca enviado.
 */

// Tudo sob o prefixo ['veiculos'], inclusive a lista do formulario de despesa:
// uma invalidacao de ['veiculos'] atualiza todas.
export const chavesVeiculos = {
  todos: ['veiculos'] as const,
  lista: ['veiculos', 'lista'] as const,
  documentos: (veiculoId: string) => ['veiculos', 'documentos', veiculoId] as const,
  tipos: ['tipos-veiculo'] as const,
  tiposDocumento: ['tipos-documento-veiculo'] as const,
};

/** Codigos de erro do Postgres que viram mensagem para o usuario. */
function erroAmigavel(
  erro: { code?: string; message: string },
  porCodigo: Record<string, string>,
): Error {
  return new Error(porCodigo[erro.code ?? ''] ?? erro.message);
}

// ------------------------------------------------------------------ tipos ---

export interface TipoVeiculoOpcao {
  id: string;
  nome: string;
  natureza: NaturezaVeiculo;
  qtd_eixos: number | null;
  capacidade_kg_ref: number | null;
}

export async function listarTiposVeiculo(): Promise<TipoVeiculoOpcao[]> {
  const { data, error } = await supabase
    .from('tipo_veiculo')
    .select('id, nome, natureza, qtd_eixos, capacidade_kg_ref')
    .is('deleted_at', null)
    .eq('ativo', true)
    .order('ordem');

  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => ({ ...t, capacidade_kg_ref: parseNumeric(t.capacidade_kg_ref) }));
}

// --------------------------------------------------------------- veiculos ---

export interface DocumentoResumo {
  id: string;
  validade: string | null;
  tipo: { nome: string } | null;
}

export interface VeiculoDaLista {
  id: string;
  tipo_veiculo_id: string;
  natureza: NaturezaVeiculo;
  carroceria: CarroceriaVeiculo;
  placa: string;
  renavam: string | null;
  marca: string | null;
  modelo: string | null;
  ano: number | null;
  cor: string | null;
  capacidade_kg: number | null;
  qtd_eixos: number | null;
  odometro_atual: number;
  ativo: boolean;
  tipo: { id: string; nome: string } | null;
  documentos: DocumentoResumo[];
}

export async function listarVeiculos(): Promise<VeiculoDaLista[]> {
  const { data, error } = await supabase
    .from('veiculo')
    .select(
      `id, tipo_veiculo_id, natureza, carroceria, placa, renavam, marca, modelo, ano, cor,
       capacidade_kg, qtd_eixos, odometro_atual, ativo,
       tipo:tipo_veiculo ( id, nome ),
       documentos:documento_veiculo ( id, validade, deleted_at, tipo:tipo_documento ( nome ) )`,
    )
    .is('deleted_at', null)
    // Sem este filtro, documento excluido ainda contaria no aviso de vencimento.
    .is('documentos.deleted_at', null)
    .order('ativo', { ascending: false })
    .order('natureza') // enum: TRACAO antes de REBOQUE
    .order('placa');

  if (error) throw new Error(error.message);

  // A linha crua traz deleted_at nos documentos; o tipo exposto nao.
  type LinhaVeiculo = Omit<VeiculoDaLista, 'documentos'> & {
    documentos: (DocumentoResumo & { deleted_at: string | null })[] | null;
  };

  return (data ?? []).map((linha) => {
    const v = linha as unknown as LinhaVeiculo;
    return {
      ...v,
      capacidade_kg: parseNumeric(v.capacidade_kg),
      documentos: (v.documentos ?? []).filter((d) => d.deleted_at === null),
    };
  });
}

/** Cria ou atualiza. Devolve o id. */
export async function salvarVeiculo(registro: RegistroVeiculo, id?: string): Promise<string> {
  const idFinal = id ?? uuidv7();
  const { error } = await supabase
    .from('veiculo')
    .upsert({ id: idFinal, ...registro }, { onConflict: 'id' });

  if (error) {
    throw erroAmigavel(error, {
      // ux_veiculo_placa: placa unica por usuario, entre os nao excluidos.
      '23505': 'Já existe um veículo com esta placa.',
      // FK composta das viagens: o veiculo ja foi usado como cavalo (ou como
      // carreta), e trocar o tipo mudaria a natureza dele por baixo da viagem.
      '23503':
        'Este veículo já foi usado em viagem, então não pode passar de tração para reboque ' +
        '(nem o contrário). Cadastre-o como um veículo novo.',
    });
  }
  return idFinal;
}

/**
 * Exclusao logica. As viagens e despesas antigas continuam apontando para ele,
 * e a placa fica livre para um novo cadastro.
 */
export async function excluirVeiculo(id: string): Promise<void> {
  const { error } = await supabase
    .from('veiculo')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ------------------------------------------------------------- documentos ---

export interface TipoDocumentoOpcao {
  id: string;
  nome: string;
  periodicidade_meses: number | null;
  obrigatorio: boolean;
}

export async function listarTiposDocumentoVeiculo(): Promise<TipoDocumentoOpcao[]> {
  const { data, error } = await supabase
    .from('tipo_documento')
    .select('id, nome, periodicidade_meses, obrigatorio')
    .is('deleted_at', null)
    .eq('ativo', true)
    .eq('aplica_se_a', 'VEICULO')
    .order('nome');

  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface DocumentoDoVeiculo {
  id: string;
  veiculo_id: string;
  tipo_documento_id: string;
  numero: string | null;
  /** 'AAAA-MM-DD' */
  emissao: string | null;
  /** 'AAAA-MM-DD' */
  validade: string | null;
  arquivo_path: string | null;
  tipo: { nome: string } | null;
}

export async function listarDocumentos(veiculoId: string): Promise<DocumentoDoVeiculo[]> {
  const { data, error } = await supabase
    .from('documento_veiculo')
    .select(
      'id, veiculo_id, tipo_documento_id, numero, emissao, validade, arquivo_path, tipo:tipo_documento ( nome )',
    )
    .eq('veiculo_id', veiculoId)
    .is('deleted_at', null)
    // O que vence primeiro no topo; sem validade no fim.
    .order('validade', { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DocumentoDoVeiculo[];
}

export interface DadosDocumento {
  id: string;
  veiculo_id: string;
  tipo_documento_id: string;
  numero: string | null;
  emissao: string | null;
  validade: string | null;
  arquivo_path: string | null;
}

export async function salvarDocumento(dados: DadosDocumento): Promise<void> {
  const { error } = await supabase.from('documento_veiculo').upsert(dados, { onConflict: 'id' });
  if (error) {
    throw erroAmigavel(error, {
      // ck_documento_datas
      '23514': 'A validade não pode ser antes da emissão.',
    });
  }
}

export async function excluirDocumento(id: string): Promise<void> {
  const { error } = await supabase
    .from('documento_veiculo')
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

/** O limite do bucket `documentos`, definido na migration de storage. */
export const TAMANHO_MAXIMO_DOCUMENTO = 10 * 1024 * 1024;

/**
 * Sobe o arquivo e devolve o caminho a gravar. Se o documento ja tinha um
 * arquivo com outra extensao (trocou o PDF por uma foto), apaga o antigo -
 * senao ele ficaria orfao no bucket, ocupando espaco sem nada apontando para ele.
 */
export async function subirArquivoDocumento(
  pilotoId: string,
  documentoId: string,
  arquivo: File,
  caminhoAnterior: string | null,
): Promise<string> {
  const extensao = EXTENSOES[arquivo.type];
  if (!extensao) throw new Error('Formato não aceito. Envie JPG, PNG, WEBP ou PDF.');
  if (arquivo.size > TAMANHO_MAXIMO_DOCUMENTO) {
    throw new Error('O arquivo passa de 10 MB. Envie uma foto menor ou um PDF comprimido.');
  }

  const caminho = caminhoDocumento(pilotoId, documentoId, extensao);
  const { error } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });
  if (error) throw new Error(error.message);

  if (caminhoAnterior && caminhoAnterior !== caminho) {
    // Falhar aqui nao desfaz nada: o arquivo novo ja subiu e e o que vale.
    await supabase.storage.from(BUCKET_DOCUMENTOS).remove([caminhoAnterior]);
  }
  return caminho;
}

/** URL temporaria para abrir o arquivo. Expira em uma hora. */
export async function urlDoArquivoDocumento(caminho: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .createSignedUrl(caminho, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
