/**
 * Gera src/fretes/malha-ufs.json: o contorno dos 27 estados, fundo do mapa
 * minimalista dos cards de frete.
 *
 *   node apps/web/scripts/gerar-malha-ufs.mts
 *
 * Fonte: malha do IBGE em qualidade minima (dado publico). O arquivo gerado vai
 * para o repositorio - o app nao depende do servico do IBGE no ar - e so
 * precisa ser refeito se a tolerancia mudar.
 *
 * Os aneis sao simplificados (~2 km, bem menos que um pixel no card) e gravados
 * como encoded polyline com precisao 3 (~100 m): de ~100 kB para poucos kB.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  codificarPolyline,
  simplificarRota,
  type Ponto,
} from '../../../packages/shared/src/polyline.ts';

const URL_IBGE =
  'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR' +
  '?intrarregiao=UF&qualidade=minima&formato=application/vnd.geo%2Bjson';
const TOLERANCIA_GRAUS = 0.02;
const PRECISAO = 3;
const DESTINO = fileURLToPath(new URL('../src/fretes/malha-ufs.json', import.meta.url));

type Anel = [number, number][];
interface Feature {
  properties: { codarea: string };
  geometry: { type: 'Polygon'; coordinates: Anel[] } | { type: 'MultiPolygon'; coordinates: Anel[][] };
}

const resposta = await fetch(URL_IBGE);
if (!resposta.ok) throw new Error(`IBGE respondeu ${resposta.status}`);
const malha = (await resposta.json()) as { features: Feature[] };

let pontosAntes = 0;
let pontosDepois = 0;

const ufs = malha.features
  .map((f) => {
    const poligonos = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    // So o anel externo de cada poligono: buraco em estado nao existe no desenho.
    const aneis = poligonos.map((p) => p[0]!).filter(Boolean);
    return {
      codigo: f.properties.codarea,
      aneis: aneis
        .map((anel) => {
          // GeoJSON e [lng, lat]; o polyline e [lat, lng].
          const pontos: Ponto[] = anel.map(([lng, lat]) => [lat, lng]);
          const simples = simplificarRota(pontos, TOLERANCIA_GRAUS);
          pontosAntes += pontos.length;
          pontosDepois += simples.length;
          return simples.length >= 4 ? codificarPolyline(simples, PRECISAO) : null;
        })
        .filter((a): a is string => a !== null),
    };
  })
  .sort((a, b) => a.codigo.localeCompare(b.codigo));

const json = JSON.stringify({ fonte: 'IBGE, malha de UFs (qualidade minima)', precisao: PRECISAO, ufs });
writeFileSync(DESTINO, json + '\n', 'utf8');

console.log(`${ufs.length} UFs, ${pontosAntes} -> ${pontosDepois} pontos, ${json.length} bytes em ${DESTINO}`);
