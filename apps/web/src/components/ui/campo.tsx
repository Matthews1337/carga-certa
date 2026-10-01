import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Rotulo + controle + mensagem de erro ou dica.
 *
 * O <label> ENVOLVE o controle, e isso liga os dois sem precisar de id: o
 * leitor de tela anuncia "Placa, caixa de texto" em vez de so "caixa de texto",
 * e clicar no rotulo foca o campo. Funciona com input nativo e com o gatilho do
 * Select do Radix, que e um <button> - tambem um elemento rotulavel.
 *
 * Erro e dica ficam FORA do label de proposito: dentro, virariam parte do nome
 * do campo, e o leitor leria a mensagem inteira a cada foco.
 */
export function Campo({
  rotulo,
  erro,
  dica,
  className,
  children,
}: {
  rotulo: string;
  erro?: string;
  dica?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-sm font-medium leading-none">{rotulo}</span>
        {children}
      </label>
      {erro ? (
        <p className="text-sm text-destructive">{erro}</p>
      ) : dica ? (
        <p className="text-sm text-muted-foreground">{dica}</p>
      ) : null}
    </div>
  );
}
