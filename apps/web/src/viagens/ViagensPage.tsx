import { ROTULOS, formatarBRL, formatarKm, type StatusViagem } from '@carga-certa/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Plus } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Carregando, ErroConsulta, Vazio } from '@/components/ui/feedback';
import { cn } from '@/lib/utils';
import { chavesViagens, listarViagensSemFrete, type ViagemDaLista } from '@/viagens/api';
import { cidadeDoLugar, kmDaViagem, mesDoInicio } from '@/viagens/apresentacao';
import { useConjunto } from '@/viagens/DetalheDaViagem';
import { MiniMapaDaViagem } from '@/viagens/MiniMapa';
import { ViagemDetalheDialog } from '@/viagens/ViagemDetalheDialog';
import { ViagemFormDialog } from '@/viagens/ViagemFormDialog';

/**
 * Viagens sem frete: ir vazio ate a coleta, voltar depois da entrega, ir a
 * oficina. Rodar com custo e sem receita - os gastos entram no Painel do mes.
 *
 * Mesma tela dos fretes, sem a parte de pagamento: no lugar do valor
 * combinado, o card mostra quanto a viagem custou. A viagem de um frete fica no
 * card do frete.
 */
export function ViagensPage() {
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<ViagemDaLista | undefined>();

  const viagens = useQuery({ queryKey: chavesViagens.lista, queryFn: listarViagensSemFrete });

  // Guarda o id, e nao o objeto: depois de editar, a lista recarrega e o
  // detalhe aberto mostra a versao nova.
  const viagemDoDetalhe = viagens.data?.find((v) => v.id === detalhe) ?? null;

  const nova = () => {
    setEditando(undefined);
    setFormAberto(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Viagens</h1>
          <p className="text-sm text-muted-foreground">
            Deslocamentos sem frete: ir vazio até a coleta, voltar depois da entrega, ir à oficina.
          </p>
        </div>
        <Button variant="accent" onClick={nova}>
          <Plus className="size-4" aria-hidden />
          Nova viagem
        </Button>
      </header>

      {viagens.isPending ? (
        <Carregando />
      ) : viagens.isError ? (
        <ErroConsulta erro={viagens.error} />
      ) : viagens.data.length === 0 ? (
        <Vazio
          titulo="Nenhuma viagem sem frete"
          descricao="Registre aqui o caminho rodado sem carga. Os gastos dela entram no resultado do mês; a viagem de um frete fica no card do frete."
          acao={
            <Button variant="accent" onClick={nova}>
              <Plus className="size-4" aria-hidden />
              Nova viagem
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {viagens.data.map((v) => (
            <CartaoViagem key={v.id} viagem={v} aoAbrir={() => setDetalhe(v.id)} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Mapas: OpenFreeMap, dados © colaboradores do OpenStreetMap. Contornos dos estados: IBGE.
      </p>

      <ViagemDetalheDialog
        viagem={viagemDoDetalhe}
        aoFechar={() => setDetalhe(null)}
        aoEditar={(v) => {
          setDetalhe(null);
          setEditando(v);
          setFormAberto(true);
        }}
      />

      <ViagemFormDialog aberto={formAberto} aoFechar={() => setFormAberto(false)} viagem={editando} />
    </div>
  );
}

/** Selo de situacao. Planejada nao leva selo: e o comum, e o card fica limpo. */
const SELO: Partial<Record<StatusViagem, 'warning' | 'default' | 'destructive'>> = {
  EM_ANDAMENTO: 'warning',
  PAUSADA: 'default',
  CONCLUIDA: 'default',
  CANCELADA: 'destructive',
};

function CartaoViagem({ viagem: v, aoAbrir }: { viagem: ViagemDaLista; aoAbrir: () => void }) {
  const origem = cidadeDoLugar(v.origem_nome);
  const destino = cidadeDoLugar(v.destino_nome);
  const { km, previsto } = kmDaViagem(v);
  const conjunto = useConjunto(v);
  const selo = SELO[v.status];

  // O botao e o titulo, esticado sobre o card inteiro (after:inset-0): o clique
  // vale em qualquer lugar, e o leitor de tela anuncia so o trajeto.
  return (
    <article
      className={cn(
        'relative flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground',
        'transition-colors hover:border-accent has-focus-visible:ring-2 has-focus-visible:ring-ring',
        v.status === 'CANCELADA' && 'opacity-60',
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5 p-4 pb-3">
        <h2 className="font-semibold leading-snug" title={`${v.origem_nome ?? ''} → ${v.destino_nome ?? ''}`}>
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
        <div className="flex min-w-0 items-center gap-2">
          <p className="tabular min-w-0 truncate text-sm text-muted-foreground">{conjunto || 'Sem veículo'}</p>
          {selo ? (
            <Badge variant={selo} className="shrink-0">
              {ROTULOS.statusViagem[v.status]}
            </Badge>
          ) : null}
        </div>
      </div>

      <MiniMapaDaViagem
        viagem={v}
        posicao={v.posicao}
        rotulo={`Rota de ${origem} até ${destino}${v.posicao ? ', com a última posição do motorista' : ''}`}
      />

      <dl className="grid grid-cols-3 items-end gap-2 p-4 pt-3">
        <div>
          <dt className="text-xs text-muted-foreground">{previsto ? 'Km previstos' : 'Km rodados'}</dt>
          <dd className="tabular font-semibold">{km !== null ? formatarKm(km) : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Início</dt>
          <dd className="font-semibold">{mesDoInicio(v.inicio_em)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-xs text-muted-foreground">Gastos</dt>
          <dd className="tabular text-lg font-semibold leading-tight">{formatarBRL(v.gastos)}</dd>
        </div>
      </dl>
    </article>
  );
}
