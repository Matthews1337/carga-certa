import { describe, expect, it } from 'vitest';

import { SECOES } from '@/layout/secoes';

import {
  ALVO_DO_BOTAO_AJUDA,
  ALVO_DO_CABECALHO,
  TOUR_DE_BOAS_VINDAS,
  TOURS_DAS_PAGINAS,
  type PassoDoTour,
} from '../passos';

function textosPreenchidos(passos: PassoDoTour[]) {
  for (const p of passos) {
    expect(p.titulo.trim(), `titulo do passo ${p.alvo ?? 'sem alvo'}`).not.toBe('');
    expect(p.texto.trim(), `texto do passo ${p.alvo ?? 'sem alvo'}`).not.toBe('');
  }
}

describe('tour de boas-vindas', () => {
  it('explica todas as secoes do menu', () => {
    // A regressao que este teste impede: secao nova no menu sem explicacao no
    // primeiro acesso.
    const alvos = new Set(TOUR_DE_BOAS_VINDAS.map((p) => p.alvo));
    for (const secao of SECOES) expect(alvos, secao.rotulo).toContain(secao.tour);
  });

  it('abre sem alvo e termina no botao "i"', () => {
    expect(TOUR_DE_BOAS_VINDAS[0]?.alvo).toBeUndefined();
    expect(TOUR_DE_BOAS_VINDAS.at(-1)?.alvo).toBe(ALVO_DO_BOTAO_AJUDA);
  });

  it('cobre o celular, onde o menu fica numa gaveta', () => {
    expect(TOUR_DE_BOAS_VINDAS.map((p) => p.alvo)).toContain('menu-abrir');
  });

  it('tem titulo e texto em todo passo', () => {
    textosPreenchidos(TOUR_DE_BOAS_VINDAS);
  });
});

describe('tours das paginas', () => {
  const tours = Object.entries(TOURS_DAS_PAGINAS);

  it.each(tours)('%s: tem passos, todos com alvo e sem alvo repetido', (_pagina, passos) => {
    expect(passos.length).toBeGreaterThan(0);
    const alvos = passos.map((p) => p.alvo);
    expect(alvos.every(Boolean)).toBe(true);
    expect(new Set(alvos).size).toBe(alvos.length);
  });

  it.each(tours)('%s: o titulo da tela fica com o botao "i", e nao aqui', (_pagina, passos) => {
    // O BotaoAjuda poe o passo do cabecalho com a descricao que a pagina ja
    // mostra; repetir aqui duplicaria o texto e o passo.
    expect(passos.map((p) => p.alvo)).not.toContain(ALVO_DO_CABECALHO);
  });

  it.each(tours)('%s: tem titulo e texto em todo passo', (_pagina, passos) => {
    textosPreenchidos(passos);
  });
});
