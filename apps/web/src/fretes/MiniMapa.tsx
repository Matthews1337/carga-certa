import { dividirRota, type Ponto } from '@carga-certa/shared';
import { useMemo } from 'react';

import { contornosDasUfs, caminho, enquadrar, projetar, seCruzam } from '@/fretes/projecao';
import { CORES_DO_MAPA } from '@/lib/mapa';
import { cn } from '@/lib/utils';

/**
 * O mapa minimalista do card: contorno dos estados, a rota, pino verde no
 * inicio, vermelho no fim e o motorista em ambar, com o trecho ja percorrido
 * destacado.
 *
 * SVG, e nao MapLibre, de proposito: cada mapa MapLibre e um contexto WebGL, e
 * o navegador mantem so uns 16 por pagina - com mais fretes que isso, os
 * primeiros mapas sumiriam. Aqui cada card e um desenho leve, sem baixar tile.
 * O mapa de verdade, com ruas, fica no detalhe do frete.
 */

/** Largura / altura do desenho. O container precisa ter a mesma proporcao. */
export const PROPORCAO_MINIMAPA = 2;

export function MiniMapa({
  origem,
  destino,
  rota,
  posicao,
  rotulo,
  className,
}: {
  origem: Ponto | null;
  destino: Ponto | null;
  /** Rota decodificada; nula quando nao foi calculada. */
  rota: Ponto[] | null;
  posicao: Ponto | null;
  /** Descricao para leitor de tela. */
  rotulo: string;
  className?: string;
}) {
  const desenho = useMemo(() => {
    const linha: Ponto[] = rota && rota.length >= 2 ? rota : [origem, destino].filter((p) => p !== null);
    const caixa = enquadrar([...linha, ...(posicao ? [posicao] : [])], PROPORCAO_MINIMAPA);
    if (!caixa) return null;

    const dividida = posicao && rota && rota.length >= 2 ? dividirRota(rota, posicao) : null;
    const largura = caixa.x1 - caixa.x0;
    return {
      caixa,
      ufs: contornosDasUfs().filter((uf) => seCruzam(uf.caixa, caixa)),
      // Sem rota calculada, so uma reta tracejada entre os pinos.
      reta: !rota || rota.length < 2 ? caminho(linha) : null,
      percorrido: dividida ? caminho(dividida.percorrido) : null,
      restante: rota && rota.length >= 2 ? caminho(dividida ? dividida.restante : rota) : null,
      // Raio em unidades do viewBox: proporcional a largura, para o pino ter o
      // mesmo tamanho na tela num frete de 50 km ou de 2.000 km.
      raio: largura * 0.022,
    };
  }, [origem, destino, rota, posicao]);

  if (!desenho) {
    return (
      <div
        className={cn('flex items-center justify-center bg-muted/60 text-sm text-muted-foreground', className)}
        style={{ aspectRatio: PROPORCAO_MINIMAPA }}
      >
        Sem rota
      </div>
    );
  }

  const { caixa, raio } = desenho;
  const pino = (p: Ponto | null, cor: string, fator = 1) => {
    if (!p) return null;
    const [x, y] = projetar(p[0], p[1]);
    return (
      <circle
        cx={x}
        cy={y}
        r={raio * fator}
        fill={cor}
        stroke="white"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    );
  };

  return (
    <svg
      role="img"
      aria-label={rotulo}
      viewBox={`${caixa.x0} ${caixa.y0} ${caixa.x1 - caixa.x0} ${caixa.y1 - caixa.y0}`}
      preserveAspectRatio="xMidYMid slice"
      className={cn('block w-full bg-muted/60', className)}
      style={{ aspectRatio: PROPORCAO_MINIMAPA }}
    >
      {/* non-scaling-stroke: a espessura e em pixels, em qualquer escala. */}
      {desenho.ufs.map((uf, i) => (
        <path
          key={i}
          d={uf.d}
          className="fill-background stroke-border"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {desenho.reta ? (
        <path
          d={desenho.reta}
          fill="none"
          stroke={CORES_DO_MAPA.restante}
          strokeWidth={2.5}
          strokeDasharray="6 5"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {desenho.restante ? (
        <path
          d={desenho.restante}
          fill="none"
          stroke={CORES_DO_MAPA.restante}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {desenho.percorrido ? (
        <path
          d={desenho.percorrido}
          fill="none"
          stroke={CORES_DO_MAPA.motorista}
          strokeWidth={4}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}

      {pino(origem, CORES_DO_MAPA.inicio)}
      {pino(destino, CORES_DO_MAPA.fim)}
      {pino(posicao, CORES_DO_MAPA.motorista, 1.3)}
    </svg>
  );
}
