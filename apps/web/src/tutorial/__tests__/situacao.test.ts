import { describe, expect, it } from 'vitest';

import {
  chaveLocalDoTutorial,
  fimRegistradoNoAparelho,
  fimRegistradoNoServidor,
  tutorialPendente,
} from '../situacao';

const id = 'usuario-1';

function armazenamentoCom(valores: Record<string, string>) {
  return { getItem: (chave: string) => valores[chave] ?? null };
}

const vazio = armazenamentoCom({});

describe('tutorialPendente', () => {
  it('aparece para quem nunca viu, em lugar nenhum', () => {
    expect(tutorialPendente({ id, user_metadata: { nome: 'Joao' } }, vazio)).toBe(true);
  });

  it('nao aparece para quem concluiu ou pulou, segundo o servidor', () => {
    expect(tutorialPendente({ id, user_metadata: { tutorial: 'concluido' } }, vazio)).toBe(false);
    expect(tutorialPendente({ id, user_metadata: { tutorial: 'pulado' } }, vazio)).toBe(false);
  });

  it('nao aparece quando so o aparelho tem a marca (gravacao no servidor falhou)', () => {
    const local = armazenamentoCom({ [chaveLocalDoTutorial(id)]: 'pulado' });
    expect(tutorialPendente({ id, user_metadata: {} }, local)).toBe(false);
  });

  it('ignora a marca de outro usuario no mesmo aparelho', () => {
    const local = armazenamentoCom({ [chaveLocalDoTutorial('outro')]: 'concluido' });
    expect(tutorialPendente({ id, user_metadata: {} }, local)).toBe(true);
  });

  it('ignora valores que nao sao do tutorial', () => {
    expect(tutorialPendente({ id, user_metadata: { tutorial: 'sim' } }, vazio)).toBe(true);
    expect(tutorialPendente({ id, user_metadata: null }, null)).toBe(true);
  });

  it('sobrevive ao localStorage que lanca (navegacao privada)', () => {
    const quebrado = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(fimRegistradoNoAparelho(id, quebrado)).toBeNull();
    expect(tutorialPendente({ id, user_metadata: {} }, quebrado)).toBe(true);
  });
});

describe('fimRegistradoNoServidor', () => {
  it('le o metadado do Supabase Auth', () => {
    expect(fimRegistradoNoServidor({ id, user_metadata: { tutorial: 'pulado' } })).toBe('pulado');
    expect(fimRegistradoNoServidor({ id })).toBeNull();
  });
});
