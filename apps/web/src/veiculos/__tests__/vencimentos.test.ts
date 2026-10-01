import { describe, expect, it } from 'vitest';

import type { DocumentoResumo } from '../api';
import { avisoDeVencimento } from '../vencimentos';

// 29/09/2026 as 10h, no fuso local.
const hoje = new Date(2026, 8, 29, 10, 0);

let proximoId = 0;
const doc = (nome: string | null, validade: string | null): DocumentoResumo => ({
  id: String(++proximoId),
  validade,
  tipo: nome ? { nome } : null,
});

describe('avisoDeVencimento', () => {
  it('sem documento com validade nao ha aviso', () => {
    expect(avisoDeVencimento([], hoje)).toBeNull();
    expect(avisoDeVencimento([doc('RNTRC / ANTT', null)], hoje)).toBeNull();
  });

  it('tudo longe de vencer: documentos em dia', () => {
    expect(avisoDeVencimento([doc('CRLV', '2027-03-01'), doc('Seguro de carga', null)], hoje)).toEqual({
      situacao: 'OK',
      texto: 'Documentos em dia',
      outros: 0,
    });
  });

  it('o vencido passa na frente do que vence amanha', () => {
    const aviso = avisoDeVencimento(
      [doc('Cronotacógrafo', '2026-09-30'), doc('CRLV', '2026-09-26'), doc('Seguro de carga', '2027-01-01')],
      hoje,
    );
    expect(aviso).toEqual({ situacao: 'VENCIDO', texto: 'CRLV vencido há 3 dias', outros: 1 });
  });

  it('na mesma faixa, o que vence antes', () => {
    const aviso = avisoDeVencimento(
      [doc('Seguro obrigatório', '2026-10-20'), doc('Licença AET', '2026-10-10')],
      hoje,
    );
    expect(aviso?.texto).toBe('Licença AET vence em 11 dias');
    expect(aviso?.situacao).toBe('ATENCAO');
    expect(aviso?.outros).toBe(1);
  });

  it('le a data no fuso local: validade hoje ainda nao venceu', () => {
    expect(avisoDeVencimento([doc('CRLV', '2026-09-29')], hoje)).toMatchObject({
      situacao: 'CRITICO',
      texto: 'CRLV vence hoje',
    });
  });

  it('documento sem tipo carregado ainda aparece', () => {
    expect(avisoDeVencimento([doc(null, '2026-09-28')], hoje)?.texto).toBe('Documento vencido ontem');
  });
});
