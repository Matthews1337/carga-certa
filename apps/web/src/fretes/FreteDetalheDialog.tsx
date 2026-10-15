import {
  ROTULOS,
  formatarBRL,
  formatarKm,
  planoDoValorRecebido,
  resumirRecebimento,
  somar,
} from '@carga-certa/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, CircleCheck, HandCoins } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/feedback';
import { chavesDespesa } from '@/despesas/api';
import { chavesFretes, concluirFrete, receberOQueFalta, type FreteDaLista } from '@/fretes/api';
import { Recebimentos } from '@/fretes/Recebimentos';
import { ValorDoFrete } from '@/fretes/ValorDoFrete';
import { cn } from '@/lib/utils';
import { kmDaViagem } from '@/viagens/apresentacao';
import {
  ListaDeDespesas,
  MapaDoDetalhe,
  Numero,
  RodapeDoDetalhe,
  useConjunto,
  useDespesasDaViagem,
} from '@/viagens/DetalheDaViagem';

/**
 * Detalhe do frete, aberto pelo card: o mapa de verdade, as contas (saldo
 * liquido e o que ja caiu) e os recebimentos, que so se lancam aqui. Mapa e
 * despesas sao os mesmos do detalhe da viagem.
 *
 * O rodape fecha o frete em dois cliques (abrir o card, clicar): "Valor
 * recebido" da o frete por pago (planoDoValorRecebido) e "Frete concluido"
 * encerra frete e viagem.
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
        {frete ? <Conteudo frete={frete} aoEditar={aoEditar} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Conteudo({ frete, aoEditar }: { frete: FreteDaLista; aoEditar: (frete: FreteDaLista) => void }) {
  const queryClient = useQueryClient();
  const v = frete.viagem;
  const { consulta: despesas, total: totalDespesas } = useDespesasDaViagem(v?.id ?? null);
  const conjunto = useConjunto(v);

  const resumo = resumirRecebimento({
    statusFrete: frete.status,
    valorCombinado: frete.valor_total,
    recebimentos: frete.recebimentos.map((r) => ({ tipo: r.tipo, valor: r.valor, recebidoEm: r.recebido_em })),
  });
  const { km, previsto } = kmDaViagem(v);

  const atualizar = (...chaves: (readonly string[])[]) =>
    Promise.all(chaves.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  const plano = planoDoValorRecebido({
    valorCombinado: frete.valor_total,
    recebimentos: frete.recebimentos.map((r) => ({ ...r, recebidoEm: r.recebido_em })),
  });
  const receber = useMutation({
    mutationFn: () => receberOQueFalta(frete.id, plano),
    onSuccess: () => atualizar(chavesFretes.todos, ['painel']),
  });
  const concluir = useMutation({
    mutationFn: () => concluirFrete(frete),
    // A viagem concluida conta no Painel e muda de situacao no menu da despesa.
    onSuccess: () => atualizar(chavesFretes.todos, ['painel'], chavesDespesa.viagens),
  });

  const recebido =
    resumo.situacao !== 'A_RECEBER' || (plano.confirmar.length === 0 && plano.saldoNovo === 0);
  const concluido = frete.status === 'CONCLUIDO' || frete.status === 'CANCELADO';

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

      <RodapeDoDetalhe
        rotuloEditar="Editar frete"
        aoEditar={() => aoEditar(frete)}
        erro={receber.error ?? concluir.error}
      >
        <Button
          variant="outline"
          disabled={recebido || receber.isPending}
          onClick={() => receber.mutate()}
          title={recebido ? undefined : oQueOCliqueFaz(plano)}
        >
          {receber.isPending ? (
            <Spinner />
          ) : recebido ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <HandCoins className="size-4" aria-hidden />
          )}
          Valor recebido
        </Button>
        <Button variant="accent" disabled={concluido || concluir.isPending} onClick={() => concluir.mutate()}>
          {concluir.isPending ? (
            <Spinner />
          ) : concluido ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <CircleCheck className="size-4" aria-hidden />
          )}
          Frete concluído
        </Button>
      </RodapeDoDetalhe>
    </>
  );
}

/** O que o clique em "Valor recebido" vai gravar, no title do botao: nao ha confirmacao. */
function oQueOCliqueFaz(plano: { confirmar: { valor: number }[]; saldoNovo: number }): string {
  const partes: string[] = [];
  if (plano.confirmar.length > 0) {
    partes.push(`confirma ${formatarBRL(somar(plano.confirmar.map((r) => r.valor)))} já lançado`);
  }
  if (plano.saldoNovo > 0) partes.push(`lança ${formatarBRL(plano.saldoNovo)} de saldo por Pix`);
  const texto = `${partes.join(' e ')}, caído hoje`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
