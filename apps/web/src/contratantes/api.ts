import { uuidv7 } from '@carga-certa/shared';

import type { RegistroContratante } from '@/contratantes/esquema';
import { supabase } from '@/lib/supabase';

/**
 * Consultas e gravacoes de contratante. Mesmas regras de despesas/api.ts:
 * `.is('deleted_at', null)` em toda leitura, exclusao logica, e piloto_id
 * nunca enviado.
 */

// O formulario de frete vai listar os contratantes por esta mesma chave: salvar
// um contratante invalida ['contratantes'] e atualiza o dropdown junto.
export const chavesContratantes = {
  todos: ['contratantes'] as const,
  lista: ['contratantes', 'lista'] as const,
};

export interface Contratante {
  id: string;
  nome: string;
  /** Limpo, sem pontuacao: formatar com formatarCnpj. */
  cnpj: string | null;
  contato: string | null;
  /** So digitos, com DDD: formatar com formatarTelefone. */
  telefone: string | null;
}

export async function listarContratantes(): Promise<Contratante[]> {
  const { data, error } = await supabase
    .from('contratante')
    .select('id, nome, cnpj, contato, telefone')
    .is('deleted_at', null)
    .order('nome');

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Cria ou atualiza. Devolve o id. */
export async function salvarContratante(
  registro: RegistroContratante,
  id?: string,
): Promise<string> {
  const idFinal = id ?? uuidv7();
  const { error } = await supabase
    .from('contratante')
    .upsert({ id: idFinal, ...registro }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
  return idFinal;
}

/**
 * Exclusao logica: os fretes ja lancados continuam apontando para ele. So um
 * frete NOVO nao pode mais escolhe-lo (o trigger valida_parente recusa pai
 * excluido).
 */
export async function excluirContratante(id: string): Promise<void> {
  const { error } = await supabase
    .from('contratante')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
