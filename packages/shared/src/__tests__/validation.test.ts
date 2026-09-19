import { describe, expect, it } from 'vitest';

import { formatarCpf, isCpfValido } from '../validation/cpf';
import { formatarCnpj, isCnpjValido, limparCnpj } from '../validation/cnpj';
import { formatarPlaca, isPlacaValida, padraoDaPlaca } from '../validation/placa';
import { categoriaAtende, isCategoriaCnhValida, normalizarCategoriaCnh } from '../validation/cnh';

describe('CPF', () => {
  it('aceita CPF valido com e sem pontuacao', () => {
    expect(isCpfValido('529.982.247-25')).toBe(true);
    expect(isCpfValido('52998224725')).toBe(true);
  });

  it('rejeita digito verificador errado', () => {
    expect(isCpfValido('529.982.247-26')).toBe(false);
  });

  it('rejeita sequencias repetidas, que passam no calculo do DV', () => {
    for (const d of '0123456789') {
      expect(isCpfValido(d.repeat(11))).toBe(false);
    }
  });

  it('rejeita tamanho errado', () => {
    expect(isCpfValido('5299822472')).toBe(false);
    expect(isCpfValido('529982247250')).toBe(false);
  });

  it('formata', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25');
  });
});

describe('CNPJ', () => {
  it('aceita CNPJ numerico valido', () => {
    expect(isCnpjValido('11.222.333/0001-81')).toBe(true);
    expect(isCnpjValido('11222333000181')).toBe(true);
  });

  it('rejeita digito verificador errado', () => {
    expect(isCnpjValido('11222333000182')).toBe(false);
  });

  it('aceita CNPJ alfanumerico (regra de julho/2026)', () => {
    // DV calculado pela formula charCodeAt-48 sobre a raiz '12ABC34501DE'.
    expect(isCnpjValido('12ABC34501DE35')).toBe(true);
    expect(isCnpjValido('12.ABC.345/01DE-35')).toBe(true);
  });

  it('rejeita DV alfabetico: os dois ultimos sao sempre numericos', () => {
    expect(isCnpjValido('12ABC34501DEAB')).toBe(false);
  });

  it('rejeita repeticoes', () => {
    expect(isCnpjValido('00000000000000')).toBe(false);
  });

  it('normaliza para maiusculas sem pontuacao', () => {
    expect(limparCnpj('12.abc.345/01de-35')).toBe('12ABC34501DE35');
  });

  it('formata', () => {
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });
});

describe('Placa', () => {
  it('aceita os dois padroes', () => {
    expect(isPlacaValida('ABC1234')).toBe(true);
    expect(isPlacaValida('ABC1D23')).toBe(true);
    expect(isPlacaValida('abc-1234')).toBe(true);
  });

  it('distingue antiga de Mercosul', () => {
    expect(padraoDaPlaca('ABC1234')).toBe('ANTIGA');
    expect(padraoDaPlaca('ABC1D23')).toBe('MERCOSUL');
    expect(padraoDaPlaca('AB1234')).toBeNull();
  });

  it('rejeita formato invalido', () => {
    expect(isPlacaValida('AB12345')).toBe(false);
    expect(isPlacaValida('ABCD123')).toBe(false);
    expect(isPlacaValida('ABC12D3')).toBe(false);
  });

  it('so poe hifen na placa antiga', () => {
    expect(formatarPlaca('ABC1234')).toBe('ABC-1234');
    expect(formatarPlaca('ABC1D23')).toBe('ABC1D23');
  });
});

describe('CNH', () => {
  it('canoniza a ordem das letras', () => {
    expect(normalizarCategoriaCnh('ea')).toBe('AE');
    expect(normalizarCategoriaCnh('A-E')).toBe('AE');
  });

  it('aceita so as categorias que o Detran emite', () => {
    expect(isCategoriaCnhValida('E')).toBe(true);
    expect(isCategoriaCnhValida('AE')).toBe(true);
    expect(isCategoriaCnhValida('BC')).toBe(false);
    expect(isCategoriaCnhValida('ABCDE')).toBe(false);
  });

  it('respeita a hierarquia E > D > C > B', () => {
    expect(categoriaAtende('E', 'C')).toBe(true);
    expect(categoriaAtende('E', 'B')).toBe(true);
    expect(categoriaAtende('C', 'E')).toBe(false);
    expect(categoriaAtende('B', 'C')).toBe(false);
  });

  it('trata A como independente', () => {
    expect(categoriaAtende('E', 'A')).toBe(false);
    expect(categoriaAtende('AE', 'A')).toBe(true);
  });

  it('sem exigencia, qualquer categoria serve (reboque nao tem CNH minima)', () => {
    expect(categoriaAtende('B', null)).toBe(true);
  });
});
