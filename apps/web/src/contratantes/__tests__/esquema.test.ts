import { describe, expect, it } from 'vitest';

import { esquemaContratante, paraRegistro, type CamposContratante } from '../esquema';

const base: CamposContratante = { nome: 'Agro Cerrado Ltda', cnpj: '', contato: '', telefone: '' };

const valida = (parcial: Partial<CamposContratante>) =>
  esquemaContratante.safeParse({ ...base, ...parcial });
const mensagem = (parcial: Partial<CamposContratante>) => valida(parcial).error?.issues[0]?.message;

describe('esquemaContratante', () => {
  it('aceita so o nome', () => {
    expect(valida({}).success).toBe(true);
  });

  it('exige o nome, e espaco em branco nao conta', () => {
    expect(mensagem({ nome: '   ' })).toBe('Informe o nome');
  });

  it('aceita CNPJ numerico e alfanumerico, com ou sem mascara', () => {
    for (const cnpj of ['11.222.333/0001-81', '11222333000181', '12.ABC.345/01DE-35', '12abc34501de35']) {
      expect(valida({ cnpj }).success).toBe(true);
    }
  });

  it('recusa CNPJ com digito errado', () => {
    expect(mensagem({ cnpj: '11.222.333/0001-82' })).toContain('CNPJ inválido');
  });

  it('recusa telefone sem DDD, com mensagem de exemplo', () => {
    expect(mensagem({ telefone: '99999-8888' })).toContain('(62) 99999-8888');
  });
});

describe('paraRegistro', () => {
  it('grava CNPJ e telefone limpos', () => {
    expect(
      paraRegistro({
        nome: '  Agro Cerrado  ',
        cnpj: '12.abc.345/01de-35',
        contato: ' Marcos ',
        telefone: '+55 (62) 99999-8888',
      }),
    ).toEqual({
      nome: 'Agro Cerrado',
      cnpj: '12ABC34501DE35',
      contato: 'Marcos',
      telefone: '62999998888',
    });
  });

  it('grava vazio como null, nao como texto vazio', () => {
    expect(paraRegistro(base)).toEqual({
      nome: 'Agro Cerrado Ltda',
      cnpj: null,
      contato: null,
      telefone: null,
    });
  });
});
