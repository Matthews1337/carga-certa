import { ROTULOS, formatarBRL, formatarKm } from '@carga-certa/shared';
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
import type { ViagemDaLista } from '@/viagens/api';
import { kmDaViagem } from '@/viagens/apresentacao';
import {
  ListaDeDespesas,
  MapaDoDetalhe,
  Numero,
  useConjunto,
  useDespesasDaViagem,
} from '@/viagens/DetalheDaViagem';

/**
 * Detalhe da viagem sem frete: o mapa com a ultima posicao, quanto custou, os
 * km e as despesas. Igual ao detalhe do frete, sem valor nem recebimentos.
 */
export function ViagemDetalheDialog({
  viagem,
  aoFechar,
  aoEditar,
}: {
  /** Null = fechado. */
  viagem: ViagemDaLista | null;
  aoFechar: () => void;
  aoEditar: (viagem: ViagemDaLista) => void;
}) {
  return (
    <Dialog open={viagem !== null} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-3xl">
        {viagem ? <Conteudo viagem={viagem} aoFechar={aoFechar} aoEditar={aoEditar} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Conteudo({
  viagem: v,
  aoFechar,
  aoEditar,
}: {
  viagem: ViagemDaLista;
  aoFechar: () => void;
  aoEditar: (viagem: ViagemDaLista) => void;
}) {
  const { consulta: despesas, total } = useDespesasDaViagem(v.id);
  const conjunto = useConjunto(v);
  const { km, previsto } = kmDaViagem(v);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="leading-snug">
          {v.origem_nome ?? 'Sem início'} → {v.destino_nome ?? 'Sem fim'}
        </DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>Viagem sem frete</span>
          <Badge variant={v.status === 'CANCELADA' ? 'destructive' : 'outline'}>
            {ROTULOS.statusViagem[v.status]}
          </Badge>
          {v.inicio_em ? <span>Início em {new Date(v.inicio_em).toLocaleDateString('pt-BR')}</span> : null}
        </DialogDescription>
      </DialogHeader>

      <MapaDoDetalhe viagem={v} posicao={v.posicao} />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Numero rotulo="Gastos da viagem" dica="Sem as despesas canceladas">
          {despesas.isPending ? '…' : formatarBRL(total)}
        </Numero>
        <Numero rotulo={previsto ? 'Km previstos' : 'Km rodados'}>
          {km !== null ? formatarKm(km) : '—'}
        </Numero>
        <Numero rotulo="Conjunto">{conjunto || '—'}</Numero>
      </dl>

      <ListaDeDespesas temViagem consulta={despesas} />

      <DialogFooter>
        <Button variant="ghost" onClick={aoFechar}>
          Fechar
        </Button>
        <Button variant="outline" onClick={() => aoEditar(v)}>
          <Pencil className="size-4" aria-hidden />
          Editar viagem
        </Button>
      </DialogFooter>
    </>
  );
}
