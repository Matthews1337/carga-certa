import { describe, expect, it } from 'vitest';

import {
  deslocarMes,
  ehMesValido,
  intervaloDoMes,
  mesAtual,
  mesDe,
  rotuloDoMes,
} from '../mes';

describe('ehMesValido', () => {
  it('aceita AAAA-MM', () => {
    expect(ehMesValido('2026-09')).toBe(true);
    expect(ehMesValido('2026-12')).toBe(true);
  });

  it('recusa o que veio torto da URL', () => {
    for (const ruim of ['2026-13', '2026-00', '2026-9', '26-09', '2026-09-01', '', null, undefined]) {
      expect(ehMesValido(ruim)).toBe(false);
    }
  });
});

describe('mesDe e mesAtual', () => {
  it('usa o calendario local, nao UTC', () => {
    // 23h59 do dia 30 no fuso local e setembro, mesmo que em UTC ja seja outubro.
    expect(mesDe(new Date(2026, 8, 30, 23, 59))).toBe('2026-09');
    expect(mesDe(new Date(2026, 9, 1, 0, 0))).toBe('2026-10');
  });

  it('aceita um "agora" injetado', () => {
    expect(mesAtual(new Date(2026, 0, 15))).toBe('2026-01');
  });
});

describe('deslocarMes', () => {
  it('atravessa a virada de ano nos dois sentidos', () => {
    expect(deslocarMes('2026-01', -1)).toBe('2025-12');
    expect(deslocarMes('2025-12', 1)).toBe('2026-01');
    expect(deslocarMes('2026-09', -12)).toBe('2025-09');
  });
});

describe('intervaloDoMes', () => {
  it('comeca a meia-noite local do dia 1 e termina no dia 1 seguinte (exclusivo)', () => {
    const { inicio, fim } = intervaloDoMes('2026-09');
    expect([inicio.getFullYear(), inicio.getMonth(), inicio.getDate(), inicio.getHours()]).toEqual([
      2026, 8, 1, 0,
    ]);
    expect([fim.getFullYear(), fim.getMonth(), fim.getDate(), fim.getHours()]).toEqual([2026, 9, 1, 0]);
  });

  it('fecha dezembro no 1o de janeiro do ano seguinte', () => {
    const { fim } = intervaloDoMes('2026-12');
    expect([fim.getFullYear(), fim.getMonth(), fim.getDate()]).toEqual([2027, 0, 1]);
  });

  it('cobre fevereiro de ano bissexto sem saber quantos dias ele tem', () => {
    const { inicio, fim } = intervaloDoMes('2028-02');
    expect((fim.getTime() - inicio.getTime()) / 86_400_000).toBe(29);
  });

  it('recusa mes invalido em vez de devolver um intervalo errado', () => {
    expect(() => intervaloDoMes('2026-13')).toThrow('Mes invalido');
  });
});

describe('rotuloDoMes', () => {
  it('escreve por extenso, em portugues, com inicial maiuscula', () => {
    expect(rotuloDoMes('2026-09')).toBe('Setembro de 2026');
    expect(rotuloDoMes('2026-03')).toBe('Março de 2026');
  });
});
