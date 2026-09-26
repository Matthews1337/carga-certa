import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Plugin, ResolvedConfig } from 'vite';

import { normalizarUrlSupabase } from '../src/lib/env';

/**
 * Cabecalhos HTTP de seguranca, gerados no build.
 *
 * Todos os cabecalhos do site moram aqui, e nao no netlify.toml, por dois
 * motivos.
 *
 * O primeiro: a CSP depende de valores que mudam. A URL do Supabase ja e
 * variavel de ambiente, e o script inline do tema no index.html precisa ser
 * autorizado pelo seu hash. Escrita a mao, a URL ficaria duplicada, e bastaria
 * alguem mexer numa virgula do script do tema para o hash deixar de bater - e o
 * tema escuro quebrar calado no dia em que a politica passasse a bloquear.
 * Aqui os dois se recalculam a cada build.
 *
 * O segundo: a documentacao da Netlify nao diz o que acontece quando o
 * _headers e o netlify.toml definem cabecalhos para o mesmo caminho. Com tudo
 * num lugar so, nao ha precedencia para adivinhar.
 */

/**
 * `relatorio`: o navegador so AVISA no console o que seria bloqueado.
 * `bloqueio`: o navegador bloqueia de fato.
 *
 * Comece sempre em `relatorio`. Uma politica errada em `bloqueio` quebra a
 * tela em silencio, e so para quem usar a parte afetada.
 */
export type ModoCsp = 'relatorio' | 'bloqueio';

// Casa <script ...>...</script> SEM atributo src: so esses executam texto
// inline e precisam de hash. Os com src sao cobertos por 'self'.
const SCRIPT_INLINE = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;

/** sha256 em base64 do conteudo de cada <script> inline, na ordem do HTML. */
export function hashesDeScriptsInline(html: string): string[] {
  return [...html.matchAll(SCRIPT_INLINE)]
    .map((m) => m[1] ?? '')
    .filter((conteudo) => conteudo.trim() !== '')
    .map((conteudo) => createHash('sha256').update(conteudo, 'utf8').digest('base64'));
}

export function montarCsp({ html, urlSupabase }: { html: string; urlSupabase: string }): string {
  const supabase = normalizarUrlSupabase(urlSupabase);
  const hashes = hashesDeScriptsInline(html).map((h) => `'sha256-${h}'`);

  const diretivas: Array<[string, string[]]> = [
    // Tudo que nao for citado abaixo so pode vir do proprio site.
    ['default-src', ["'self'"]],

    // JavaScript: so o do proprio site, mais os scripts inline cujo hash
    // bate. Um <img onerror="..."> injetado e script inline sem hash, e o
    // navegador se recusa a executar.
    ['script-src', ["'self'", ...hashes]],

    // Estilo inline liberado - e por que isso NAO abre a porta do XSS.
    //
    // O Radix injeta <style> em tempo de execucao: um ao abrir o Dialog (trava
    // a rolagem da pagina por tras) e outro ao abrir o Select. Medido no
    // navegador, com a politica em modo relatorio.
    //
    // Hash nao serve: o estilo do Dialog embute a largura da barra de rolagem
    // da maquina ("padding-right: 15px"). No Mac seria 0px, noutro Windows
    // 17px - o hash so autorizaria quem tem exatamente 15px, e o modal deixaria
    // de travar a rolagem para todo o resto. E hash e 'unsafe-inline' nao se
    // combinam: com hash presente, o navegador ignora o 'unsafe-inline'.
    //
    // O custo e aceitavel porque o ataque que CSS inline permitiria e o vazamento
    // de dados via url() - e img-src e font-src abaixo fecham exatamente isso.
    // O que impede XSS e o script-src, e esse continua sem 'unsafe-inline'.
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', ["'self'"]],
    ['font-src', ["'self'"]],

    // Para onde o JavaScript pode mandar dados. E esta linha que impede um
    // codigo malicioso - de campo de texto ou de dependencia comprometida -
    // de mandar o token de sessao para fora.
    //
    // O host EXATO do projeto, nunca *.supabase.co: com o curinga, o atacante
    // criaria o proprio projeto no Supabase e mandaria o token para la,
    // passando pela regra.
    ['connect-src', ["'self'", supabase]],

    // Plugins (Flash, Java). Nao existem mais, mas bloquear e padrao.
    ['object-src', ["'none'"]],

    // Impede que um <base href> injetado desvie todos os links relativos.
    ['base-uri', ["'self'"]],

    // Formularios so enviam para o proprio site. Os do app enviam por
    // JavaScript, entao na pratica isso so barra injecao.
    ['form-action', ["'self'"]],

    // Ninguem pode embutir o site num iframe (clickjacking). Versao moderna
    // do X-Frame-Options, que continua abaixo para navegador antigo.
    ['frame-ancestors', ["'none'"]],
  ];

  return diretivas.map(([nome, valores]) => `${nome} ${valores.join(' ')}`).join('; ');
}

