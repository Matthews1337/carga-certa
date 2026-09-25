/**
 * Regra do tema, sem DOM e sem React.
 *
 * Fica separada do provider por dois motivos: e o que o teste consegue rodar em
 * Node sem jsdom, e o script inline do index.html precisa repetir a mesma regra
 * antes de o React existir. Mudar a chave ou a resolucao aqui obriga a mexer la
 * tambem - as duas pontas estao comentadas.
 */

export const TEMAS = ['claro', 'escuro', 'sistema'] as const;

export type Tema = (typeof TEMAS)[number];

/** O que de fato vai para a tela: 'sistema' ja foi resolvido. */
export type TemaResolvido = Exclude<Tema, 'sistema'>;

/** Espelhada no script inline do index.html. */
export const CHAVE_TEMA = 'carga-certa:tema';

export const CONSULTA_ESCURO = '(prefers-color-scheme: dark)';

/**
 * Le o valor guardado no navegador. Qualquer coisa fora da lista cai em
 * 'sistema': o localStorage e editavel pelo usuario e sobrevive a um rename de
 * valor, entao lixo la nao pode deixar o app sem tema.
 */
export function lerTema(bruto: string | null | undefined): Tema {
  return TEMAS.includes(bruto as Tema) ? (bruto as Tema) : 'sistema';
}

export function resolverTema(tema: Tema, preferenciaSistema: TemaResolvido): TemaResolvido {
  return tema === 'sistema' ? preferenciaSistema : tema;
}

/** Ordem do botao que alterna. */
const CICLO: Record<Tema, Tema> = {
  claro: 'escuro',
  escuro: 'sistema',
  sistema: 'claro',
};

export function proximoTema(tema: Tema): Tema {
  return CICLO[tema];
}
