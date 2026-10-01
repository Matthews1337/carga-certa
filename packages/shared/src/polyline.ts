/**
 * Rota em texto: o formato "encoded polyline" do Google, que o OpenRouteService
 * tambem devolve. Uma rota de 1.500 km cabe em poucos kB, contra centenas num
 * array JSON de coordenadas - e e isso que vai gravado em viagem.rota_polyline.
 *
 * Os pontos sao [latitude, longitude], a ordem do formato. O MapLibre e o
 * GeoJSON usam [longitude, latitude]: inverter na hora de desenhar.
 */

export type Ponto = readonly [latitude: number, longitude: number];

/** Precisao 5 = 1e-5 grau, cerca de 1 metro. E a do Google e a do ORS. */
const PRECISAO_PADRAO = 5;

export function codificarPolyline(pontos: readonly Ponto[], precisao = PRECISAO_PADRAO): string {
  const fator = 10 ** precisao;
  let saida = '';
  let latAnterior = 0;
  let lngAnterior = 0;

  for (const [lat, lng] of pontos) {
    const latInt = Math.round(lat * fator);
    const lngInt = Math.round(lng * fator);
    saida += codificarNumero(latInt - latAnterior) + codificarNumero(lngInt - lngAnterior);
    latAnterior = latInt;
    lngAnterior = lngInt;
  }
  return saida;
}

function codificarNumero(valor: number): string {
  // Sinal no bit mais baixo; depois, blocos de 5 bits com bit de continuacao.
  let v = valor < 0 ? ~(valor << 1) : valor << 1;
  let saida = '';
  while (v >= 0x20) {
    saida += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  return saida + String.fromCharCode(v + 63);
}

/** Lanca erro se o texto estiver truncado: rota pela metade e pior que rota nenhuma. */
export function decodificarPolyline(texto: string, precisao = PRECISAO_PADRAO): Ponto[] {
  const fator = 10 ** precisao;
  const pontos: Ponto[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;

  const lerNumero = (): number => {
    let resultado = 0;
    let deslocamento = 0;
    let byte: number;
    do {
      if (i >= texto.length) throw new Error('Rota corrompida: texto terminou no meio de um ponto');
      byte = texto.charCodeAt(i++) - 63;
      resultado |= (byte & 0x1f) << deslocamento;
      deslocamento += 5;
    } while (byte >= 0x20);
    return resultado & 1 ? ~(resultado >> 1) : resultado >> 1;
  };

  while (i < texto.length) {
    lat += lerNumero();
    lng += lerNumero();
    pontos.push([lat / fator, lng / fator]);
  }
  return pontos;
}

/** Cerca de 100 metros. Num mapa de card, e bem menos que um pixel. */
export const TOLERANCIA_ROTA_GRAUS = 0.001;

/**
 * Douglas-Peucker: tira os pontos que nao mudam o desenho alem da tolerancia.
 * Reta longa de rodovia vira dois pontos; serra cheia de curva fica como esta.
 *
 * Iterativo, e nao recursivo: rota de ORS passa de 10 mil pontos, e a recursao
 * estouraria a pilha no pior caso. A longitude e escalada pelo cosseno da
 * latitude media, para a tolerancia valer o mesmo em metros nos dois eixos.
 */
export function simplificarRota(
  pontos: readonly Ponto[],
  toleranciaGraus = TOLERANCIA_ROTA_GRAUS,
): Ponto[] {
  if (pontos.length < 3) return [...pontos];

  const latMedia = pontos.reduce((soma, [lat]) => soma + lat, 0) / pontos.length;
  const escalaLng = Math.cos((latMedia * Math.PI) / 180);
  const xy = pontos.map(([lat, lng]) => [lng * escalaLng, lat] as const);

  const manter = new Uint8Array(pontos.length);
  manter[0] = 1;
  manter[pontos.length - 1] = 1;

  const pilha: [number, number][] = [[0, pontos.length - 1]];
  while (pilha.length > 0) {
    const [inicio, fim] = pilha.pop() as [number, number];
    let maiorDistancia = 0;
    let indice = -1;
    for (let k = inicio + 1; k < fim; k += 1) {
      const d = distanciaAoSegmento(xy[k]!, xy[inicio]!, xy[fim]!);
      if (d > maiorDistancia) {
        maiorDistancia = d;
        indice = k;
      }
    }
    if (indice !== -1 && maiorDistancia > toleranciaGraus) {
      manter[indice] = 1;
      pilha.push([inicio, indice], [indice, fim]);
    }
  }

  return pontos.filter((_, k) => manter[k] === 1);
}

type Xy = readonly [number, number];

function distanciaAoSegmento([px, py]: Xy, [ax, ay]: Xy, [bx, by]: Xy): number {
  const dx = bx - ax;
  const dy = by - ay;
  const comprimento2 = dx * dx + dy * dy;
  // Segmento degenerado (rota que volta ao mesmo ponto): distancia ao ponto.
  const t =
    comprimento2 === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / comprimento2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
