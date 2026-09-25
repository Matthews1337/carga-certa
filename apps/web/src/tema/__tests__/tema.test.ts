import { describe, expect, it } from 'vitest';

import { TEMAS, lerTema, proximoTema, resolverTema } from '../tema';

describe('lerTema', () => {
  it('aceita os tres valores validos', () => {
    for (const tema of TEMAS) {
      expect(lerTema(tema)).toBe(tema);
    }
  });

  it('cai em sistema quando nao ha nada guardado', () => {
    expect(lerTema(null)).toBe('sistema');
    expect(lerTema(undefined)).toBe('sistema');
  });

  it('cai em sistema quando o valor guardado e lixo', () => {
    // O localStorage e editavel pelo usuario e sobrevive a um rename de valor.
    expect(lerTema('dark')).toBe('sistema');
    expect(lerTema('')).toBe('sistema');
  });
});

describe('resolverTema', () => {
  it('ignora a preferencia do sistema quando o usuario escolheu', () => {
    expect(resolverTema('claro', 'escuro')).toBe('claro');
    expect(resolverTema('escuro', 'claro')).toBe('escuro');
  });

  it('segue o sistema quando a escolha e sistema', () => {
    expect(resolverTema('sistema', 'escuro')).toBe('escuro');
    expect(resolverTema('sistema', 'claro')).toBe('claro');
  });
});

describe('proximoTema', () => {
  it('cicla pelos tres estados e volta ao inicio', () => {
    expect(proximoTema('claro')).toBe('escuro');
    expect(proximoTema('escuro')).toBe('sistema');
    expect(proximoTema('sistema')).toBe('claro');
  });
});
