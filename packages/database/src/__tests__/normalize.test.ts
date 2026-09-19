import { describe, expect, it } from 'vitest';

import { normalizarPull, normalizarPush } from '../normalize';
import { COLUNAS_NUMERICAS } from '../schema';

const vazio = { created: [], updated: [], deleted: [] };

describe('COLUNAS_NUMERICAS', () => {
  it('sai do proprio schema, sem lista paralela para desatualizar', () => {
    expect(COLUNAS_NUMERICAS.despesa).toContain('valor');
    expect(COLUNAS_NUMERICAS.despesa).toContain('latitude');
    expect(COLUNAS_NUMERICAS.despesa).not.toContain('descricao');
    expect(COLUNAS_NUMERICAS.abastecimento).toEqual(
      expect.arrayContaining(['litros', 'preco_litro', 'odometro']),
    );
  });

  it('nao conhece piloto_id nem deleted_at: nao existem no cliente', () => {
    for (const colunas of Object.values(COLUNAS_NUMERICAS)) {
      expect(colunas).not.toContain('piloto_id');
      expect(colunas).not.toContain('deleted_at');
    }
  });
});

describe('normalizarPull', () => {
  it('converte numeric que veio como string', () => {
    const saida = normalizarPull({
      despesa: {
        created: [{ id: 'a', valor: '1500.50', latitude: '-23.5505', descricao: 'Diesel' }],
        updated: [],
        deleted: [],
      },
    });

    const r = saida.despesa?.created[0];
    expect(r?.valor).toBe(1500.5);
    expect(r?.latitude).toBe(-23.5505);
    expect(r?.descricao).toBe('Diesel'); // texto nao e tocado
  });

  it('deixa numero passar intacto', () => {
    const saida = normalizarPull({
      despesa: { created: [{ id: 'a', valor: 99.9 }], updated: [], deleted: [] },
    });
    expect(saida.despesa?.created[0]?.valor).toBe(99.9);
  });

  it('converte timestamptz ISO para epoch ms', () => {
    const saida = normalizarPull({
      despesa: {
        created: [],
        updated: [{ id: 'a', data_hora: '2026-09-19T12:00:00+00:00' }],
        deleted: [],
      },
    });
    expect(saida.despesa?.updated[0]?.data_hora).toBe(Date.parse('2026-09-19T12:00:00Z'));
  });

  it('a conversao de instante ganha da numerica generica', () => {
    // data_hora e declarada `number` no schema, entao a passada numerica a
    // transformaria em NaN -> null. A ordem das duas etapas e o que salva.
    const saida = normalizarPull({
      viagem: {
        created: [{ id: 'v', inicio_em: '2026-01-02T03:04:05-03:00', km_total: '1200.00' }],
        updated: [],
        deleted: [],
      },
    });
    expect(saida.viagem?.created[0]?.inicio_em).toBe(Date.parse('2026-01-02T06:04:05Z'));
    expect(saida.viagem?.created[0]?.km_total).toBe(1200);
  });

  it('preserva nulos em vez de virar 0', () => {
    const saida = normalizarPull({
      viagem: {
        created: [{ id: 'v', odometro_final: null, fim_em: null }],
        updated: [],
        deleted: [],
      },
    });
    expect(saida.viagem?.created[0]?.odometro_final).toBeNull();
    expect(saida.viagem?.created[0]?.fim_em).toBeNull();
  });

  it('nao mexe em coluna `date`, que fica texto nos dois lados', () => {
    const saida = normalizarPull({
      cnh: { created: [{ id: 'c', validade: '2030-04-12' }], updated: [], deleted: [] },
    });
    expect(saida.cnh?.created[0]?.validade).toBe('2030-04-12');
  });

  it('repassa a lista de exclusoes', () => {
    const saida = normalizarPull({
      despesa: { created: [], updated: [], deleted: ['id-1', 'id-2'] },
    });
    expect(saida.despesa?.deleted).toEqual(['id-1', 'id-2']);
  });

  it('atravessa tabela sem colunas especiais sem alterar nada', () => {
    const saida = normalizarPull({ contratante: { ...vazio } });
    expect(saida.contratante).toEqual(vazio);
  });
});

describe('normalizarPush', () => {
  it('devolve o instante como ISO, que e o que jsonb_populate_record aceita', () => {
    const ms = Date.parse('2026-09-19T12:00:00Z');
    const saida = normalizarPush({
      despesa: {
        created: [],
        updated: [{ id: 'a', data_hora: ms, valor: 150 }],
        deleted: [],
      },
    });
    expect(saida.despesa?.updated[0]?.data_hora).toBe('2026-09-19T12:00:00.000Z');
    expect(saida.despesa?.updated[0]?.valor).toBe(150); // numero segue numero
  });

  it('mantem nulo como nulo', () => {
    const saida = normalizarPush({
      viagem: { created: [{ id: 'v', fim_em: null }], updated: [], deleted: [] },
    });
    expect(saida.viagem?.created[0]?.fim_em).toBeNull();
  });

  it('ida e volta nao perde o instante', () => {
    const iso = '2026-09-19T12:34:56.000Z';
    const local = normalizarPull({
      despesa: { created: [{ id: 'a', data_hora: iso }], updated: [], deleted: [] },
    });
    const servidor = normalizarPush(local);
    expect(servidor.despesa?.created[0]?.data_hora).toBe(iso);
  });
});
