import { describe, expect, it } from 'vitest';

import { esquemaEntrada, esquemaNovaSenha, esquemaRecuperar, validarNome } from '../esquema';

const valido = { nome: '', email: 'motorista@teste.local', senha: 'carga12345' };

describe('esquemaEntrada', () => {
  it('aceita login com o campo nome vazio', () => {
    // A regressao que este teste existe para impedir: com `.min(2)` no nome, o
    // formulario reprovava o '' do campo escondido e o botao Entrar nao fazia
    // nada - sem mensagem, porque o input nem estava na tela.
    expect(esquemaEntrada.safeParse(valido).success).toBe(true);
  });

  it('aceita login com nome ausente', () => {
    expect(esquemaEntrada.safeParse({ email: valido.email, senha: valido.senha }).success).toBe(
      true,
    );
  });

  it('rejeita e-mail invalido', () => {
    const r = esquemaEntrada.safeParse({ ...valido, email: 'nao-e-email' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('E-mail inválido');
  });

  it('rejeita senha curta', () => {
    const r = esquemaEntrada.safeParse({ ...valido, senha: 'curta' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toContain('8 caracteres');
  });
});

describe('validarNome', () => {
  it('nao exige nome para entrar', () => {
    expect(validarNome('entrar', '')).toBeNull();
    expect(validarNome('entrar', undefined)).toBeNull();
  });

  it('exige nome para criar conta', () => {
    expect(validarNome('criar', '')).toBe('Informe seu nome');
    expect(validarNome('criar', ' a ')).toBe('Informe seu nome');
    expect(validarNome('criar', 'Joao')).toBeNull();
  });
});

describe('esquemaRecuperar', () => {
  it('pede so o e-mail - nenhuma senha escondida pode reprovar o envio', () => {
    expect(esquemaRecuperar.safeParse({ email: ' motorista@teste.local ' }).success).toBe(true);
  });

  it('rejeita e-mail invalido', () => {
    const r = esquemaRecuperar.safeParse({ email: '' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('E-mail inválido');
  });
});

describe('esquemaNovaSenha', () => {
  it('aceita duas senhas iguais com 8 caracteres ou mais', () => {
    expect(esquemaNovaSenha.safeParse({ senha: 'carga12345', repetir: 'carga12345' }).success).toBe(
      true,
    );
  });

  it('usa a mesma regra de tamanho do cadastro', () => {
    const r = esquemaNovaSenha.safeParse({ senha: 'curta', repetir: 'curta' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['senha']);
    expect(r.error?.issues[0]?.message).toContain('8 caracteres');
  });

  it('acusa a diferenca no campo de repetir', () => {
    const r = esquemaNovaSenha.safeParse({ senha: 'carga12345', repetir: 'carga12346' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['repetir']);
    expect(r.error?.issues[0]?.message).toBe('As duas senhas não são iguais');
  });
});
