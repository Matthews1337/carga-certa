/**
 * Onde o motorista esta em relacao a rota: o que ja foi percorrido e o que
 * falta. Alimenta o mapa do card (trecho percorrido em destaque) e, no mobile,
 * o "faltam X km".
 */

import type { Ponto } from './polyline';

const RAIO_DA_TERRA_KM = 6371.0088;
const RAD = Math.PI / 180;

/** Distancia em linha reta sobre a Terra (haversine). */
export function distanciaKm([lat1, lng1]: Ponto, [lat2, lng2]: Ponto): number {
  const dLat = (lat2 - lat1) * RAD;
  const dLng = (lng2 - lng1) * RAD;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_DA_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Comprimento de uma linha de pontos, em km. */
export function comprimentoKm(pontos: readonly Ponto[]): number {
  let total = 0;
  for (let i = 1; i < pontos.length; i += 1) total += distanciaKm(pontos[i - 1]!, pontos[i]!);
  return total;
}

export interface RotaDividida {
  /** Do inicio ate o ponto da rota mais proximo do motorista. */
  percorrido: Ponto[];
  /** Desse ponto ate o fim. */
  restante: Ponto[];
  /** 0 a 1, pela distancia ao longo da rota. */
  fracao: number;
  /** Distancia do motorista ate a rota. Grande demais = desviou, ou o GPS errou. */
  foraDaRotaKm: number;
}

/**
 * Corta a rota no ponto mais proximo da posicao - projetado no segmento, e nao
 * so no vertice mais perto: numa reta de 80 km sem curva, a rota simplificada
 * tem so as duas pontas, e "o vertice mais perto" pularia 40 km de uma vez.
 *
 * A busca usa um plano local (longitude escalada pelo cosseno da latitude), bom
 * o bastante para achar o segmento; as distancias devolvidas sao haversine.
 */
export function dividirRota(rota: readonly Ponto[], posicao: Ponto): RotaDividida | null {
  if (rota.length < 2) return null;

  const escala = Math.cos(posicao[0] * RAD);
  const px = posicao[1] * escala;
  const py = posicao[0];

  let melhorIndice = 0;
  let melhorT = 0;
  let melhorDist2 = Infinity;

  for (let i = 0; i < rota.length - 1; i += 1) {
    const [aLat, aLng] = rota[i]!;
    const [bLat, bLng] = rota[i + 1]!;
    const ax = aLng * escala;
    const bx = bLng * escala;
    const dx = bx - ax;
    const dy = bLat - aLat;
    const comprimento2 = dx * dx + dy * dy;
    const t =
      comprimento2 === 0
        ? 0
        : Math.max(0, Math.min(1, ((px - ax) * dx + (py - aLat) * dy) / comprimento2));
    const qx = ax + t * dx;
    const qy = aLat + t * dy;
    const dist2 = (px - qx) ** 2 + (py - qy) ** 2;
    if (dist2 < melhorDist2) {
      melhorDist2 = dist2;
      melhorIndice = i;
      melhorT = t;
    }
  }

  const [aLat, aLng] = rota[melhorIndice]!;
  const [bLat, bLng] = rota[melhorIndice + 1]!;
  const corte: Ponto = [aLat + melhorT * (bLat - aLat), aLng + melhorT * (bLng - aLng)];

  const percorrido = [...rota.slice(0, melhorIndice + 1), corte];
  const restante = [corte, ...rota.slice(melhorIndice + 1)];
  const total = comprimentoKm(rota);

  return {
    percorrido,
    restante,
    fracao: total > 0 ? Math.min(1, comprimentoKm(percorrido) / total) : 0,
    foraDaRotaKm: distanciaKm(posicao, corte),
  };
}
