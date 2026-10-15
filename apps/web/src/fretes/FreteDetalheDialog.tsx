import { ROTULOS, formatarBRL, formatarKm, resumirRecebimento } from '@carga-certa/shared';
import { Pencil } from 'lucide-react';

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
import type { FreteDaLista } from '@/fretes/api';
import { Recebimentos } from '@/fretes/Recebimentos';
import { ValorDoFrete } from '@/fretes/ValorDoFrete';
import { cn } from '@/lib/utils';
import { kmDaViagem } from '@/viagens/apresentacao';
import {
  ListaDeDespesas,
  MapaDoDetalhe,
  Numero,
  useConjunto,
  useDespesasDaViagem,
} from '@/viagens/DetalheDaViagem';

/**
 * Detalhe do frete, aberto pelo card: o mapa de verdade, as contas (saldo
 * liquido e o que ja caiu) e os recebimentos, que so se lancam aqui. Mapa e
 * despesas sao os mesmos do detalhe da viagem.
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
  const { consulta: despesas, total: totalDespesas } = useDespesasDaViagem(v?.id ?? null);
  const conjunto = useConjunto(v);

  const resumo = resumirRecebimento({
    statusFrete: frete.status,
    valorCombinado: frete.valor_total,
    recebimentos: frete.recebimentos.map((r) => ({ tipo: r.tipo, valor: r.valor, recebidoEm: r.recebido_em })),
  });
  const { km, previsto } = kmDaViagem(v);

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

      <MapaDoDetalhe viagem={v} posicao={frete.posicao} />

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

      <ListaDeDespesas temViagem={v !== null} consulta={despesas} />

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
