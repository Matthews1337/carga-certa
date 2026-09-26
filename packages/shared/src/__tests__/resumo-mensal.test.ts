import { describe, expect, it } from 'vitest';

import {
  resumirMes,
  type DespesaParaResumo,
  type ReceitaParaResumo,
  type ViagemParaResumo,
} from '../resumo-mensal';

// Datas no fuso LOCAL: o teste vale em qualquer maquina, e e a regra real -
// o mes e o do aparelho do motorista.
const set = (dia: number, h = 12, min = 0) => new Date(2026, 8, dia, h, min);
const out = (dia: number, h = 12) => new Date(2026, 9, dia, h);
const ago = (dia: number) => new Date(2026, 7, dia, 12);

const vazio = { despesas: [], receitas: [], viagens: [] };

describe('resumirMes: saiu', () => {
  it('soma so as despesas do mes, sem canceladas, com pendentes', () => {
    const despesas: DespesaParaResumo[] = [
      { valor: 100, status: 'CONFIRMADA', dataHora: set(10) },
      { valor: '50.50', status: 'PENDENTE', dataHora: set(11) }, // entra: dinheiro ja saiu
      { valor: 999, status: 'CANCELADA', dataHora: set(12) }, // fica fora
      { valor: 777, status: 'CONFIRMADA', dataHora: out(1) }, // outro mes
    ];
    expect(resumirMes({ ...vazio, mes: '2026-09', despesas }).saiu).toBe(150.5);
  });

  it('respeita o limite do mes no fuso local', () => {
    const despesas: DespesaParaResumo[] = [
      { valor: 10, status: 'CONFIRMADA', dataHora: set(30, 23, 59) }, // ultimo minuto de setembro
      { valor: 20, status: 'CONFIRMADA', dataHora: out(1, 0) }, // primeiro instante de outubro
    ];
    expect(resumirMes({ ...vazio, mes: '2026-09', despesas }).saiu).toBe(10);
    expect(resumirMes({ ...vazio, mes: '2026-10', despesas }).saiu).toBe(20);
  });

  it('aceita as tres formas de data: ISO, epoch em ms e Date', () => {
    const despesas: DespesaParaResumo[] = [
      { valor: 1, status: 'CONFIRMADA', dataHora: set(5).toISOString() }, // PostgREST
      { valor: 2, status: 'CONFIRMADA', dataHora: set(6).getTime() }, // WatermelonDB
      { valor: 4, status: 'CONFIRMADA', dataHora: set(7) },
    ];
    expect(resumirMes({ ...vazio, mes: '2026-09', despesas }).saiu).toBe(7);
  });
});

describe('resumirMes: entrou e saldo', () => {
  it('conta a receita pelo dia em que o dinheiro caiu', () => {
    const receitas: ReceitaParaResumo[] = [
      { valor: 5000, recebidoEm: set(17) },
      { valor: 7800, recebidoEm: null }, // lancada, ainda nao recebida: nao entrou
      { valor: 9000, recebidoEm: ago(26) }, // recebida em agosto
    ];
    const r = resumirMes({ ...vazio, mes: '2026-09', receitas });
    expect(r.entrou).toBe(5000);
  });

  it('calcula o saldo em centavos, sem erro de ponto flutuante', () => {
    const r = resumirMes({
      mes: '2026-09',
      receitas: [{ valor: 0.3, recebidoEm: set(1) }],
      despesas: [{ valor: 0.1, status: 'CONFIRMADA', dataHora: set(2) }],
      viagens: [],
    });
    expect(r.saldo).toBe(0.2); // em float puro: 0.19999999999999998
  });

  it('fica negativo quando o mes deu prejuizo', () => {
    const r = resumirMes({
      mes: '2026-09',
      receitas: [],
      despesas: [{ valor: 7571.26, status: 'CONFIRMADA', dataHora: set(3) }],
      viagens: [],
    });
    expect(r.saldo).toBe(-7571.26);
  });
});

describe('resumirMes: viagens e km', () => {
  const viagens: ViagemParaResumo[] = [
    { status: 'CONCLUIDA', inicioEm: set(2), kmTotal: '1800.00' },
    { status: 'EM_ANDAMENTO', inicioEm: set(17), kmTotal: 2350 },
    { status: 'PLANEJADA', inicioEm: set(28), kmTotal: null }, // ainda sem odometro final
    { status: 'CANCELADA', inicioEm: set(20), kmTotal: 500 }, // nao aconteceu
    { status: 'CONCLUIDA', inicioEm: ago(20), kmTotal: 1200 }, // outro mes
    { status: 'PLANEJADA', inicioEm: null, kmTotal: null }, // sem data: nao aconteceu
  ];

  it('conta as viagens iniciadas no mes, sem as canceladas', () => {
    const r = resumirMes({ ...vazio, mes: '2026-09', viagens });
    expect(r.viagens).toEqual({ total: 3, concluidas: 1, emAberto: 2 });
  });

  it('soma os km conhecidos e diz quantas viagens ficaram de fora da soma', () => {
    const r = resumirMes({ ...vazio, mes: '2026-09', viagens });
    expect(r.km).toEqual({ total: 4150, viagensComKm: 2, viagensSemKm: 1 });
  });

  it('a viagem cancelada nao soma km, mesmo tendo odometro', () => {
    const r = resumirMes({ ...vazio, mes: '2026-09', viagens });
    expect(r.km.total).not.toBe(4650);
  });
});

describe('resumirMes: mes vazio', () => {
  it('devolve tudo zerado, sem NaN', () => {
    expect(resumirMes({ ...vazio, mes: '2026-09' })).toEqual({
      entrou: 0,
      saiu: 0,
      saldo: 0,
      viagens: { total: 0, concluidas: 0, emAberto: 0 },
      km: { total: 0, viagensComKm: 0, viagensSemKm: 0 },
    });
  });
});
