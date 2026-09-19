import { describe, expect, it } from 'vitest';

import { dataDoUuidV7, isUuidV7, uuidv7 } from '../uuid';

describe('uuidv7', () => {
  it('gera no formato da RFC 9562, versao 7 e variante correta', () => {
    for (let i = 0; i < 100; i += 1) {
      expect(isUuidV7(uuidv7())).toBe(true);
    }
  });

  it('nao repete', () => {
    const ids = new Set(Array.from({ length: 10_000 }, uuidv7));
    expect(ids.size).toBe(10_000);
  });

  it('mantem ordem lexicografica dentro do mesmo milissegundo', () => {
    // Este e o motivo de existir a sequencia: sem ela, dois ids gerados no mesmo
    // ms ordenariam pelo bloco aleatorio, e a lista de despesas salvas de uma vez
    // apareceria fora da ordem em que o motorista digitou.
    const ids = Array.from({ length: 5_000 }, uuidv7);
    const ordenados = [...ids].sort();
    expect(ids).toEqual(ordenados);
  });

  it('embute um timestamp proximo do relogio atual', () => {
    const antes = Date.now();
    const data = dataDoUuidV7(uuidv7());
    expect(data).not.toBeNull();
    const ms = (data as Date).getTime();
    expect(ms).toBeGreaterThanOrEqual(antes - 1);
    expect(ms).toBeLessThanOrEqual(Date.now() + 1);
  });

  it('rejeita uuid v4 e lixo', () => {
    expect(isUuidV7('9f1b3a2c-5d4e-4f6a-8b7c-1d2e3f4a5b6c')).toBe(false); // versao 4
    expect(isUuidV7('nao-e-uuid')).toBe(false);
    expect(dataDoUuidV7('nao-e-uuid')).toBeNull();
  });
});
