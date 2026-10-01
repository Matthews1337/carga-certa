import type { TemaResolvido } from '@/tema/tema';

/**
 * De onde o MapLibre baixa tudo: estilo, tiles, fontes e icones.
 *
 * A CSP (plugins/cabecalhos.ts) libera exatamente este host em connect-src, e
 * le daqui - trocar de provedor de mapa e mudar uma linha so.
 *
 * OpenFreeMap: sem chave, sem conta e sem cobranca por carregamento, com os
 * dados do OpenStreetMap. Decisao de 2026-09-28 (ver historico dos fretes).
 */
export const HOST_DOS_MAPAS = 'https://tiles.openfreemap.org';

export const ESTILO_DO_MAPA: Record<TemaResolvido, string> = {
  claro: `${HOST_DOS_MAPAS}/styles/positron`,
  escuro: `${HOST_DOS_MAPAS}/styles/dark`,
};

/**
 * Cores dos elementos desenhados sobre o mapa. Fixas, e nao as variaveis do
 * tema: o MapLibre nao entende oklch() nem var(), e as mesmas cores funcionam
 * sobre o mapa claro e o escuro.
 */
export const CORES_DO_MAPA = {
  /** Pino do inicio. */
  inicio: '#16a34a',
  /** Pino do fim. */
  fim: '#dc2626',
  /** Posicao do motorista e trecho ja percorrido - o ambar do app. */
  motorista: '#f5b301',
  /** Trecho que falta. */
  restante: '#f97316',
} as const;
