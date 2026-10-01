import { isCnpjValido, isTelefoneValido, limparCnpj, limparTelefone } from '@carga-certa/shared';
import { z } from 'zod';

/**
 * Regras do formulario de contratante. So o nome e obrigatorio: muito frete
 * e combinado com um conhecido por telefone, sem CNPJ na mao.
 */

const vazioOu = (teste: (v: string) => boolean) => (v: string) => v === '' || teste(v);

export const esquemaContratante = z.object({
  nome: z.string().trim().min(1, 'Informe o nome').max(120, 'No máximo 120 caracteres'),
  cnpj: z
    .string()
    .trim()
    .refine(vazioOu(isCnpjValido), 'CNPJ inválido. Confira os números (ou letras) digitados.'),
  contato: z.string().trim().max(80, 'No máximo 80 caracteres'),
  telefone: z
    .string()
    .trim()
    .refine(vazioOu(isTelefoneValido), 'Informe com DDD, como (62) 99999-8888.'),
});

export type CamposContratante = z.infer<typeof esquemaContratante>;

/** Linha pronta para gravar. piloto_id fica de fora: o banco preenche. */
export interface RegistroContratante {
  nome: string;
  cnpj: string | null;
  contato: string | null;
  telefone: string | null;
}

/** CNPJ e telefone vao limpos para o banco; a tela formata na exibicao. */
export function paraRegistro(campos: CamposContratante): RegistroContratante {
  const texto = (v: string) => (v.trim() === '' ? null : v.trim());
  return {
    nome: campos.nome.trim(),
    cnpj: campos.cnpj.trim() === '' ? null : limparCnpj(campos.cnpj),
    contato: texto(campos.contato),
    telefone: campos.telefone.trim() === '' ? null : limparTelefone(campos.telefone),
  };
}
