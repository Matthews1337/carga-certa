import { STATUS_VIAGEM, dataLocal, type StatusViagem } from '@carga-certa/shared';
import { z } from 'zod';

import type { Lugar } from '@/lib/rotas';

/**
 * Regras do formulario de viagem e a conversao para a linha do banco.
 *
 * A tela de Viagens mostra as viagens SEM frete: ir vazio ate a coleta, voltar
 * depois da entrega, ir a oficina - rodar com custo e sem receita. A viagem de
 * um frete e editada pelo formulario do frete, que usa as partes comuns daqui
 * (lugar, rota, datas).
 */

/** Valor do select para "nenhum" (sem carreta, sem contratante). */
export const SEM_VINCULO = 'nenhum';

export const esquemaLugar = z.object({ nome: z.string(), lat: z.number(), lng: z.number() });

/** Lugar obrigatorio, mas que comeca vazio (null) no formulario. */
export function lugarObrigatorio(mensagem: string) {
  // `(v): boolean`, e nao `(v) => v !== null`: inferido como type guard, o
  // TypeScript tiraria o null do tipo, e o formulario nao poderia comecar vazio.
  return esquemaLugar.nullable().refine((v): boolean => v !== null, mensagem);
}

export const esquemaViagem = z.object({
  origem: lugarObrigatorio('Marque onde a viagem começa'),
  destino: lugarObrigatorio('Marque onde a viagem termina'),
  veiculoTracaoId: z.string().uuid('Escolha o caminhão ou o cavalo'),
  veiculoReboqueId: z.string(),
  /** 'AAAA-MM-DD' do <input type="date">. */
  inicio: z.string().min(1, 'Informe a data de início'),
  status: z.enum(STATUS_VIAGEM),
});

export type CamposViagem = z.infer<typeof esquemaViagem>;

/** Rota calculada pelo ORS, ja simplificada. Nula se o calculo falhou. */
export interface RotaParaGravar {
  polyline: string;
  distanciaKm: number;
}

// `type`, e nao `interface`: vai como JSON para o push_changes, e so tipo
// literal e aceito onde o supabase-js espera Json.
export type RegistroViagem = {
  id: string;
  /** Nulo na viagem sem frete. */
  frete_id: string | null;
  veiculo_tracao_id: string;
  veiculo_reboque_id: string | null;
  inicio_em: string;
  status: StatusViagem;
  origem_nome: string;
  origem_lat: number;
  origem_lng: number;
  destino_nome: string;
  destino_lat: number;
  destino_lng: number;
  rota_polyline: string | null;
  km_previsto: number | null;
};

/** Origem, destino e rota, nas colunas da viagem. */
export function trechoDaViagem(
  origem: Lugar,
  destino: Lugar,
  rota: RotaParaGravar | null,
): Pick<
  RegistroViagem,
  | 'origem_nome'
  | 'origem_lat'
  | 'origem_lng'
  | 'destino_nome'
  | 'destino_lat'
  | 'destino_lng'
  | 'rota_polyline'
  | 'km_previsto'
> {
  return {
    origem_nome: origem.nome,
    origem_lat: arredondarCoordenada(origem.lat),
    origem_lng: arredondarCoordenada(origem.lng),
    destino_nome: destino.nome,
    destino_lat: arredondarCoordenada(destino.lat),
    destino_lng: arredondarCoordenada(destino.lng),
    rota_polyline: rota?.polyline ?? null,
    km_previsto: rota ? Math.round(rota.distanciaKm * 10) / 10 : null,
  };
}

/**
 * Instante de inicio a gravar. Se o DIA nao mudou, mantem o instante que ja
 * estava gravado: a viagem iniciada pelo celular as 05:32 continua 05:32 depois
 * de alguem corrigir a carreta no web.
 */
export function inicioDaViagem(dia: string, gravado?: string | null): string {
  return gravado && diaLocal(gravado) === dia ? gravado : meioDiaLocal(dia);
}

/** Converte o formulario de viagem (sem frete) na linha do banco. */
export function paraRegistroViagem(
  campos: CamposViagem,
  rota: RotaParaGravar | null,
  id: string,
  inicioGravado?: string | null,
): RegistroViagem {
  const { origem, destino } = campos;
  if (!origem || !destino) throw new Error('Origem e destino sao obrigatorios');
  return {
    id,
    frete_id: null,
    veiculo_tracao_id: campos.veiculoTracaoId,
    veiculo_reboque_id: campos.veiculoReboqueId === SEM_VINCULO ? null : campos.veiculoReboqueId,
    inicio_em: inicioDaViagem(campos.inicio, inicioGravado),
    status: campos.status,
    ...trechoDaViagem(origem, destino, rota),
  };
}

/**
 * 'AAAA-MM-DD' -> instante ao MEIO-DIA local.
 *
 * Meia-noite seria o obvio, e erraria o mes: 01/10 a 00:00 em Brasilia ainda e
 * 30/09 as 23:00 em Manaus, e a viagem apareceria no mes anterior para quem
 * abrisse o app de la. Meio-dia fica no mesmo dia em qualquer fuso do Brasil.
 */
export function meioDiaLocal(dia: string): string {
  const d = dataLocal(dia);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

/** Instante ISO -> 'AAAA-MM-DD' no fuso do navegador. */
export function diaLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A coluna e numeric(9,6): mais casas o banco arredondaria do jeito dele. */
function arredondarCoordenada(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}
