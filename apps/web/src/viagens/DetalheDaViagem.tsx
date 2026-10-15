import {
  decodificarPolyline,
  formatarBRL,
  formatarPlaca,
  somar,
  type Ponto,
} from '@carga-certa/shared';
import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';

import { Carregando, ErroConsulta } from '@/components/ui/feedback';
import { cn } from '@/lib/utils';
import { chavesVeiculos, listarVeiculos } from '@/veiculos/api';
import { tempoDesde } from '@/viagens/apresentacao';
import {
  chavesViagens,
  listarDespesasDaViagem,
  type PosicaoAtual,
  type ViagemNaTela,
} from '@/viagens/api';
import { MapaViagem } from '@/viagens/MapaViagem';

/**
 * Partes do detalhe iguais no frete e na viagem: o mapa com a ultima posicao do
 * celular, as despesas da viagem e os quadros de numeros.
 */

/** Despesas da viagem e o total, sem as canceladas (mesmo corte do Painel). */
export function useDespesasDaViagem(viagemId: string | null) {
  const consulta = useQuery({
    queryKey: chavesViagens.despesas(viagemId ?? ''),
    queryFn: () => listarDespesasDaViagem(viagemId ?? ''),
    enabled: viagemId !== null,
  });
  const total = somar((consulta.data ?? []).filter((d) => d.status !== 'CANCELADA').map((d) => d.valor));
  return { consulta, total };
}

/** "RTA1B23 + RTB4C56": as placas do conjunto. */
export function useConjunto(viagem: ViagemNaTela | null): string {
  const veiculos = useQuery({ queryKey: chavesVeiculos.lista, queryFn: listarVeiculos });
  const placa = (id: string | null | undefined) => {
    if (!id) return null;
    const veiculo = veiculos.data?.find((x) => x.id === id);
    return veiculo ? formatarPlaca(veiculo.placa) : '…';
  };
  return [placa(viagem?.veiculo_tracao_id), placa(viagem?.veiculo_reboque_id)].filter(Boolean).join(' + ');
}

export function MapaDoDetalhe({
  viagem: v,
  posicao,
}: {
  viagem: ViagemNaTela | null;
  posicao: PosicaoAtual | null;
}) {
  const mapa = useMemo(() => {
    let rota: Ponto[] | null = null;
    try {
      rota = v?.rota_polyline ? decodificarPolyline(v.rota_polyline) : null;
    } catch {
      // Rota corrompida: o mapa mostra a reta entre os pinos.
    }
    const coord = (lat: number | null | undefined, lng: number | null | undefined) =>
      lat !== null && lat !== undefined && lng !== null && lng !== undefined ? { lat, lng } : null;
    return {
      origem: coord(v?.origem_lat, v?.origem_lng),
      destino: coord(v?.destino_lat, v?.destino_lng),
      rota,
      posicao: posicao ? { lat: posicao.latitude, lng: posicao.longitude } : null,
    };
  }, [v, posicao]);

  return (
    <>
      <MapaViagem
        origem={mapa.origem}
        destino={mapa.destino}
        rota={mapa.rota}
        posicao={mapa.posicao}
        className="h-64 sm:h-72"
      />
      <p className="-mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <MapPin className="size-4 shrink-0" aria-hidden />
        {posicao
          ? `Última posição do celular ${tempoDesde(posicao.registrado_em)}.`
          : 'O celular ainda não enviou a posição desta viagem.'}
      </p>
    </>
  );
}

export function ListaDeDespesas({
  temViagem,
  consulta,
}: {
  temViagem: boolean;
  consulta: ReturnType<typeof useDespesasDaViagem>['consulta'];
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Despesas da viagem</h3>
      {!temViagem ? (
        <p className="text-sm text-muted-foreground">Este frete não tem viagem.</p>
      ) : consulta.isPending ? (
        <Carregando />
      ) : consulta.isError ? (
        <ErroConsulta erro={consulta.error} />
      ) : consulta.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma despesa ligada a esta viagem. Lance em Despesas, escolhendo a viagem.
        </p>
      ) : (
        <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm">
          {consulta.data.map((d) => (
            <li
              key={d.id}
              className={cn('flex items-center gap-3 px-3 py-2', d.status === 'CANCELADA' && 'opacity-50 line-through')}
            >
              <span className="tabular w-14 shrink-0 text-muted-foreground">
                {new Date(d.data_hora).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {d.categoria?.nome ?? '—'}
                {d.descricao ? <span className="text-muted-foreground"> · {d.descricao}</span> : null}
              </span>
              <span className="tabular shrink-0 font-medium">{formatarBRL(d.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Numero({ rotulo, dica, children }: { rotulo: string; dica?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-border p-3">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="tabular mt-0.5 text-lg font-semibold leading-tight">
        {children}
        {dica ? (
          <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">{dica}</span>
        ) : null}
      </dd>
    </div>
  );
}
