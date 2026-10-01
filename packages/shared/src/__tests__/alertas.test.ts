import { describe, expect, it } from 'vitest';

import {
  dataLocal,
  descreverVencimento,
  diasAte,
  situacaoManutencao,
  situacaoVencimento,
} from '../alertas';

// Datas montadas com o construtor local, como o app faz: 29/09/2026 as 10h.
const hoje = new Date(2026, 8, 29, 10, 0);
const daquiA = (dias: number) => new Date(2026, 8, 29 + dias);

describe('diasAte', () => {
  it('conta por data, nao por hora: vencer hoje as 23h ainda e 0', () => {
    expect(diasAte(new Date(2026, 8, 29, 23, 0), hoje)).toBe(0);
    expect(diasAte(new Date(2026, 8, 29, 0, 0), hoje)).toBe(0);
  });

  it('atravessa a virada de mes', () => {
    expect(diasAte(new Date(2026, 9, 1), hoje)).toBe(2);
    expect(diasAte(new Date(2026, 8, 28), hoje)).toBe(-1);
  });
});

describe('dataLocal', () => {
  it('le AAAA-MM-DD no fuso local, sem recuar um dia', () => {
    const d = dataLocal('2030-04-12');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2030, 3, 12]);
    expect(d.getHours()).toBe(0);
  });
});

describe('situacaoVencimento', () => {
  it('sem validade nao tem situacao', () => {
    expect(situacaoVencimento(null, undefined, hoje)).toBeNull();
    expect(situacaoVencimento(undefined, undefined, hoje)).toBeNull();
  });

  it('respeita as faixas de 7 e 30 dias', () => {
    expect(situacaoVencimento(daquiA(-1), undefined, hoje)).toBe('VENCIDO');
    expect(situacaoVencimento(daquiA(0), undefined, hoje)).toBe('CRITICO');
    expect(situacaoVencimento(daquiA(7), undefined, hoje)).toBe('CRITICO');
    expect(situacaoVencimento(daquiA(8), undefined, hoje)).toBe('ATENCAO');
    expect(situacaoVencimento(daquiA(30), undefined, hoje)).toBe('ATENCAO');
    expect(situacaoVencimento(daquiA(31), undefined, hoje)).toBe('OK');
  });

  it('aceita outra antecedencia', () => {
    expect(situacaoVencimento(daquiA(10), { critico: 15, atencao: 60 }, hoje)).toBe('CRITICO');
  });
});

describe('descreverVencimento', () => {
  it('fala como gente', () => {
    expect(descreverVencimento(daquiA(-5), hoje)).toBe('vencido há 5 dias');
    expect(descreverVencimento(daquiA(-1), hoje)).toBe('vencido ontem');
    expect(descreverVencimento(daquiA(0), hoje)).toBe('vence hoje');
    expect(descreverVencimento(daquiA(1), hoje)).toBe('vence amanhã');
    expect(descreverVencimento(daquiA(12), hoje)).toBe('vence em 12 dias');
  });
});

describe('situacaoManutencao', () => {
  it('sem data e sem odometro nao tem situacao', () => {
    expect(
      situacaoManutencao({ proximaData: null, proximaOdometro: null, odometroAtual: 1000 }),
    ).toBeNull();
  });

  it('por km: passou, perto e com folga', () => {
    const porKm = (proxima: number) =>
      situacaoManutencao({ proximaData: null, proximaOdometro: proxima, odometroAtual: 100_000 });
    expect(porKm(99_000)).toBe('VENCIDO');
    expect(porKm(100_800)).toBe('CRITICO');
    expect(porKm(102_500)).toBe('ATENCAO');
    expect(porKm(110_000)).toBe('OK');
  });
});
