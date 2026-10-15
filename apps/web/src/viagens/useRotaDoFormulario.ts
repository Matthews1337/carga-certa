import { decodificarPolyline, type Ponto } from '@carga-certa/shared';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { calcularRota, lugarDoPonto, type Coordenada, type Lugar } from '@/lib/rotas';
import type { RotaParaGravar } from '@/viagens/esquema';

/**
 * Rota do formulario de frete e de viagem: o calculo pelo servico de rotas, o
 * clique no mapa que marca um ponto e o "qual ponto o clique marca".
 *
 * O formulario guarda origem e destino; o hook recebe os valores e devolve a
 * rota pronta para o mapa e para gravar.
 */

export type Qual = 'origem' | 'destino';

export interface RotaNaTela extends RotaParaGravar {
  pontos: Ponto[];
  /** Nula na rota que veio do banco: o tempo de estrada nao e gravado. */
  duracaoMin: number | null;
}

/** A rota ja gravada e os pontos dela. */
export interface RotaGravada {
  origem: Coordenada;
  destino: Coordenada;
  rota: RotaNaTela | null;
}

/** Mesmo ponto com a precisao que vai para o banco (numeric(9,6)). */
export function mesmoPonto(a: Coordenada, b: Coordenada): boolean {
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
}

/** Origem e destino gravados na viagem, como valores iniciais do formulario. */
export function lugaresDa(
  v:
    | {
        origem_nome: string | null;
        origem_lat: number | null;
        origem_lng: number | null;
        destino_nome: string | null;
        destino_lat: number | null;
        destino_lng: number | null;
      }
    | null
    | undefined,
): { origem: Lugar | null; destino: Lugar | null } {
  const lugar = (nome: string | null, lat: number | null, lng: number | null): Lugar | null =>
    lat !== null && lng !== null ? { nome: nome ?? `${lat}, ${lng}`, lat, lng } : null;
  return {
    origem: v ? lugar(v.origem_nome, v.origem_lat, v.origem_lng) : null,
    destino: v ? lugar(v.destino_nome, v.destino_lat, v.destino_lng) : null,
  };
}

/** Le a rota gravada numa viagem. Null se a viagem ainda nao tem os dois pontos. */
export function rotaGravadaDa(
  v:
    | {
        origem_lat: number | null;
        origem_lng: number | null;
        destino_lat: number | null;
        destino_lng: number | null;
        rota_polyline: string | null;
        km_previsto: number | null;
      }
    | null
    | undefined,
): RotaGravada | null {
  if (!v || v.origem_lat === null || v.origem_lng === null || v.destino_lat === null || v.destino_lng === null) {
    return null;
  }
  let rota: RotaNaTela | null = null;
  if (v.rota_polyline && v.km_previsto !== null) {
    try {
      rota = {
        pontos: decodificarPolyline(v.rota_polyline),
        polyline: v.rota_polyline,
        distanciaKm: v.km_previsto,
        duracaoMin: null,
      };
    } catch {
      // Rota corrompida: sera recalculada se o usuario mexer num ponto.
    }
  }
  return {
    origem: { lat: v.origem_lat, lng: v.origem_lng },
    destino: { lat: v.destino_lat, lng: v.destino_lng },
    rota,
  };
}

export function useRotaDoFormulario({
  ativo,
  origem,
  destino,
  gravada,
  definir,
}: {
  /** Dialogo aberto. Fechado, nao calcula. */
  ativo: boolean;
  origem: Lugar | null;
  destino: Lugar | null;
  gravada: RotaGravada | null;
  /** Grava o lugar no formulario. */
  definir: (qual: Qual, lugar: Lugar) => void;
}) {
  const [marcando, setMarcando] = useState<Qual>('origem');

  // Valores da ultima renderizacao, para o `marcar` conferir depois do await.
  const atuais = useRef({ origem, destino });
  atuais.current = { origem, destino };

  // A rota ja gravada vale enquanto os pontos forem os mesmos: abrir para
  // corrigir outro campo nao gasta uma consulta ao servico de rotas. Sem rota
  // gravada (o calculo tinha falhado), recalcula ao abrir.
  const usarGravada = Boolean(
    gravada?.rota &&
      origem &&
      destino &&
      mesmoPonto(origem, gravada.origem) &&
      mesmoPonto(destino, gravada.destino),
  );

  const calculo = useQuery({
    queryKey: ['rotas', 'rota', origem?.lat, origem?.lng, destino?.lat, destino?.lng],
    queryFn: () => calcularRota(origem as Coordenada, destino as Coordenada),
    enabled: ativo && origem !== null && destino !== null && !usarGravada,
    staleTime: Infinity,
    retry: false,
  });

  const rota: RotaNaTela | null = usarGravada ? (gravada?.rota ?? null) : (calculo.data ?? null);

  const marcar = async (qual: Qual, ponto: Coordenada) => {
    // Primeiro o ponto, com as coordenadas como nome; o nome de verdade chega
    // depois, sem segurar o desenho da rota.
    definir(qual, { nome: `${ponto.lat.toFixed(5)}, ${ponto.lng.toFixed(5)}`, ...ponto });
    if (qual === 'origem' && !atuais.current.destino) setMarcando('destino');
    try {
      const lugar = await lugarDoPonto(ponto);
      const atual = atuais.current[qual];
      // So troca o nome se o ponto ainda for o mesmo (o usuario pode ter
      // clicado de novo enquanto a busca do nome estava no ar).
      if (lugar && atual && mesmoPonto(atual, ponto)) {
        definir(qual, { ...lugar, lat: ponto.lat, lng: ponto.lng });
      }
    } catch {
      // Sem nome, fica a coordenada. Salva do mesmo jeito.
    }
  };

  return {
    rota,
    calculando: calculo.isFetching,
    erro: calculo.isError ? (calculo.error as Error).message : null,
    marcando,
    setMarcando,
    marcar,
  };
}

export type RotaDoFormulario = ReturnType<typeof useRotaDoFormulario>;
