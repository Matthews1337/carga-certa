import { describe, expect, it } from 'vitest';

import { traduzirErroAuth } from '../mensagens';

describe('traduzirErroAuth', () => {
  it('traduz pelo codigo, mesmo que o texto em ingles mude', () => {
    expect(traduzirErroAuth({ code: 'same_password', message: 'qualquer redacao nova' })).toBe(
      'A nova senha precisa ser diferente da atual.',
    );
    expect(
      traduzirErroAuth({
        code: 'over_email_send_rate_limit',
        message: 'For security purposes, you can only request this after 42 seconds.',
      }),
    ).toContain('Espere um minuto');
  });

  it('cai no texto quando a resposta nao traz codigo', () => {
    expect(traduzirErroAuth({ message: 'Invalid login credentials' })).toBe(
      'E-mail ou senha incorretos.',
    );
    expect(traduzirErroAuth({ message: 'Auth session missing!' })).toContain('sessão expirou');
  });

  it('cai no texto quando o codigo e desconhecido', () => {
    expect(traduzirErroAuth({ code: 'codigo_novo', message: 'Email not confirmed' })).toContain(
      'Confirme seu e-mail',
    );
  });

  it('devolve o original quando nao conhece nem codigo nem texto', () => {
    expect(traduzirErroAuth({ code: 'codigo_novo', message: 'Something else' })).toBe(
      'Something else',
    );
  });
});
