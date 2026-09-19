import { describe, expect, it } from 'vitest';

import {
  calcularConsumoMedio,
  calcularResultadoViagem,
  calcularSegmentosConsumo,
  precoMedioLitro,
  resumirDespesas,
  type DespesaParaResultado,
} from '../metrics';
import { parseValorDigitado, somar } from '../numeric';

describe('consumo entre tanques cheios', () => {
  const abastecimentos = [
    { odometro: 100_000, litros: 400, tanqueCheio: true }, // abre o trecho
    { odometro: 100_600, litros: 200, tanqueCheio: false }, // parcial no meio
    { odometro: 101_200, litros: 200, tanqueCheio: true }, // fecha e reabre
    { odometro: 102_000, litros: 250, tanqueCheio: true }, // fecha o segundo
  ];

  it('fecha um trecho a cada tanque cheio', () => {
    const segmentos = calcularSegmentosConsumo(abastecimentos);
    expect(segmentos).toHaveLength(2);
    // Os 400 L do primeiro abastecimento NAO contam: ja estavam no tanque.
    expect(segmentos[0]).toMatchObject({ km: 1200, litros: 400, kmPorLitro: 3 });
    expect(segmentos[1]).toMatchObject({ km: 800, litros: 250, kmPorLitro: 3.2 });
  });

  it('pondera pela distancia, nao pela media das medias', () => {
    // (1200 + 800) / (400 + 250) = 3.0769..., contra 3.1 da media simples.
    expect(calcularConsumoMedio(abastecimentos)).toBe(3.077);
  });

  it('nao inventa consumo sem dois tanques cheios', () => {
    expect(calcularConsumoMedio([])).toBeNull();
    expect(
      calcularConsumoMedio([{ odometro: 100_000, litros: 400, tanqueCheio: true }]),
    ).toBeNull();
    expect(
      calcularConsumoMedio([
        { odometro: 100_000, litros: 100, tanqueCheio: false },
        { odometro: 100_500, litros: 100, tanqueCheio: false },
      ]),
    ).toBeNull();
  });

  it('ordena pelo odometro antes de calcular', () => {
    const fora = [
      { odometro: 101_200, litros: 200, tanqueCheio: true },
      { odometro: 100_000, litros: 400, tanqueCheio: true },
    ];
    expect(calcularConsumoMedio(fora)).toBe(6); // 1200 km / 200 L
  });

  it('descarta trecho com odometro repetido em vez de dividir por zero', () => {
    const duplicado = [
      { odometro: 100_000, litros: 400, tanqueCheio: true },
      { odometro: 100_000, litros: 50, tanqueCheio: true },
    ];
    expect(calcularSegmentosConsumo(duplicado)).toHaveLength(0);
    expect(calcularConsumoMedio(duplicado)).toBeNull();
  });

  it('calcula preco medio ponderado pelo volume', () => {
    expect(
      precoMedioLitro([
        { litros: 100, precoLitro: 6 },
        { litros: 300, precoLitro: 5 },
      ]),
    ).toBe(5.25);
  });
});

describe('resultado da viagem', () => {
  const despesas: DespesaParaResultado[] = [
    { valor: 3000, status: 'CONFIRMADA', escopo: 'VEICULO' },
    { valor: '250.50', status: 'CONFIRMADA', escopo: 'PESSOAL' },
    { valor: 120, status: 'PENDENTE', escopo: 'ADMIN' },
    { valor: 9999, status: 'CANCELADA', escopo: 'VEICULO' },
  ];

  it('separa gasto do caminhao do gasto do piloto', () => {
    const r = resumirDespesas(despesas);
    expect(r.veiculo).toBe(3000);
    expect(r.pessoal).toBe(250.5);
    expect(r.admin).toBe(120);
  });

  it('ignora cancelada e mantem pendente, como a view do servidor', () => {
    expect(resumirDespesas(despesas).total).toBe(3370.5);
  });

  it('aceita numeric que chegou como string', () => {
    expect(resumirDespesas([{ valor: '1500.00', status: 'CONFIRMADA', escopo: 'VEICULO' }]).total)
      .toBe(1500);
  });

  it('calcula lucro, custo por km e margem', () => {
    const r = calcularResultadoViagem({ receitas: [8000], despesas, kmTotal: 1200 });
    expect(r.receitaTotal).toBe(8000);
    expect(r.despesaTotal).toBe(3370.5);
    expect(r.lucroLiquido).toBe(4629.5);
    expect(r.custoPorKm).toBe(2.8088);
    expect(r.margemPercentual).toBe(57.87);
  });

  it('nao divide por km ausente nem por receita zero', () => {
    const r = calcularResultadoViagem({ receitas: [], despesas, kmTotal: null });
    expect(r.custoPorKm).toBeNull();
    expect(r.margemPercentual).toBeNull();
    expect(r.lucroLiquido).toBe(-3370.5);
  });
});

describe('soma monetaria', () => {
  it('nao acumula erro de ponto flutuante', () => {
    expect(0.1 + 0.2).not.toBe(0.3); // a razao de somar() existir
    expect(somar([0.1, 0.2])).toBe(0.3);
  });

  it('fecha a conta em lote grande', () => {
    expect(somar(Array.from({ length: 300 }, () => 19.99))).toBe(5997);
  });
});

describe('parseValorDigitado', () => {
  it('le o teclado brasileiro', () => {
    expect(parseValorDigitado('1.234,56')).toBe(1234.56);
    expect(parseValorDigitado('R$ 1.234,56')).toBe(1234.56);
    expect(parseValorDigitado('0,50')).toBe(0.5);
  });

  it('le o teclado numerico do celular', () => {
    expect(parseValorDigitado('1234.56')).toBe(1234.56);
    expect(parseValorDigitado('1234')).toBe(1234);
  });

  it('trata ponto repetido como milhar', () => {
    expect(parseValorDigitado('1.234.567')).toBe(1234567);
  });

  it('rejeita o que nao e numero', () => {
    expect(parseValorDigitado('')).toBeNull();
    expect(parseValorDigitado('abc')).toBeNull();
    expect(parseValorDigitado('12,34,56')).toBeNull();
  });
});
