import { describe, expect, it } from 'vitest';

import { cidadeDoLugar, kmDoFrete, mesDoInicio, tempoDesde } from '../apresentacao';

describe('cidadeDoLugar', () => {
  it('endereco inteiro vira cidade e UF', () => {
    expect(cidadeDoLugar('Rua Minas Gerais, Rio Verde, GO')).toBe('Rio Verde, GO');
    expect(cidadeDoLugar('Alfandega do Porto de Santos, Santos, SP')).toBe('Santos, SP');
  });

  it('cidade e UF ficam como estao', () => {
    expect(cidadeDoLugar('Rio Verde, GO')).toBe('Rio Verde, GO');
  });

  it('sem UF no fim, mantem o nome todo', () => {
    expect(cidadeDoLugar('Cena do Porto de Santos, 1826, São Paulo')).toBe(
      'Cena do Porto de Santos, 1826, São Paulo',
    );
  });

  it('sem nome', () => {
    expect(cidadeDoLugar(null)).toBe('Sem local');
  });
});

describe('mesDoInicio', () => {
  it('mes curto e ano, no fuso local', () => {
    expect(mesDoInicio(new Date(2026, 9, 1, 12).toISOString())).toBe('out/2026');
    expect(mesDoInicio(new Date(2026, 7, 31, 12).toISOString())).toBe('ago/2026');
  });

  it('sem data', () => {
    expect(mesDoInicio(null)).toBe('—');
  });
});

describe('kmDoFrete', () => {
  it('odometro manda quando existe', () => {
    expect(kmDoFrete({ km_total: 1012, km_previsto: 997.5 })).toEqual({ km: 1012, previsto: false });
  });

  it('antes do fim da viagem, o previsto da rota', () => {
    expect(kmDoFrete({ km_total: null, km_previsto: 997.5 })).toEqual({ km: 997.5, previsto: true });
  });

  it('sem viagem nem rota', () => {
    expect(kmDoFrete(null)).toEqual({ km: null, previsto: true });
  });
});

describe('tempoDesde', () => {
  const agora = new Date('2026-09-30T12:00:00Z');
  const antes = (min: number) => new Date(agora.getTime() - min * 60_000).toISOString();

  it('fala em minutos, horas e dias', () => {
    expect(tempoDesde(antes(1), agora)).toBe('agora há pouco');
    expect(tempoDesde(antes(25), agora)).toBe('há 25 min');
    expect(tempoDesde(antes(180), agora)).toBe('há 3 h');
    expect(tempoDesde(antes(60 * 24), agora)).toBe('há 1 dia');
    expect(tempoDesde(antes(60 * 24 * 3), agora)).toBe('há 3 dias');
  });

  it('relogio adiantado nao vira tempo negativo', () => {
    expect(tempoDesde(antes(-10), agora)).toBe('agora há pouco');
  });
});
