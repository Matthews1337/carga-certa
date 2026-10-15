import { describe, expect, it } from 'vitest';

import {
  SEM_VINCULO,
  diaLocal,
  esquemaViagem,
  inicioDaViagem,
  meioDiaLocal,
  paraRegistroViagem,
  type CamposViagem,
} from '../esquema';

const base: CamposViagem = {
  origem: { nome: 'Uberlândia, MG', lat: -18.9186, lng: -48.2772 },
  destino: { nome: 'Rio Verde, GO', lat: -17.7977812, lng: -50.9280634 },
  veiculoTracaoId: '0192f3a0-0000-7000-8000-000000000001',
  veiculoReboqueId: SEM_VINCULO,
  inicio: '2026-10-15',
  status: 'PLANEJADA',
};
const rota = { polyline: 'abc', distanciaKm: 338.84 };

const mensagem = (parcial: Partial<CamposViagem>) =>
  esquemaViagem.safeParse({ ...base, ...parcial }).error?.issues[0]?.message;

describe('esquemaViagem', () => {
  it('aceita a viagem completa', () => {
    expect(esquemaViagem.safeParse(base).success).toBe(true);
  });

  it('exige inicio, fim e o caminhao', () => {
    expect(mensagem({ origem: null })).toBe('Marque onde a viagem começa');
    expect(mensagem({ destino: null })).toBe('Marque onde a viagem termina');
    expect(mensagem({ veiculoTracaoId: '' })).toBe('Escolha o caminhão ou o cavalo');
  });

  it('aceita qualquer status da viagem, inclusive pausada', () => {
    expect(esquemaViagem.safeParse({ ...base, status: 'PAUSADA' }).success).toBe(true);
  });
});

describe('paraRegistroViagem', () => {
  it('viagem sem frete: frete_id nulo, sem carreta vira null, rota e km gravados', () => {
    expect(paraRegistroViagem(base, rota, 'v')).toMatchObject({
      id: 'v',
      frete_id: null,
      veiculo_reboque_id: null,
      status: 'PLANEJADA',
      origem_nome: 'Uberlândia, MG',
      destino_lat: -17.797781,
      rota_polyline: 'abc',
      km_previsto: 338.8,
    });
  });

  it('concluida: fim gravado pelo celular fica; sem ele, agora', () => {
    const gravadas = { inicio_em: meioDiaLocal('2026-10-15'), fim_em: new Date(2026, 9, 16, 9, 20).toISOString() };
    expect(paraRegistroViagem({ ...base, status: 'CONCLUIDA' }, rota, 'v', gravadas).fim_em).toBe(gravadas.fim_em);
    expect(paraRegistroViagem({ ...base, status: 'CONCLUIDA' }, rota, 'v').fim_em).not.toBeNull();
    expect(paraRegistroViagem(base, rota, 'v', gravadas).fim_em).toBeNull();
  });

  it('sem rota calculada, grava so os pontos', () => {
    const viagem = paraRegistroViagem(base, null, 'v');
    expect(viagem.rota_polyline).toBeNull();
    expect(viagem.km_previsto).toBeNull();
  });
});

describe('inicioDaViagem', () => {
  it('dia novo: meio-dia local, que cai no mesmo dia em todo o Brasil', () => {
    const inicio = inicioDaViagem('2026-10-15');
    expect(inicio).toBe(meioDiaLocal('2026-10-15'));
    expect(diaLocal(inicio)).toBe('2026-10-15');
    expect(new Date(inicio).getHours()).toBe(12);
  });

  it('mesmo dia: mantem a hora que o celular gravou', () => {
    const doCelular = new Date(2026, 9, 15, 5, 32).toISOString();
    expect(inicioDaViagem('2026-10-15', doCelular)).toBe(doCelular);
  });

  it('dia mudado: vale o novo, ao meio-dia', () => {
    const doCelular = new Date(2026, 9, 15, 5, 32).toISOString();
    expect(inicioDaViagem('2026-10-16', doCelular)).toBe(meioDiaLocal('2026-10-16'));
  });
});
