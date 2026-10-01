import { describe, expect, it } from 'vitest';

import {
  codificarPolyline,
  decodificarPolyline,
  simplificarRota,
  type Ponto,
} from '../polyline';

// Exemplo da documentacao do Google, a referencia do formato.
const EXEMPLO_GOOGLE: Ponto[] = [
  [38.5, -120.2],
  [40.7, -120.95],
  [43.252, -126.453],
];
const EXEMPLO_CODIFICADO = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

describe('polyline', () => {
  it('codifica igual ao Google', () => {
    expect(codificarPolyline(EXEMPLO_GOOGLE)).toBe(EXEMPLO_CODIFICADO);
  });

  it('decodifica igual ao Google', () => {
    expect(decodificarPolyline(EXEMPLO_CODIFICADO)).toEqual(EXEMPLO_GOOGLE);
  });

  it('ida e volta num trecho brasileiro, com precisao de 1e-5', () => {
    const rioVerdeGoiania: Ponto[] = [
      [-17.79778, -50.92806],
      [-17.5, -50.4],
      [-16.68689, -49.26479],
    ];
    expect(decodificarPolyline(codificarPolyline(rioVerdeGoiania))).toEqual(rioVerdeGoiania);
  });

  it('texto vazio e rota vazia', () => {
    expect(codificarPolyline([])).toBe('');
    expect(decodificarPolyline('')).toEqual([]);
  });

  it('recusa texto truncado em vez de devolver meia rota', () => {
    expect(() => decodificarPolyline(EXEMPLO_CODIFICADO.slice(0, -2))).toThrow('corrompida');
  });
});

describe('simplificarRota', () => {
  it('reta cheia de pontos vira so as pontas', () => {
    const reta: Ponto[] = Array.from({ length: 50 }, (_, k) => [-17 + k * 0.01, -50 + k * 0.01]);
    expect(simplificarRota(reta)).toEqual([reta[0], reta[49]]);
  });

  it('mantem a curva que passa da tolerancia', () => {
    const cotovelo: Ponto[] = [
      [-17, -50],
      [-17, -49.5],
      [-16.5, -49.5],
    ];
    expect(simplificarRota(cotovelo)).toEqual(cotovelo);
  });

  it('descarta o desvio menor que a tolerancia (uns 100 m)', () => {
    const quaseReta: Ponto[] = [
      [-17, -50],
      [-17.0003, -49.75], // ~33 m fora da linha
      [-17, -49.5],
    ];
    expect(simplificarRota(quaseReta)).toEqual([quaseReta[0], quaseReta[2]]);
  });

  it('com menos de 3 pontos, nao ha o que simplificar', () => {
    const dois: Ponto[] = [
      [-17, -50],
      [-16, -49],
    ];
    expect(simplificarRota(dois)).toEqual(dois);
  });

  it('aguenta rota que volta ao ponto de partida', () => {
    const idaEVolta: Ponto[] = [
      [-17, -50],
      [-16, -50],
      [-17, -50],
    ];
    expect(simplificarRota(idaEVolta)).toEqual(idaEVolta);
  });
});
