// Edge Function `rotas`: busca de lugares e rota de caminhao pelo
// OpenRouteService (ORS).
//
// Existe para a chave do ORS nunca ir para o navegador. No JavaScript do site,
// qualquer visitante copiaria a chave e gastaria a cota diaria do app inteiro.
// Aqui ela fica no secret ORS_API_KEY, e so usuario logado passa.
//
// A funcao e um proxy magro: valida a entrada, chama o ORS e devolve so o que
// a tela usa. Simplificar a rota e com o web, pelo shared (polyline.ts).
//
// Acoes (POST, corpo JSON):
//   { acao: 'buscar', texto, perto? }   -> { lugares: [{ nome, lat, lng }] }
//   { acao: 'endereco', lat, lng }      -> { lugar: { nome, lat, lng } | null }
//   { acao: 'rota', origem, destino }   -> { distanciaKm, duracaoMin, polyline }

import { createClient } from 'npm:@supabase/supabase-js@2';

const ORS = 'https://api.openrouteservice.org';

// Distancia maxima ate a estrada mais proxima de cada ponto. O padrao do ORS e
// 350 m: uma fazenda ou um patio a 1 km da rodovia daria "ponto nao roteavel".
const RAIO_ATE_A_ESTRADA_M = 5000;

// Qualquer origem: o que protege a cota e o login, conferido abaixo, e nao o
// CORS - que so vale para navegador.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Coordenada {
  lat: number;
  lng: number;
}

class ErroDeEntrada extends Error {}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resposta({ erro: 'Use POST.' }, 405);

  // Login antes de tudo: quem nao entrou nao fica sabendo nem se a funcao
  // esta configurada.
  if (!(await usuarioLogado(req))) {
    return resposta({ erro: 'Entre na sua conta para buscar lugares e rotas.' }, 401);
  }

  const chave = Deno.env.get('ORS_API_KEY');
  if (!chave) {
    console.error('ORS_API_KEY nao configurada');
    return resposta({ erro: 'O serviço de rotas não está configurado.' }, 500);
  }

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return resposta({ erro: 'Pedido inválido.' }, 400);
  }

  try {
    switch (corpo.acao) {
      case 'buscar':
        return await buscar(chave, corpo);
      case 'endereco':
        return await endereco(chave, corpo);
      case 'rota':
        return await rota(chave, corpo);
      default:
        return resposta({ erro: 'Ação desconhecida.' }, 400);
    }
  } catch (e) {
    if (e instanceof ErroDeEntrada) return resposta({ erro: e.message }, 400);
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      return resposta({ erro: 'O serviço de rotas demorou demais. Tente de novo.' }, 504);
    }
    console.error(e);
    return resposta({ erro: 'Falha inesperada no serviço de rotas.' }, 500);
  }
});

/**
 * Confere o token com o Auth do Supabase. O supabase-js manda a anon key no
 * lugar do token quando nao ha sessao; ela nao e de usuario nenhum e cai aqui.
 */
async function usuarioLogado(req: Request): Promise<boolean> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.auth.getUser(token);
  return !error && data.user !== null;
}

// ------------------------------------------------------------------ acoes ---

async function buscar(chave: string, corpo: Record<string, unknown>): Promise<Response> {
  const texto = typeof corpo.texto === 'string' ? corpo.texto.trim() : '';
  if (texto.length < 3) throw new ErroDeEntrada('Digite pelo menos 3 letras.');
  if (texto.length > 120) throw new ErroDeEntrada('Busca longa demais.');

  const url = new URL(`${ORS}/geocode/autocomplete`);
  url.searchParams.set('text', texto);
  url.searchParams.set('boundary.country', 'BR');
  url.searchParams.set('size', '6');
  // Com o centro do mapa, "Centro" acha o centro da cidade que esta na tela, e
  // nao o de outra ponta do pais.
  if (corpo.perto !== undefined) {
    const perto = coordenada(corpo.perto, 'perto');
    url.searchParams.set('focus.point.lat', String(perto.lat));
    url.searchParams.set('focus.point.lon', String(perto.lng));
  }

  const r = await chamarOrs(chave, url);
  if (!r.ok) return erroDoOrs(r);
  const dados = await r.json();
  return resposta({ lugares: lugaresDe(dados) });
}

