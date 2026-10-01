import { describe, expect, it } from 'vitest';

import type { Ponto } from '../polyline';
import { resumirRecebimento, type RecebimentoParaResumo } from '../recebimento';
import { comprimentoKm, distanciaKm, dividirRota } from '../rota';

const RIO_VERDE: Ponto = [-17.7923, -50.9192];
const GOIANIA: Ponto = [-16.6869, -49.2648];

describe('distanciaKm', () => {
  it('Rio Verde a Goiania em linha reta, uns 215 km', () => {
    const d = distanciaKm(RIO_VERDE, GOIANIA);
    expect(d).toBeGreaterThan(210);
    expect(d).toBeLessThan(219);
  });

  it('e simetrica e zero no mesmo ponto', () => {
    expect(distanciaKm(GOIANIA, RIO_VERDE)).toBeCloseTo(distanciaKm(RIO_VERDE, GOIANIA), 9);
    expect(distanciaKm(GOIANIA, GOIANIA)).toBe(0);
  });
});

describe('dividirRota', () => {
  // Reta leste-oeste de ~213 km na latitude -17, so com as pontas (como fica
  // uma reta de rodovia depois da simplificacao).
  const reta: Ponto[] = [
    [-17, -51],
    [-17, -49],
  ];

  it('corta no meio de um segmento longo, e nao no vertice mais perto', () => {
    const r = dividirRota(reta, [-17.01, -50]);
    expect(r).not.toBeNull();
    expect(r!.fracao).toBeCloseTo(0.5, 2);
    expect(r!.percorrido.at(-1)![1]).toBeCloseTo(-50, 6);
    expect(r!.restante[0]).toEqual(r!.percorrido.at(-1));
    expect(r!.foraDaRotaKm).toBeCloseTo(1.1, 1);
  });

  it('antes do inicio: nada percorrido', () => {
    const r = dividirRota(reta, [-17, -52]);
    expect(r!.fracao).toBe(0);
    expect(r!.restante).toHaveLength(2);
  });

  it('depois do fim: tudo percorrido', () => {
    const r = dividirRota(reta, [-17, -48]);
    expect(r!.fracao).toBe(1);
  });

  it('segue as curvas: fracao pelo caminho, e nao em linha reta', () => {
    const curva: Ponto[] = [
      [-17, -51],
      [-17, -50],
      [-16, -50],
    ];
    const r = dividirRota(curva, [-17.001, -50.5]);
    const esperado = distanciaKm([-17, -51], [-17, -50.5]) / comprimentoKm(curva);
    expect(r!.fracao).toBeCloseTo(esperado, 2);
    expect(r!.percorrido).toHaveLength(2);
    expect(r!.restante).toHaveLength(3);
  });

  it('sem rota nao ha o que dividir', () => {
    expect(dividirRota([[-17, -51]], [-17, -50])).toBeNull();
  });
});

describe('resumirRecebimento', () => {
  const caiu = (tipo: RecebimentoParaResumo['tipo'], valor: number | string): RecebimentoParaResumo => ({
    tipo,
    valor,
    recebidoEm: '2026-09-29T12:00:00Z',
  });
  const lancado = (tipo: RecebimentoParaResumo['tipo'], valor: number): RecebimentoParaResumo => ({
    tipo,
    valor,
    recebidoEm: null,
  });
  const resumo = (recebimentos: RecebimentoParaResumo[], statusFrete = 'CONTRATADO' as const) =>
    resumirRecebimento({ statusFrete, valorCombinado: 5000, recebimentos });

  it('nada caiu: a receber, falta tudo', () => {
    expect(resumo([])).toEqual({ situacao: 'A_RECEBER', recebido: 0, pagoDoFrete: 0, faltaReceber: 5000 });
  });

  it('so o adiantamento: continua a receber', () => {
    expect(resumo([caiu('ADIANTAMENTO', 3500)])).toMatchObject({ situacao: 'A_RECEBER', faltaReceber: 1500 });
  });

  it('adiantamento e saldo cobrindo o combinado: recebido', () => {
    expect(resumo([caiu('ADIANTAMENTO', 3500), caiu('SALDO', 1500)])).toMatchObject({
      situacao: 'RECEBIDO',
      faltaReceber: 0,
    });
  });

  it('saldo com desconto de quebra: recebido mesmo abaixo do combinado', () => {
    expect(resumo([caiu('ADIANTAMENTO', 3500), caiu('SALDO', 1300)])).toMatchObject({
      situacao: 'RECEBIDO',
      pagoDoFrete: 4800,
    });
  });

  it('adiantamento cobrindo tudo, sem saldo lancado: recebido', () => {
    expect(resumo([caiu('ADIANTAMENTO', 5000)]).situacao).toBe('RECEBIDO');
  });

  it('estadia nao paga o frete', () => {
    expect(resumo([caiu('ADIANTAMENTO', 3500), caiu('ESTADIA', 2000)])).toMatchObject({
      situacao: 'A_RECEBER',
      recebido: 5500,
      pagoDoFrete: 3500,
      faltaReceber: 1500,
    });
  });

  it('saldo lancado sem data ainda nao caiu', () => {
    expect(resumo([caiu('ADIANTAMENTO', 3500), lancado('SALDO', 1500)]).situacao).toBe('A_RECEBER');
  });

  it('cancelado vence tudo', () => {
    expect(resumo([caiu('SALDO', 5000)], 'CANCELADO' as never).situacao).toBe('CANCELADO');
  });

  it('soma em centavos: 0,10 + 0,20 cobre 0,30', () => {
    const r = resumirRecebimento({
      statusFrete: 'CONTRATADO',
      valorCombinado: '0.30',
      recebimentos: [caiu('ADIANTAMENTO', 0.1), caiu('ADIANTAMENTO', '0.20')],
    });
    expect(r.situacao).toBe('RECEBIDO');
  });
});
