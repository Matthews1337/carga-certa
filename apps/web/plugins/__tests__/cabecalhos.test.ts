import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  cabecalhosGerais,
  hashesDeScriptsInline,
  montarArquivoHeaders,
  montarCsp,
} from '../cabecalhos';

const SUPABASE = 'https://mgtsaqvdlrlnvdmscghh.supabase.co';

describe('hashesDeScriptsInline', () => {
  it('bate com um hash calculado fora do codigo', () => {
    // Vetor calculado com o hashlib do Python, independente desta funcao:
    // conferir a funcao com ela mesma nao provaria nada.
    expect(hashesDeScriptsInline('<script>alert(1)</script>')).toEqual([
      'bhHHL3z2vDgxUt0W3dWQOrprscmda2Y5pLsLg4GF+pI=',
    ]);
  });

  it('ignora script com src, que ja e coberto por self', () => {
    const html = '<script type="module" crossorigin src="/assets/index.js"></script>';
    expect(hashesDeScriptsInline(html)).toEqual([]);
  });

  it('pega script inline com atributos, e todos os que houver', () => {
    const html = '<script type="text/javascript">a()</script><p/><script>b()</script>';
    expect(hashesDeScriptsInline(html)).toHaveLength(2);
  });

  it('um espaco a mais muda o hash - e por isso ele e recalculado no build', () => {
    const [a] = hashesDeScriptsInline('<script>alert(1)</script>');
    const [b] = hashesDeScriptsInline('<script>alert(1) </script>');
    expect(a).not.toBe(b);
  });

  it('encontra exatamente o script do tema no index.html real', () => {
    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
    const hashes = hashesDeScriptsInline(html);
    expect(hashes).toHaveLength(1);
    expect(hashes[0]).toMatch(/^[A-Za-z0-9+/]{43}=$/);
  });
});

describe('montarCsp', () => {
  const csp = montarCsp({ html: '<script>alert(1)</script>', urlSupabase: `${SUPABASE}/` });

  /** Extrai o valor de uma diretiva, para as checagens nao vazarem entre elas. */
  const diretiva = (nome: string) =>
    csp
      .split('; ')
      .find((d) => d.startsWith(`${nome} `))
      ?.slice(nome.length + 1);

  it('autoriza o script inline pelo hash, e NUNCA por unsafe-inline', () => {
    // E o script-src que impede XSS. Se um dia alguem "resolver" uma violacao
    // acrescentando 'unsafe-inline' aqui, a CSP inteira perde o sentido.
    expect(diretiva('script-src')).toBe(
      "'self' 'sha256-bhHHL3z2vDgxUt0W3dWQOrprscmda2Y5pLsLg4GF+pI='",
    );
    expect(csp).not.toContain('unsafe-eval');
  });

  it('libera estilo inline, que o Radix injeta com valor variavel por maquina', () => {
    expect(diretiva('style-src')).toBe("'self' 'unsafe-inline'");
  });

  it('fecha o vazamento via url() de CSS, que e o risco do estilo inline', () => {
    expect(diretiva('img-src')).toBe("'self'");
    expect(diretiva('font-src')).toBe("'self'");
  });

  it('libera conexao so para o host exato do projeto, sem barra final', () => {
    expect(csp).toContain(`connect-src 'self' ${SUPABASE};`);
  });

  it('NUNCA usa curinga - o atacante criaria o proprio projeto no Supabase', () => {
    expect(csp).not.toContain('*');
  });

  it('fecha plugins, base, formularios e iframe', () => {
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

describe('cabecalhosGerais', () => {
  it('em relatorio, so avisa', () => {
    const c = cabecalhosGerais({ csp: 'x', modo: 'relatorio' });
    expect(c['Content-Security-Policy-Report-Only']).toBe('x');
    expect(c['Content-Security-Policy']).toBeUndefined();
  });

  it('em bloqueio, bloqueia', () => {
    const c = cabecalhosGerais({ csp: 'x', modo: 'bloqueio' });
    expect(c['Content-Security-Policy']).toBe('x');
    expect(c['Content-Security-Policy-Report-Only']).toBeUndefined();
  });

  it('mantem os cabecalhos que moravam no netlify.toml', () => {
    const c = cabecalhosGerais({ csp: 'x', modo: 'relatorio' });
    expect(c['Strict-Transport-Security']).toBe('max-age=31536000');
    expect(c['X-Frame-Options']).toBe('DENY');
    expect(c['X-Content-Type-Options']).toBe('nosniff');
    expect(c['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });
});

describe('montarArquivoHeaders', () => {
  it('gera o formato do _headers da Netlify, com cache so nos assets', () => {
    const arquivo = montarArquivoHeaders({ 'X-Teste': '1' });
    expect(arquivo).toBe(
      '/*\n  X-Teste: 1\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n',
    );
  });
});
