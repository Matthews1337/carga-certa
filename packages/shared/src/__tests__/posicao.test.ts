import { describe, expect, it } from 'vitest';

import {
  decidirPontoDoTrajeto,
  descreverPrecisao,
  DESLOCAMENTO_MINIMO_DO_TRAJETO_M,
  INTERVALO_MAXIMO_DO_TRAJETO_MS,
  INTERVALO_MINIMO_DO_TRAJETO_MS,
  PRECISAO_ACEITAVEL_M,
  precisaoAceitavel,
  type LeituraDePosicao,
} from '../posicao';

// Um grau de latitude tem ~111 km: 0,001 grau ~ 111 m.
const GRAU_EM_M = 111_195;

const base: LeituraDePosicao = { lat: -17.7923, lng: -50.9192, precisaoM: 10, em: 0 };

function depois(ms: number, metrosAoNorte: number, precisaoM = 10): LeituraDePosicao {
  return { lat: base.lat + metrosAoNorte / GRAU_EM_M, lng: base.lng, precisaoM, em: base.em + ms };
}

describe('precisaoAceitavel', () => {
  it('aceita GPS de celular e Wi-Fi bom, recusa posicao pelo endereco da internet', () => {
    expect(precisaoAceitavel(8)).toBe(true);
    expect(precisaoAceitavel(PRECISAO_ACEITAVEL_M)).toBe(true);
    expect(precisaoAceitavel(PRECISAO_ACEITAVEL_M + 1)).toBe(false);
    expect(precisaoAceitavel(3200)).toBe(false);
  });

  it('recusa precisao desconhecida', () => {
    expect(precisaoAceitavel(null)).toBe(false);
    expect(precisaoAceitavel(undefined)).toBe(false);
    expect(precisaoAceitavel(Number.NaN)).toBe(false);
  });
});

describe('descreverPrecisao', () => {
  it('em metros abaixo de 1 km e em km acima, com virgula', () => {
    expect(descreverPrecisao(12.4)).toBe('±12 m');
    expect(descreverPrecisao(0.3)).toBe('±1 m');
    expect(descreverPrecisao(850)).toBe('±850 m');
    expect(descreverPrecisao(3240)).toBe('±3,2 km');
    expect(descreverPrecisao(25_000)).toBe('±25 km');
  });
});

describe('decidirPontoDoTrajeto', () => {
  it('grava o primeiro ponto bom', () => {
    expect(decidirPontoDoTrajeto(base, null)).toBe('gravar');
  });

  it('nao grava leitura imprecisa, nem a primeira', () => {
    expect(decidirPontoDoTrajeto({ ...base, precisaoM: 3000 }, null)).toBe('imprecisa');
    expect(decidirPontoDoTrajeto(depois(5 * 60_000, 5000, 3000), base)).toBe('imprecisa');
  });

  it('espera o intervalo minimo, mesmo andando', () => {
    expect(decidirPontoDoTrajeto(depois(INTERVALO_MINIMO_DO_TRAJETO_MS - 1, 2000), base)).toBe('cedo');
  });

  it('grava depois do intervalo minimo se andou', () => {
    const andou = DESLOCAMENTO_MINIMO_DO_TRAJETO_M + 20;
    expect(decidirPontoDoTrajeto(depois(INTERVALO_MINIMO_DO_TRAJETO_MS, andou), base)).toBe('gravar');
  });

  it('parado, segura ate o intervalo maximo e entao grava um ponto', () => {
    const quase = DESLOCAMENTO_MINIMO_DO_TRAJETO_M - 30;
    expect(decidirPontoDoTrajeto(depois(5 * 60_000, quase), base)).toBe('parado');
    expect(decidirPontoDoTrajeto(depois(INTERVALO_MAXIMO_DO_TRAJETO_MS, quase), base)).toBe('gravar');
  });
});
