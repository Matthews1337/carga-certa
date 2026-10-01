import {
  codificarPolyline,
  decodificarPolyline,
  simplificarRota,
  type Ponto,
} from '@carga-certa/shared';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

/**
 * Cliente da Edge Function `rotas` (supabase/functions/rotas), que fala com o
 * OpenRouteService. A chave do ORS fica na funcao; aqui so vai o login.
 */

export interface Lugar {
  nome: string;
  lat: number;
  lng: number;
}

export interface Coordenada {
  lat: number;
  lng: number;
}

async function chamar<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('rotas', { body: corpo });
  if (error) {
    // A funcao responde { erro } com uma frase pronta para o usuario.
    if (error instanceof FunctionsHttpError) {
      const detalhe = (await error.context.json().catch(() => null)) as { erro?: string } | null;
      throw new Error(detalhe?.erro ?? 'O serviço de rotas falhou.');
    }
    throw new Error('Sem conexão com o serviço de rotas.');
  }
  return data as T;
}

/** Autocomplete, so no Brasil. `perto` puxa para cima o que esta perto dali. */
export async function buscarLugares(texto: string, perto?: Coordenada): Promise<Lugar[]> {
  const r = await chamar<{ lugares: Lugar[] }>({ acao: 'buscar', texto, perto });
  return r.lugares;
}

/** O nome do lugar clicado no mapa. As coordenadas devolvidas sao as do clique. */
export async function lugarDoPonto(ponto: Coordenada): Promise<Lugar | null> {
  const r = await chamar<{ lugar: Lugar | null }>({ acao: 'endereco', ...ponto });
  return r.lugar;
}

export interface RotaCalculada {
  distanciaKm: number;
  duracaoMin: number;
  /** Ja simplificada: e o que vai para o banco e para o mapa. */
  pontos: Ponto[];
  polyline: string;
}

/**
 * Rota de caminhao entre dois pontos. O ORS devolve milhares de pontos (15 kB
 * numa rota de 1.000 km); a simplificacao deixa uns 300 (1,6 kB) sem mudar o
 * desenho em nenhum zoom que o app usa.
 */
export async function calcularRota(origem: Coordenada, destino: Coordenada): Promise<RotaCalculada> {
  const r = await chamar<{ distanciaKm: number; duracaoMin: number; polyline: string }>({
    acao: 'rota',
    origem,
    destino,
  });
  const pontos = simplificarRota(decodificarPolyline(r.polyline));
  return { distanciaKm: r.distanciaKm, duracaoMin: r.duracaoMin, pontos, polyline: codificarPolyline(pontos) };
}
