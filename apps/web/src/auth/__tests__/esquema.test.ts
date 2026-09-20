import { describe, expect, it } from 'vitest';

import { esquemaEntrada, validarNome } from '../esquema';

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
    expect(r.error?.issues[0]?.message).toBe('E-mail invalido');
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
