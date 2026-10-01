import { describe, expect, it } from 'vitest';

import {
  ANO_MAXIMO,
  esquemaDocumento,
  esquemaVeiculo,
  paraRegistro,
  parseInteiro,
  type CamposVeiculo,
} from '../esquema';

const base: CamposVeiculo = {
  tipoVeiculoId: '0192f3a0-0000-7000-8000-000000000001',
  placa: 'RTA1B23',
  renavam: '',
  marca: '',
  modelo: '',
  ano: '',
  cor: '',
  carroceria: 'NAO_APLICA',
  capacidadeKg: '',
  qtdEixos: '',
  odometroAtual: '',
  ativo: true,
};

const valida = (parcial: Partial<CamposVeiculo>) => esquemaVeiculo.safeParse({ ...base, ...parcial });
const mensagem = (parcial: Partial<CamposVeiculo>) => valida(parcial).error?.issues[0]?.message;

describe('esquemaVeiculo', () => {
  it('aceita o minimo: tipo e placa', () => {
    expect(valida({}).success).toBe(true);
  });

  it('aceita placa antiga e Mercosul, com hifen e minuscula', () => {
    for (const placa of ['ABC1234', 'abc-1234', 'RTA1B23', 'rta1b23']) {
      expect(valida({ placa }).success).toBe(true);
    }
  });

  it('recusa placa torta com mensagem que mostra o formato', () => {
    expect(mensagem({ placa: 'AB12345' })).toContain('ABC1D23');
  });

  it('placa vazia pede a placa, em vez de chama-la de invalida', () => {
    expect(mensagem({ placa: '  ' })).toBe('Informe a placa');
  });

  it('exige o tipo do veiculo', () => {
    expect(mensagem({ tipoVeiculoId: '' })).toBe('Escolha o tipo de veículo');
  });

  it('confere o RENAVAM so quando preenchido', () => {
    expect(valida({ renavam: '' }).success).toBe(true);
    expect(valida({ renavam: '0012.3456.789' }).success).toBe(true); // 11 digitos com pontuacao
    expect(mensagem({ renavam: '123' })).toBe('O RENAVAM tem 11 dígitos.');
  });

  it('segue o mesmo limite de ano que o CHECK do banco', () => {
    expect(valida({ ano: '1950' }).success).toBe(true);
    expect(valida({ ano: String(ANO_MAXIMO) }).success).toBe(true);
    expect(valida({ ano: '1949' }).success).toBe(false);
    expect(valida({ ano: String(ANO_MAXIMO + 1) }).success).toBe(false);
    expect(valida({ ano: '2020.5' }).success).toBe(false);
  });

  it('limita eixos entre 1 e 12, como o banco', () => {
    expect(valida({ qtdEixos: '3' }).success).toBe(true);
    expect(mensagem({ qtdEixos: '0' })).toBe('Entre 1 e 12 eixos.');
    expect(mensagem({ qtdEixos: '13' })).toBe('Entre 1 e 12 eixos.');
  });
});

describe('parseInteiro', () => {
  it('le numero com separador de milhar brasileiro', () => {
    // "27.000" em kg sao vinte e sete mil - e nao 27, que e o que um parse de
    // decimal devolveria.
    expect(parseInteiro('27.000')).toBe(27000);
    expect(parseInteiro('412 000')).toBe(412000);
  });

  it('devolve null para vazio, e nao zero', () => {
    expect(parseInteiro('')).toBeNull();
    expect(parseInteiro(undefined)).toBeNull();
  });
});

describe('paraRegistro', () => {
  it('normaliza a placa para o formato do banco', () => {
    expect(paraRegistro({ ...base, placa: 'abc-1234' }, 'TRACAO').placa).toBe('ABC1234');
  });

  it('grava vazio como null, nao como texto vazio', () => {
    const r = paraRegistro(base, 'TRACAO');
    expect(r.marca).toBeNull();
    expect(r.ano).toBeNull();
    expect(r.capacidade_kg).toBeNull();
  });

  it('guarda o odometro do cavalo', () => {
    expect(paraRegistro({ ...base, odometroAtual: '412.000' }, 'TRACAO').odometro_atual).toBe(412000);
  });

  it('zera o odometro do reboque, que nao tem motor', () => {
    expect(paraRegistro({ ...base, odometroAtual: '50.000' }, 'REBOQUE').odometro_atual).toBe(0);
  });

  it('usa a natureza recebida, que vem do tipo e nao do usuario', () => {
    expect(paraRegistro(base, 'REBOQUE').natureza).toBe('REBOQUE');
  });
});

describe('esquemaDocumento', () => {
  const doc = { tipoDocumentoId: '0192f3a0-0000-7000-8000-000000000002', numero: '', emissao: '', validade: '' };

  it('aceita documento sem datas', () => {
    expect(esquemaDocumento.safeParse(doc).success).toBe(true);
  });

  it('aceita validade depois ou no mesmo dia da emissao', () => {
    expect(esquemaDocumento.safeParse({ ...doc, emissao: '2026-01-10', validade: '2027-01-10' }).success).toBe(true);
    expect(esquemaDocumento.safeParse({ ...doc, emissao: '2026-01-10', validade: '2026-01-10' }).success).toBe(true);
  });

  it('recusa validade antes da emissao, com o erro no campo validade', () => {
    const r = esquemaDocumento.safeParse({ ...doc, emissao: '2026-05-01', validade: '2026-04-30' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['validade']);
    expect(r.error?.issues[0]?.message).toBe('A validade não pode ser antes da emissão.');
  });

  it('compara pela data, nao pelo texto solto: dezembro antes de janeiro do ano seguinte', () => {
    expect(esquemaDocumento.safeParse({ ...doc, emissao: '2026-12-15', validade: '2027-01-05' }).success).toBe(true);
  });

  it('exige o tipo do documento', () => {
    expect(esquemaDocumento.safeParse({ ...doc, tipoDocumentoId: '' }).error?.issues[0]?.message).toBe(
      'Escolha o documento',
    );
  });
});
