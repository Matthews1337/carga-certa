import {
  ROTULOS,
  decodificarPolyline,
  formatarBRL,
  formatarKm,
  formatarPlaca,
  resumirRecebimento,
  somar,
  type Ponto,
} from '@carga-certa/shared';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Pencil } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Carregando, ErroConsulta } from '@/components/ui/feedback';
import { kmDoFrete, tempoDesde } from '@/fretes/apresentacao';
import { chavesFretes, listarDespesasDaViagem, type FreteDaLista } from '@/fretes/api';
import { MapaFrete } from '@/fretes/MapaFrete';
import { Recebimentos } from '@/fretes/Recebimentos';
import { ValorDoFrete } from '@/fretes/ValorDoFrete';
import { cn } from '@/lib/utils';
import { chavesVeiculos, listarVeiculos } from '@/veiculos/api';

/**
 * Detalhe do frete, aberto pelo card: o mapa de verdade, as contas (saldo
 * liquido e o que ja caiu) e os recebimentos, que so se lancam aqui.
 */
export function FreteDetalheDialog({
  frete,
  aoFechar,
  aoEditar,
}: {
  /** Null = fechado. */
  frete: FreteDaLista | null;
  aoFechar: () => void;
  aoEditar: (frete: FreteDaLista) => void;
}) {
  return (
    <Dialog open={frete !== null} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-3xl">
        {frete ? <Conteudo frete={frete} aoFechar={aoFechar} aoEditar={aoEditar} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Conteudo({
  frete,
  aoFechar,
  aoEditar,
}: {
  frete: FreteDaLista;
  aoFechar: () => void;
  aoEditar: (frete: FreteDaLista) => void;
}) {
  const v = frete.viagem;

  const despesas = useQuery({
    queryKey: chavesFretes.despesas(v?.id ?? ''),
    queryFn: () => listarDespesasDaViagem(v?.id ?? ''),
    enabled: v !== null,
  });
  const veiculos = useQuery({ queryKey: chavesVeiculos.lista, queryFn: listarVeiculos });

  const resumo = resumirRecebimento({
    statusFrete: frete.status,
    valorCombinado: frete.valor_total,
    recebimentos: frete.recebimentos.map((r) => ({ tipo: r.tipo, valor: r.valor, recebidoEm: r.recebido_em })),
  });

  // Mesmo corte da tela de Despesas e do Painel: cancelada nao conta.
  const totalDespesas = somar(
    (despesas.data ?? []).filter((d) => d.status !== 'CANCELADA').map((d) => d.valor),
  );
  const { km, previsto } = kmDoFrete(v);

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
      posicao: frete.posicao ? { lat: frete.posicao.latitude, lng: frete.posicao.longitude } : null,
    };
  }, [v, frete.posicao]);

  const placa = (id: string | null | undefined) => {
    if (!id) return null;
    const veiculo = veiculos.data?.find((x) => x.id === id);
    return veiculo ? formatarPlaca(veiculo.placa) : '…';
  };
  const conjunto = [placa(v?.veiculo_tracao_id), placa(v?.veiculo_reboque_id)].filter(Boolean).join(' + ');

  return (
    <>
      <DialogHeader>
        <DialogTitle className="leading-snug">
          {v?.origem_nome ?? 'Sem início'} → {v?.destino_nome ?? 'Sem fim'}
        </DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{frete.contratante?.nome ?? 'Sem contratante'}</span>
          <Badge variant={frete.status === 'CANCELADO' ? 'destructive' : 'outline'}>
            {ROTULOS.statusFrete[frete.status]}
          </Badge>
          {v?.inicio_em ? <span>Início em {new Date(v.inicio_em).toLocaleDateString('pt-BR')}</span> : null}
        </DialogDescription>
      </DialogHeader>

      <MapaFrete
        origem={mapa.origem}
        destino={mapa.destino}
        rota={mapa.rota}
        posicao={mapa.posicao}
        className="h-64 sm:h-72"
      />
      <p className="-mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <MapPin className="size-4 shrink-0" aria-hidden />
        {frete.posicao
          ? `Última posição do celular ${tempoDesde(frete.posicao.registrado_em)}.`
          : 'O celular ainda não enviou a posição desta viagem.'}
      </p>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Numero rotulo="Valor combinado">
          <ValorDoFrete valor={frete.valor_total} situacao={resumo.situacao} />
        </Numero>
        <Numero rotulo="Despesas da viagem">
          {despesas.isPending && v ? '…' : formatarBRL(totalDespesas)}
        </Numero>
        <Numero rotulo="Saldo líquido previsto" dica="Combinado − despesas">
          <span className={cn(frete.valor_total - totalDespesas < 0 && 'text-destructive')}>
            {formatarBRL(frete.valor_total - totalDespesas)}
          </span>
        </Numero>
        <Numero rotulo={previsto ? 'Km previstos' : 'Km rodados'} dica={conjunto || undefined}>
          {km !== null ? formatarKm(km) : '—'}
        </Numero>
      </dl>

      <Recebimentos frete={frete} resumo={resumo} />

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Despesas da viagem</h3>
        {!v ? (
          <p className="text-sm text-muted-foreground">Este frete não tem viagem.</p>
        ) : despesas.isPending ? (
          <Carregando />
        ) : despesas.isError ? (
          <ErroConsulta erro={despesas.error} />
        ) : despesas.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma despesa ligada a esta viagem. Lance em Despesas, escolhendo a viagem.
          </p>
        ) : (
          <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm">
            {despesas.data.map((d) => (
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

      <DialogFooter>
        <Button variant="ghost" onClick={aoFechar}>
          Fechar
        </Button>
        <Button variant="outline" onClick={() => aoEditar(frete)}>
          <Pencil className="size-4" aria-hidden />
          Editar frete
        </Button>
      </DialogFooter>
    </>
  );
}

function Numero({ rotulo, dica, children }: { rotulo: string; dica?: string; children: ReactNode }) {
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
