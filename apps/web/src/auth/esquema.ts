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
const email = z.string().trim().email('E-mail inválido');

// A mesma regra no cadastro e na senha nova: senao daria para trocar a senha
// por uma mais curta do que o cadastro aceita.
const senha = z.string().min(8, 'A senha precisa de pelo menos 8 caracteres');

export const esquemaEntrada = z.object({
  nome: z.string().trim().optional(),
  email,
  senha,
});

export type CamposEntrada = z.infer<typeof esquemaEntrada>;

/**
 * Pedido do link de redefinicao. Formulario proprio, e nao um terceiro modo do
 * de entrada: la a senha e obrigatoria e ficaria escondida - o mesmo botao sem
 * reacao descrito acima.
 */
export const esquemaRecuperar = z.object({ email });

export type CamposRecuperar = z.infer<typeof esquemaRecuperar>;

export const esquemaNovaSenha = z
  .object({ senha, repetir: z.string() })
  .refine((v) => v.senha === v.repetir, {
    path: ['repetir'],
    message: 'As duas senhas não são iguais',
  });

export type CamposNovaSenha = z.infer<typeof esquemaNovaSenha>;

/** Devolve a mensagem de erro, ou null quando o nome serve. */
export function validarNome(modo: Modo, nome: string | undefined): string | null {
  if (modo === 'entrar') return null;
  return (nome ?? '').trim().length >= 2 ? null : 'Informe seu nome';
}
