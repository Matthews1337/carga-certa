import { describe, expect, it } from 'vitest';

import {
  SEM_VINCULO,
  diaLocal,
  esquemaFrete,
  meioDiaLocal,
  paraRegistros,
  type CamposFrete,
} from '../esquema';

const base: CamposFrete = {
  origem: { nome: 'Rio Verde, GO', lat: -17.7977812, lng: -50.9280634 },
  destino: { nome: 'Porto de Santos, SP', lat: -23.96083, lng: -46.33361 },
  veiculoTracaoId: '0192f3a0-0000-7000-8000-000000000001',
  veiculoReboqueId: SEM_VINCULO,
  contratanteId: SEM_VINCULO,
  valor: '12.800',
  inicio: '2026-10-05',
  situacao: 'CONTRATADO',
};
const ids = { frete: 'f', viagem: 'v' };
const rota = { polyline: 'abc', distanciaKm: 997.54 };

const mensagem = (parcial: Partial<CamposFrete>) =>
  esquemaFrete.safeParse({ ...base, ...parcial }).error?.issues[0]?.message;

describe('esquemaFrete', () => {
  it('aceita o frete completo', () => {
    expect(esquemaFrete.safeParse(base).success).toBe(true);
  });

  it('exige origem e destino marcados', () => {
    expect(mensagem({ origem: null })).toBe('Marque onde o frete começa');
    expect(mensagem({ destino: null })).toBe('Marque onde o frete termina');
  });

  it('exige o veiculo de tracao', () => {
    expect(mensagem({ veiculoTracaoId: '' })).toBe('Escolha o caminhão ou o cavalo');
  });

  it('exige valor maior que zero', () => {
    expect(mensagem({ valor: '' })).toBe('Informe o valor combinado');
    expect(mensagem({ valor: '0' })).toBe('Valor inválido');
  });
});

describe('paraRegistros', () => {
  it('frete novo: vinculos vazios viram null, "12.800" vira 12800, viagem planejada', () => {
    const { frete, viagem } = paraRegistros(base, rota, ids);
    expect(frete).toEqual({ id: 'f', contratante_id: null, valor_total: 12800, status: 'CONTRATADO' });
    expect(viagem).toMatchObject({
      id: 'v',
      frete_id: 'f',
      veiculo_reboque_id: null,
      status: 'PLANEJADA',
      rota_polyline: 'abc',
      km_previsto: 997.5,
      origem_lat: -17.797781,
    });
  });

  it('sem rota calculada, grava os pontos sem rota', () => {
    const { viagem } = paraRegistros(base, null, ids);
    expect(viagem.rota_polyline).toBeNull();
    expect(viagem.km_previsto).toBeNull();
  });

  it('inicio vai ao meio-dia local, que cai no mesmo dia em todo o Brasil', () => {
    const { viagem } = paraRegistros(base, rota, ids);
    expect(viagem.inicio_em).toBe(meioDiaLocal('2026-10-05'));
    expect(diaLocal(viagem.inicio_em)).toBe('2026-10-05');
    expect(new Date(viagem.inicio_em).getHours()).toBe(12);
  });

  it('cancelar o frete cancela a viagem (o Painel deixa de contar)', () => {
    expect(paraRegistros({ ...base, situacao: 'CANCELADO' }, rota, ids).viagem.status).toBe('CANCELADA');
  });

  describe('edicao nao atropela o celular', () => {
    const inicioDoCelular = new Date(2026, 9, 5, 5, 32).toISOString();
    const original = {
      situacao: 'EM_ANDAMENTO' as const,
      statusViagem: 'PAUSADA' as const,
      inicioEm: inicioDoCelular,
    };

    it('mesmo dia: mantem a hora em que o celular iniciou', () => {
      const { viagem } = paraRegistros({ ...base, situacao: 'EM_ANDAMENTO' }, rota, ids, original);
      expect(viagem.inicio_em).toBe(inicioDoCelular);
    });

    it('mesma situacao: mantem o status que o celular deu a viagem', () => {
      const { viagem } = paraRegistros({ ...base, situacao: 'EM_ANDAMENTO' }, rota, ids, original);
      expect(viagem.status).toBe('PAUSADA');
    });

    it('situacao mudada no web: a viagem acompanha', () => {
      const { viagem } = paraRegistros({ ...base, situacao: 'CONCLUIDO' }, rota, ids, original);
      expect(viagem.status).toBe('CONCLUIDA');
    });

    it('dia mudado no web: vale o novo dia, ao meio-dia', () => {
      const { viagem } = paraRegistros(
        { ...base, inicio: '2026-10-06', situacao: 'EM_ANDAMENTO' },
        rota,
        ids,
        original,
      );
      expect(viagem.inicio_em).toBe(meioDiaLocal('2026-10-06'));
    });
  });
});
