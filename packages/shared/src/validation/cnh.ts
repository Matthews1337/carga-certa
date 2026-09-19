/**
 * Categoria de CNH.
 *
 * O banco aceita qualquer combinacao de ABCDE (`ck_cnh_categoria`). Na pratica o
 * Detran so emite categoria simples ou "A + uma das outras": nao existe CNH "BC"
 * nem "CD", porque C, D e E ja englobam a B. Um caminhoneiro tem tipicamente E,
 * AE ou D.
 */

export const CATEGORIAS_CNH = ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'] as const;
export type CategoriaCnh = (typeof CATEGORIAS_CNH)[number];

/** Categorias que habilitam veiculo de carga pesada (acima de 3.500 kg). */
export const CATEGORIAS_CARGA: readonly CategoriaCnh[] = ['C', 'E', 'AC', 'AE'];

export function normalizarCategoriaCnh(valor: string): string {
  // Ordena para que "EA" digitado vire "AE", a forma canonica.
  return [...new Set(valor.toUpperCase().replace(/[^A-E]/g, ''))].sort().join('');
}

export function isCategoriaCnhValida(valor: string): valor is CategoriaCnh {
  return (CATEGORIAS_CNH as readonly string[]).includes(normalizarCategoriaCnh(valor));
}

/** Se a categoria permite dirigir o veiculo. `minima` vem de tipo_veiculo. */
export function categoriaAtende(categoria: string, minima: string | null | undefined): boolean {
  if (!minima) return true;
  const tem = new Set(normalizarCategoriaCnh(categoria));
  const precisa = normalizarCategoriaCnh(minima);
  // Hierarquia: E cobre D, D cobre C, C cobre B. A e independente das demais.
  const cobertura: Record<string, string[]> = {
    B: ['B', 'C', 'D', 'E'],
    C: ['C', 'D', 'E'],
    D: ['D', 'E'],
    E: ['E'],
    A: ['A'],
  };
  return [...precisa].every((letra) => (cobertura[letra] ?? [letra]).some((c) => tem.has(c)));
}

/** Numero do registro da CNH: 11 digitos, sem validacao de DV. */
export function limparNumeroCnh(valor: string): string {
  return valor.replace(/\D/g, '');
}

export function isNumeroCnhValido(valor: string): boolean {
  return /^\d{11}$/.test(limparNumeroCnh(valor));
}
