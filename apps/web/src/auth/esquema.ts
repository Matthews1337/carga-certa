import { z } from 'zod';

export type Modo = 'entrar' | 'criar';

/**
 * Campos da tela de entrada.
 *
 * `nome` NAO leva `.min()` aqui, e isso e deliberado. O campo so aparece no
 * modo "criar", mas existe no estado do formulario nos dois modos, com valor
 * inicial ''. Uma regra de tamanho no schema reprovaria esse '' durante o
 * login - e como o input nao esta renderizado, o erro nao teria onde aparecer:
 * o botao Entrar simplesmente nao faria nada, sem mensagem nenhuma.
 *
 * Quem exige o nome e `validarNome`, chamada so quando o modo e "criar".
 */
export const esquemaEntrada = z.object({
  nome: z.string().trim().optional(),
  email: z.string().trim().email('E-mail invalido'),
  senha: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres'),
});

export type CamposEntrada = z.infer<typeof esquemaEntrada>;

/** Devolve a mensagem de erro, ou null quando o nome serve. */
export function validarNome(modo: Modo, nome: string | undefined): string | null {
  if (modo === 'entrar') return null;
  return (nome ?? '').trim().length >= 2 ? null : 'Informe seu nome';
}
