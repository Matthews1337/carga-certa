import {
  ROTULOS,
  decodificarPolyline,
  formatarKm,
  resumirRecebimento,
  type Ponto,
} from '@carga-certa/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Carregando, ErroConsulta, Vazio } from '@/components/ui/feedback';
import { cidadeDoLugar, kmDoFrete, mesDoInicio } from '@/fretes/apresentacao';
import { chavesFretes, listarFretes, type FreteDaLista } from '@/fretes/api';
import { FreteDetalheDialog } from '@/fretes/FreteDetalheDialog';
import { FreteFormDialog } from '@/fretes/FreteFormDialog';
import { MiniMapa } from '@/fretes/MiniMapa';
import { ValorDoFrete } from '@/fretes/ValorDoFrete';
import { cn } from '@/lib/utils';

export function FretesPage() {
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<FreteDaLista | undefined>();

  const fretes = useQuery({ queryKey: chavesFretes.lista, queryFn: listarFretes });

  // Guarda o id, e nao o objeto: depois de lancar um recebimento, a lista
  // recarrega e o detalhe aberto mostra a versao nova.
  const freteDoDetalhe = fretes.data?.find((f) => f.id === detalhe) ?? null;

  const novo = () => {
    setEditando(undefined);
    setFormAberto(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fretes</h1>
          <p className="text-sm text-muted-foreground">
            Cada frete com a sua viagem: rota, km, mês e quanto já caiu.
          </p>
        </div>
        <Button variant="accent" onClick={novo}>
          <Plus className="size-4" aria-hidden />
          Novo frete
        </Button>
      </header>

      {fretes.isPending ? (
        <Carregando />
      ) : fretes.isError ? (
        <ErroConsulta erro={fretes.error} />
      ) : fretes.data.length === 0 ? (
        <Vazio
          titulo="Nenhum frete cadastrado"
          descricao="Marque no mapa onde o frete começa e termina: o app calcula a rota de caminhão e os km."
          acao={
            <Button variant="accent" onClick={novo}>
              <Plus className="size-4" aria-hidden />
              Novo frete
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {fretes.data.map((f) => (
            <CartaoFrete key={f.id} frete={f} aoAbrir={() => setDetalhe(f.id)} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Mapas: OpenFreeMap, dados © colaboradores do OpenStreetMap. Contornos dos estados: IBGE.
      </p>

      <FreteDetalheDialog
        frete={freteDoDetalhe}
        aoFechar={() => setDetalhe(null)}
        aoEditar={(f) => {
          setDetalhe(null);
          setEditando(f);
          setFormAberto(true);
        }}
      />

      <FreteFormDialog aberto={formAberto} aoFechar={() => setFormAberto(false)} frete={editando} />
    </div>
  );
}

function CartaoFrete({ frete, aoAbrir }: { frete: FreteDaLista; aoAbrir: () => void }) {
  const v = frete.viagem;
  const origem = cidadeDoLugar(v?.origem_nome);
  const destino = cidadeDoLugar(v?.destino_nome);
  const { km, previsto } = kmDoFrete(v);
  const { situacao } = resumirRecebimento({
    statusFrete: frete.status,
    valorCombinado: frete.valor_total,
    recebimentos: frete.recebimentos.map((r) => ({ tipo: r.tipo, valor: r.valor, recebidoEm: r.recebido_em })),
  });

  const pontos = useMemo(() => {
    const ponto = (lat: number | null | undefined, lng: number | null | undefined): Ponto | null =>
      lat !== null && lat !== undefined && lng !== null && lng !== undefined ? [lat, lng] : null;
    let rota: Ponto[] | null = null;
    try {
      rota = v?.rota_polyline ? decodificarPolyline(v.rota_polyline) : null;
    } catch {
      // Rota corrompida: o card mostra a reta entre os pinos, e nao quebra.
    }
    return {
      origem: ponto(v?.origem_lat, v?.origem_lng),
      destino: ponto(v?.destino_lat, v?.destino_lng),
      rota,
      posicao: frete.posicao ? ([frete.posicao.latitude, frete.posicao.longitude] as Ponto) : null,
    };
  }, [v, frete.posicao]);

  // O botao e o titulo, esticado sobre o card inteiro (after:inset-0): o clique
  // vale em qualquer lugar, e o leitor de tela anuncia "Rio Verde, GO ate
  // Santos, SP, botao" - e nao o card todo, com mapa e numeros, como nome.
  return (
    <article
      className={cn(
        'relative flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground',
        'transition-colors hover:border-accent has-focus-visible:ring-2 has-focus-visible:ring-ring',
        frete.status === 'CANCELADO' && 'opacity-60',
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5 p-4 pb-3">
        <h2 className="font-semibold leading-snug" title={`${v?.origem_nome ?? ''} → ${v?.destino_nome ?? ''}`}>
          <button
            type="button"
            onClick={aoAbrir}
            className="flex w-full items-center gap-1.5 text-left after:absolute after:inset-0 focus-visible:outline-none"
          >
            <span className="truncate">{origem}</span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-label="até" />
            <span className="truncate">{destino}</span>
          </button>
        </h2>
        {/* O selo fica nesta linha, e nao ao lado do titulo: la ele espremia
            as duas cidades ate virarem "Rio Verd... -> Santo...". */}
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 truncate text-sm text-muted-foreground">
            {frete.contratante?.nome ?? 'Sem contratante'}
          </p>
          {frete.status === 'EM_ANDAMENTO' || frete.status === 'CONCLUIDO' ? (
            <Badge variant={frete.status === 'EM_ANDAMENTO' ? 'warning' : 'default'} className="shrink-0">
              {ROTULOS.statusFrete[frete.status]}
            </Badge>
          ) : null}
        </div>
      </div>

      <MiniMapa
        origem={pontos.origem}
        destino={pontos.destino}
        rota={pontos.rota}
        posicao={pontos.posicao}
        rotulo={`Rota de ${origem} até ${destino}${frete.posicao ? ', com a última posição do motorista' : ''}`}
      />

      <dl className="grid grid-cols-3 items-end gap-2 p-4 pt-3">
        <div>
          <dt className="text-xs text-muted-foreground">{previsto ? 'Km previstos' : 'Km rodados'}</dt>
          <dd className="tabular font-semibold">{km !== null ? formatarKm(km) : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Início</dt>
          <dd className="font-semibold">{mesDoInicio(v?.inicio_em)}</dd>
        </div>
        <div className="text-right">
          <dt className="sr-only">Valor combinado</dt>
          <dd>
            <ValorDoFrete valor={frete.valor_total} situacao={situacao} className="items-end" />
          </dd>
        </div>
      </dl>
    </article>
  );
}
