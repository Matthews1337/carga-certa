import { describe, expect, it } from 'vitest';

import { entraNoMenuDeDespesa, fimDaViagem } from '../viagem';

// Datas montadas no fuso local, como o mes do app (ver mes.ts).
const agora = new Date(2026, 9, 15, 10, 0);
const iso = (...partes: [number, number, number, number?]) =>
  new Date(partes[0], partes[1], partes[2], partes[3] ?? 12).toISOString();

describe('fimDaViagem', () => {
  it('concluida sem fim gravado: agora', () => {
    expect(fimDaViagem('CONCLUIDA', iso(2026, 9, 10), null, agora)).toBe(agora.toISOString());
  });

  it('concluida com fim gravado pelo celular: mantem o do celular', () => {
    const doCelular = iso(2026, 9, 12, 18);
    expect(fimDaViagem('CONCLUIDA', iso(2026, 9, 10), doCelular, agora)).toBe(doCelular);
  });

  it('nunca antes do inicio: marcada para amanha e concluida hoje termina no inicio', () => {
    const amanha = iso(2026, 9, 16);
    expect(fimDaViagem('CONCLUIDA', amanha, null, agora)).toBe(amanha);
  });

  it('reaberta: sem fim, para nao sair do menu quando concluir de novo', () => {
    for (const status of ['PLANEJADA', 'EM_ANDAMENTO', 'PAUSADA'] as const) {
      expect(fimDaViagem(status, iso(2026, 8, 20), iso(2026, 8, 30), agora)).toBeNull();
    }
  });

  it('cancelada: so o que ja estava gravado', () => {
    expect(fimDaViagem('CANCELADA', iso(2026, 9, 10), null, agora)).toBeNull();
    expect(fimDaViagem('CANCELADA', iso(2026, 9, 10), iso(2026, 9, 11), agora)).toBe(iso(2026, 9, 11));
  });
});

describe('entraNoMenuDeDespesa', () => {
  const viagem = (status: Parameters<typeof entraNoMenuDeDespesa>[0]['status'], inicioEm: string | null, fimEm: string | null = null) =>
    entraNoMenuDeDespesa({ status, inicioEm, fimEm }, agora);

  it('aberta entra, mesmo comecada meses atras', () => {
    expect(viagem('EM_ANDAMENTO', iso(2026, 6, 1))).toBe(true);
    expect(viagem('PAUSADA', iso(2026, 8, 1))).toBe(true);
    expect(viagem('PLANEJADA', null)).toBe(true);
  });

  it('encerrada no mes atual entra; no mes anterior, sai', () => {
    expect(viagem('CONCLUIDA', iso(2026, 8, 25), iso(2026, 9, 2))).toBe(true);
    expect(viagem('CONCLUIDA', iso(2026, 8, 25), iso(2026, 8, 30))).toBe(false);
    expect(viagem('CANCELADA', iso(2026, 8, 25), iso(2026, 8, 30))).toBe(false);
  });

  it('o limite e o primeiro instante do mes, no fuso local', () => {
    expect(viagem('CONCLUIDA', null, new Date(2026, 9, 1, 0, 0).toISOString())).toBe(true);
    expect(viagem('CONCLUIDA', null, new Date(2026, 8, 30, 23, 59).toISOString())).toBe(false);
  });

  it('sem fim gravado, vale o inicio', () => {
    expect(viagem('CONCLUIDA', iso(2026, 9, 3))).toBe(true);
    expect(viagem('CONCLUIDA', iso(2026, 8, 3))).toBe(false);
  });

  it('sem data nenhuma, fica', () => {
    expect(viagem('CONCLUIDA', null)).toBe(true);
  });
});
