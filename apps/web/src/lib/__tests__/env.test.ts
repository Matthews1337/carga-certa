import { describe, expect, it } from 'vitest';

import {
  normalizarUrlSupabase,
  problemaNaChaveSupabase,
  problemaNaUrlSupabase,
  problemasDoAmbiente,
} from '../env';

/** Monta um JWT falso com o payload dado. A assinatura nao importa aqui. */
function jwt(payload: object): string {
  const b64url = (o: object) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.assinatura`;
}

const REMOTA = 'https://mgtsaqvdlrlnvdmscghh.supabase.co';

describe('problemaNaUrlSupabase', () => {
  it('aceita o Project URL', () => {
    expect(problemaNaUrlSupabase(REMOTA)).toBeNull();
    expect(problemaNaUrlSupabase(`${REMOTA}/`)).toBeNull();
  });

  it('aceita o stack local em http', () => {
    expect(problemaNaUrlSupabase('http://127.0.0.1:54321')).toBeNull();
    expect(problemaNaUrlSupabase('http://localhost:54321')).toBeNull();
  });

  it('rejeita so o project ref, com o formato esperado na mensagem', () => {
    // Primeiro erro real em producao: "Invalid supabaseUrl".
    const erro = problemaNaUrlSupabase('mgtsaqvdlrlnvdmscghh');
    expect(erro).toContain('nao e uma URL');
    expect(erro).toContain('https://<ref>.supabase.co');
  });

  it('rejeita /rest/v1 no fim e diz o valor certo', () => {
    // Segundo erro real: "Invalid path specified in request URL", porque o
    // cliente montava /rest/v1/auth/v1/signup.
    const erro = problemaNaUrlSupabase(`${REMOTA}/rest/v1`);
    expect(erro).toContain('caminho a mais');
    expect(erro).toContain(`Use so o dominio: ${REMOTA}`);
  });

  it('rejeita qualquer outro caminho, query ou fragmento', () => {
    expect(problemaNaUrlSupabase(`${REMOTA}/auth/v1`)).toContain('caminho a mais');
    expect(problemaNaUrlSupabase(`${REMOTA}?x=1`)).toContain('caminho a mais');
    expect(problemaNaUrlSupabase(`${REMOTA}#x`)).toContain('caminho a mais');
  });

  it('rejeita http em host remoto, que o navegador bloquearia calado', () => {
    expect(problemaNaUrlSupabase('http://mgtsaqvdlrlnvdmscghh.supabase.co')).toContain('https');
  });

  it('rejeita ausencia', () => {
    expect(problemaNaUrlSupabase(undefined)).toContain('nao esta definida');
    expect(problemaNaUrlSupabase('   ')).toContain('nao esta definida');
  });
});

describe('normalizarUrlSupabase', () => {
  it('tira barra final e espacos', () => {
    expect(normalizarUrlSupabase(` ${REMOTA}/ `)).toBe(REMOTA);
  });
});

describe('problemaNaChaveSupabase', () => {
  it('aceita anon key classica e publishable key', () => {
    expect(problemaNaChaveSupabase(jwt({ role: 'anon' }))).toBeNull();
    expect(problemaNaChaveSupabase('sb_publishable_abc123')).toBeNull();
  });

  it('RECUSA a service_role, que ignora toda a RLS', () => {
    // O erro que nao quebra nada - e por isso o mais perigoso de todos.
    expect(problemaNaChaveSupabase(jwt({ role: 'service_role' }))).toContain('SECRETA');
    expect(problemaNaChaveSupabase('sb_secret_abc123')).toContain('SECRETA');
  });

  it('rejeita o que nao e chave, como a URL colada no campo errado', () => {
    expect(problemaNaChaveSupabase(REMOTA)).toContain('nao parece uma anon key');
    expect(problemaNaChaveSupabase('a.b.c')).toContain('nao parece uma anon key');
  });

  it('rejeita ausencia', () => {
    expect(problemaNaChaveSupabase('')).toContain('nao esta definida');
  });
});

describe('problemasDoAmbiente', () => {
  it('fica em silencio quando esta tudo certo', () => {
    expect(
      problemasDoAmbiente({
        VITE_SUPABASE_URL: REMOTA,
        VITE_SUPABASE_ANON_KEY: jwt({ role: 'anon' }),
      }),
    ).toBeNull();
  });

  it('lista os dois problemas e onde corrigir', () => {
    const msg = problemasDoAmbiente({
      VITE_SUPABASE_URL: `${REMOTA}/rest/v1`,
      VITE_SUPABASE_ANON_KEY: jwt({ role: 'service_role' }),
    });
    expect(msg).toContain('caminho a mais');
    expect(msg).toContain('SECRETA');
    expect(msg).toContain('novo deploy');
  });
});