async function endereco(chave: string, corpo: Record<string, unknown>): Promise<Response> {
  const ponto = coordenada(corpo, 'ponto');

  const url = new URL(`${ORS}/geocode/reverse`);
  url.searchParams.set('point.lat', String(ponto.lat));
  url.searchParams.set('point.lon', String(ponto.lng));
  url.searchParams.set('boundary.country', 'BR');
  url.searchParams.set('size', '1');

  const r = await chamarOrs(chave, url);
  if (!r.ok) return erroDoOrs(r);
  const dados = await r.json();
  const [lugar] = lugaresDe(dados);
  // Devolve o ponto clicado, e nao o do endereco achado: o motorista marcou
  // o patio, e o endereco mais proximo pode estar a 300 m dali.
  return resposta({ lugar: lugar ? { ...lugar, lat: ponto.lat, lng: ponto.lng } : null });
}

async function rota(chave: string, corpo: Record<string, unknown>): Promise<Response> {
  const origem = coordenada(corpo.origem, 'origem');
  const destino = coordenada(corpo.destino, 'destino');

  const r = await chamarOrs(chave, new URL(`${ORS}/v2/directions/driving-hgv`), {
    // ORS usa [longitude, latitude].
    coordinates: [
      [origem.lng, origem.lat],
      [destino.lng, destino.lat],
    ],
    radiuses: [RAIO_ATE_A_ESTRADA_M, RAIO_ATE_A_ESTRADA_M],
    instructions: false,
    geometry_simplify: true,
  });
  if (!r.ok) return erroDoOrs(r);

  const dados = await r.json();
  const primeira = dados?.routes?.[0];
  if (!primeira || typeof primeira.geometry !== 'string') {
    return resposta({ erro: 'O serviço de rotas não devolveu uma rota.' }, 502);
  }
  return resposta({
    distanciaKm: Math.round(primeira.summary.distance / 100) / 10,
    duracaoMin: Math.round(primeira.summary.duration / 60),
    polyline: primeira.geometry,
  });
}

// ---------------------------------------------------------------- apoio ---

function coordenada(valor: unknown, campo: string): Coordenada {
  const v = valor as Partial<Coordenada> | null;
  const lat = Number(v?.lat);
  const lng = Number(v?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new ErroDeEntrada(`Coordenada inválida em "${campo}".`);
  }
  return { lat, lng };
}

/** A chave vai no cabecalho, e nao na URL, para nao parar em log de ninguem. */
function chamarOrs(chave: string, url: URL, corpo?: unknown): Promise<Response> {
  return fetch(url, {
    method: corpo === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: chave,
      Accept: 'application/json',
      ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(10_000),
  });
}

interface Feature {
  properties?: { label?: string };
  geometry?: { coordinates?: [number, number] };
}

function lugaresDe(dados: { features?: Feature[] }): { nome: string; lat: number; lng: number }[] {
  return (dados.features ?? []).flatMap((f) => {
    const [lng, lat] = f.geometry?.coordinates ?? [];
    const nome = f.properties?.label;
    if (typeof lat !== 'number' || typeof lng !== 'number' || !nome) return [];
    // Toda busca ja e no Brasil; ", Brazil" no fim de cada item e so ruido.
    return [{ nome: nome.replace(/,\s*(Brazil|Brasil)$/i, ''), lat, lng }];
  });
}

/** Traduz o erro do ORS para uma frase que o motorista entende. */
async function erroDoOrs(r: Response): Promise<Response> {
  const texto = await r.text();
  let codigo: number | undefined;
  try {
    codigo = JSON.parse(texto)?.error?.code;
  } catch {
    // corpo nao e JSON; fica so o status
  }
  console.error(`ORS ${r.status} ${codigo ?? ''}: ${texto.slice(0, 300)}`);

  if (r.status === 401 || r.status === 403) {
    return resposta({ erro: 'O serviço de rotas recusou a chave de acesso.' }, 502);
  }
  if (r.status === 429) {
    return resposta(
      { erro: 'Muitas consultas ao serviço de rotas. Espere um minuto e tente de novo.' },
      429,
    );
  }
  if (codigo === 2010) {
    return resposta(
      { erro: 'Não há estrada a menos de 5 km de um dos pontos. Marque um ponto mais perto da rodovia.' },
      422,
    );
  }
  if (codigo === 2004) {
    return resposta({ erro: 'A rota é longa demais para o serviço de rotas.' }, 422);
  }
  if (codigo === 2009) {
    return resposta({ erro: 'Não achei um caminho de caminhão entre os dois pontos.' }, 422);
  }
  return resposta({ erro: `O serviço de rotas falhou (${r.status}).` }, 502);
}

function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
