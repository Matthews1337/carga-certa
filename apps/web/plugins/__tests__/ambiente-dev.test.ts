import { describe, expect, it } from 'vitest';

import { ehHostLocal, supabaseResponde } from '../ambiente-dev';

describe('ehHostLocal', () => {
  it('reconhece o Supabase do Docker', () => {
    expect(ehHostLocal('http://127.0.0.1:54321')).toBe(true);
    expect(ehHostLocal('http://localhost:54321')).toBe(true);
  });

  it('trata o projeto hospedado como remoto', () => {
    expect(ehHostLocal('https://mgtsaqvdlrlnvdmscghh.supabase.co')).toBe(false);
  });

  it('nao se engana com host que so contem a palavra', () => {
    expect(ehHostLocal('https://localhost.atacante.com')).toBe(false);
  });

  it('trata URL invalida como nao local, em vez de lancar', () => {
    expect(ehHostLocal('nao e url')).toBe(false);
  });
});

describe('supabaseResponde', () => {
  it('devolve false quando nada escuta na porta, sem esperar o timeout inteiro', async () => {
    // Porta 1: conexao recusada na hora. E o caso "Docker parado".
    const inicio = Date.now();
    expect(await supabaseResponde('http://127.0.0.1:1', undefined, 5000)).toBe(false);
    expect(Date.now() - inicio).toBeLessThan(4000);
  });
});
