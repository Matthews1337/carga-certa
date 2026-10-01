import { decodificarPolyline, type Ponto } from '@carga-certa/shared';

import malha from '@/fretes/malha-ufs.json';

/**
 * Projecao e fundo do mapa minimalista (SVG) dos cards.
 *
 * Web Mercator, a mesma do MapLibre, em "graus equivalentes": x e a longitude,
 * y a latitude esticada como no Mercator. O eixo y sai invertido porque no SVG
 * ele cresce para baixo, e o norte tem que ficar em cima.
 *
 * Tudo e desenhado nessas unidades e cada card so troca o viewBox: os contornos
 * dos estados sao montados UMA vez para a pagina inteira, e nao por card.
 */
export function projetar(lat: number, lng: number): [x: number, y: number] {
  const rad = (lat * Math.PI) / 180;
  const y = (Math.log(Math.tan(Math.PI / 4 + rad / 2)) * 180) / Math.PI;
  return [lng, -y];
}

export interface Caixa {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ContornoUf {
  /** Atributo d do <path>, ja projetado. */
  d: string;
  caixa: Caixa;
}

let contornos: ContornoUf[] | null = null;

/** Os 27 estados, projetados. Calculado na primeira chamada e guardado. */
export function contornosDasUfs(): ContornoUf[] {
  if (contornos) return contornos;
  contornos = malha.ufs.map((uf) => {
    const caixa: Caixa = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    const partes = uf.aneis.map((anel) => {
      const pontos = decodificarPolyline(anel, malha.precisao).map(([lat, lng]) => projetar(lat, lng));
      for (const [x, y] of pontos) expandir(caixa, x, y);
      return `M${pontos.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join('L')}Z`;
    });
    return { d: partes.join(''), caixa };
  });
  return contornos;
}

export function expandir(caixa: Caixa, x: number, y: number): void {
  caixa.x0 = Math.min(caixa.x0, x);
  caixa.y0 = Math.min(caixa.y0, y);
  caixa.x1 = Math.max(caixa.x1, x);
  caixa.y1 = Math.max(caixa.y1, y);
}

export function seCruzam(a: Caixa, b: Caixa): boolean {
  return a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
}

/**
 * Caixa que enquadra os pontos com folga e na proporcao do desenho.
 *
 * A folga e de 15% de cada lado, e o tamanho minimo e de ~50 km: um frete
 * dentro da mesma cidade daria uma caixa de 2 km, e o mapa viraria um borrao
 * de dois pinos sobrepostos.
 */
export function enquadrar(pontos: readonly Ponto[], proporcao: number): Caixa | null {
  if (pontos.length === 0) return null;
  const caixa: Caixa = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const [lat, lng] of pontos) {
    const [x, y] = projetar(lat, lng);
    expandir(caixa, x, y);
  }

  const MINIMO = 0.5;
  let largura = Math.max(caixa.x1 - caixa.x0, MINIMO) * 1.3;
  let altura = Math.max(caixa.y1 - caixa.y0, MINIMO) * 1.3;
  if (largura / altura > proporcao) altura = largura / proporcao;
  else largura = altura * proporcao;

  const cx = (caixa.x0 + caixa.x1) / 2;
  const cy = (caixa.y0 + caixa.y1) / 2;
  return { x0: cx - largura / 2, y0: cy - altura / 2, x1: cx + largura / 2, y1: cy + altura / 2 };
}

/** Linha de pontos -> atributo d, nas unidades da projecao. */
export function caminho(pontos: readonly Ponto[]): string {
  return `M${pontos
    .map(([lat, lng]) => {
      const [x, y] = projetar(lat, lng);
      return `${x.toFixed(4)} ${y.toFixed(4)}`;
    })
    .join('L')}`;
}
