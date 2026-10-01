import { formatarBRL, type SituacaoRecebimento } from '@carga-certa/shared';
import { Ban, CircleCheck, Clock, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * O valor combinado do frete, na cor da situacao do recebimento, e SEMPRE com
 * o rotulo e o icone ao lado: laranja e verde sao o par que mais se confunde no
 * daltonismo vermelho-verde (decisao de 2026-09-29).
 */
const ESTILO: Record<SituacaoRecebimento, { rotulo: string; icone: LucideIcon; cor: string }> = {
  // Laranja escuro no claro: o laranja do tema daria contraste de 2:1 no branco.
  A_RECEBER: { rotulo: 'A receber', icone: Clock, cor: 'text-orange-700 dark:text-orange-400' },
  RECEBIDO: { rotulo: 'Recebido', icone: CircleCheck, cor: 'text-success' },
  CANCELADO: { rotulo: 'Cancelado', icone: Ban, cor: 'text-muted-foreground' },
};

export function ValorDoFrete({
  valor,
  situacao,
  className,
}: {
  valor: number;
  situacao: SituacaoRecebimento;
  className?: string;
}) {
  const { rotulo, icone: Icone, cor } = ESTILO[situacao];
  return (
    <div className={cn('flex flex-col', cor, className)}>
      <span className={cn('tabular text-lg font-semibold leading-tight', situacao === 'CANCELADO' && 'line-through')}>
        {formatarBRL(valor)}
      </span>
      <span className="flex items-center gap-1 text-xs font-medium">
        <Icone className="size-3.5 shrink-0" aria-hidden />
        {rotulo}
      </span>
    </div>
  );
}
