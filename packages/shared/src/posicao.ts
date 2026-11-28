/**
 * Regras da posicao do motorista: quando a leitura do GPS e boa o bastante
 * para ir ao mapa, e quando gravar mais um ponto do trajeto. No shared porque
 * o app de celular, que vai gravar com a tela bloqueada, precisa das mesmas.
 */

import { distanciaKm } from './rota';

/**
 * Raio de incerteza, em metros, ate onde a posicao vai para o mapa sem
 * perguntar. GPS de celular fica entre 5 e 30 m; Wi-Fi, em dezenas a
 * centenas; computador no cabo, pelo endereco da internet, em quilometros. O
 * iPhone com "Localizacao Precisa" desligada tambem erra em quilometros.
 */
export const PRECISAO_ACEITAVEL_M = 250;

/** Entre dois pontos gravados do trajeto, nunca menos que isto. */
export const INTERVALO_MINIMO_DO_TRAJETO_MS = 2 * 60_000;

/** Parado, grava um ponto a cada tanto - mostra que o celular segue ligado. */
export const INTERVALO_MAXIMO_DO_TRAJETO_MS = 10 * 60_000;

/** Andou menos que isto desde o ultimo ponto: e o GPS oscilando, nao o caminhao. */
export const DESLOCAMENTO_MINIMO_DO_TRAJETO_M = 100;

export interface LeituraDePosicao {
  lat: number;
  lng: number;
  /** Raio de incerteza informado pelo aparelho. */
  precisaoM: number;
  /** Instante da leitura (ms desde 1970), do proprio aparelho. */
  em: number;
}

export function precisaoAceitavel(precisaoM: number | null | undefined): boolean {
  return typeof precisaoM === 'number' && Number.isFinite(precisaoM) && precisaoM <= PRECISAO_ACEITAVEL_M;
}

/** "±12 m", "±850 m", "±3,2 km". */
export function descreverPrecisao(precisaoM: number): string {
  if (precisaoM < 1000) return `±${Math.max(1, Math.round(precisaoM))} m`;
  const km = precisaoM / 1000;
  const texto = km < 10 ? km.toFixed(1).replace('.', ',') : String(Math.round(km));
  return `±${texto} km`;
}

export type DecisaoDoTrajeto =
  /** Grava este ponto. */
  | 'gravar'
  /** Erro grande demais: nao diz em que ponto da rota o caminhao esta. */
  | 'imprecisa'
  /** Pouco tempo desde o ultimo ponto gravado. */
  | 'cedo'
  /** Quase no mesmo lugar, e o ultimo ponto ainda e recente. */
  | 'parado';

/**
 * Se a leitura nova entra no trajeto, comparada com o ultimo ponto GRAVADO
 * (ou na fila para gravar) - nao com a leitura anterior, senao o caminhao
 * andando devagar nunca somaria os 100 m.
 */
export function decidirPontoDoTrajeto(
  nova: LeituraDePosicao,
  ultima: LeituraDePosicao | null,
): DecisaoDoTrajeto {
  if (!precisaoAceitavel(nova.precisaoM)) return 'imprecisa';
  if (!ultima) return 'gravar';

  const passouMs = nova.em - ultima.em;
  if (passouMs < INTERVALO_MINIMO_DO_TRAJETO_MS) return 'cedo';

  const andouM = distanciaKm([ultima.lat, ultima.lng], [nova.lat, nova.lng]) * 1000;
  if (andouM < DESLOCAMENTO_MINIMO_DO_TRAJETO_M && passouMs < INTERVALO_MAXIMO_DO_TRAJETO_MS) {
    return 'parado';
  }
  return 'gravar';
}