/** Cabecalhos de todas as respostas. */
export function cabecalhosGerais({
  csp,
  modo,
}: {
  csp: string;
  modo: ModoCsp;
}): Record<string, string> {
  const nomeCsp =
    modo === 'bloqueio' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';

  return {
    [nomeCsp]: csp,

    // Redundante com frame-ancestors, mas navegador antigo so entende este.
    'X-Frame-Options': 'DENY',

    // Impede o navegador de "adivinhar" que um arquivo e script quando o
    // servidor disse que e outra coisa.
    'X-Content-Type-Options': 'nosniff',

    // Para outros sites, manda so a origem - nunca o caminho, que pode conter
    // o id de uma viagem ou despesa.
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // HSTS: o navegador recusa HTTP neste endereco por um ano.
    //
    // Hoje e redundante - todo *.netlify.app ja esta na lista de preload dos
    // navegadores (o TLD .app inteiro esta). Fica para o dia do dominio
    // proprio: um cargacerta.com.br nasce FORA dessa lista, e sem isto a
    // primeira visita numa Wi-Fi publica poderia ser rebaixada para HTTP.
    //
    // Sem "preload" de proposito: entrar na lista e quase irreversivel, e so
    // vale decidir com o dominio definitivo em maos.
    'Strict-Transport-Security': 'max-age=31536000',
  };
}

/** Conteudo do arquivo _headers que a Netlify le no diretorio publicado. */
export function montarArquivoHeaders(gerais: Record<string, string>): string {
  const bloco = (caminho: string, cabecalhos: Record<string, string>) =>
    [caminho, ...Object.entries(cabecalhos).map(([k, v]) => `  ${k}: ${v}`)].join('\n');

  return (
    [
      bloco('/*', gerais),
      // Os assets do Vite levam hash no nome e podem ficar no cache para
      // sempre. O index.html nao: e ele que aponta para o bundle novo.
      bloco('/assets/*', { 'Cache-Control': 'public, max-age=31536000, immutable' }),
    ].join('\n\n') + '\n'
  );
}

/**
 * Gera dist/_headers no build e aplica os mesmos cabecalhos no `vite preview`,
 * para que o teste local veja exatamente a politica que vai para producao.
 *
 * Nao age no dev server de proposito: o HMR do Vite injeta script inline e
 * abre WebSocket, e a politica de producao quebraria o ambiente de trabalho.
 */
export function cabecalhosDeSeguranca({
  urlSupabase,
  modo,
}: {
  urlSupabase: string | undefined;
  modo: ModoCsp;
}): Plugin {
  let config: ResolvedConfig;

  const gerar = (html: string) => {
    if (!urlSupabase) throw new Error('VITE_SUPABASE_URL ausente: nao da para montar a CSP.');
    return cabecalhosGerais({ csp: montarCsp({ html, urlSupabase }), modo });
  };

  const htmlPublicado = () => {
    const caminho = resolve(config.root, config.build.outDir, 'index.html');
    return existsSync(caminho) ? readFileSync(caminho, 'utf8') : null;
  };

  return {
    name: 'carga-certa:cabecalhos-de-seguranca',

    configResolved(resolvida) {
      config = resolvida;
    },

    // writeBundle, e nao generateBundle: aqui o index.html final ja esta no
    // disco, com o script do tema exatamente como o navegador vai recebe-lo.
    // O hash precisa ser desse texto, byte a byte.
    writeBundle() {
      const html = htmlPublicado();
      if (!html) throw new Error('index.html nao encontrado apos o build.');
      const destino = resolve(config.root, config.build.outDir, '_headers');
      writeFileSync(destino, montarArquivoHeaders(gerar(html)), 'utf8');
    },

    configurePreviewServer(servidor) {
      const html = htmlPublicado();
      if (!html) return;
      const cabecalhos = gerar(html);
      servidor.middlewares.use((_req, res, next) => {
        for (const [nome, valor] of Object.entries(cabecalhos)) res.setHeader(nome, valor);
        next();
      });
    },
  };
}
