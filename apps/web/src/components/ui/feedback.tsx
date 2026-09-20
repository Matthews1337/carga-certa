import { AlertTriangle, Loader2 } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin', className)} aria-hidden />;
}

export function Carregando({ texto = 'Carregando...' }: { texto?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"
    >
      <Spinner />
      {texto}
    </div>
  );
}

/**
 * Erro de consulta. Mostra a mensagem real em vez de "algo deu errado": o
 * Postgres devolve texto util ("violates row-level security policy"), e esconder
 * isso so transfere o trabalho de diagnostico para o suporte.
 */
export function ErroConsulta({ erro, className }: { erro: unknown; className?: string }) {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm',
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <div>
        <p className="font-medium text-destructive">Nao foi possivel carregar</p>
        <p className="mt-1 text-muted-foreground">{mensagem}</p>
      </div>
    </div>
  );
}

export function Vazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="font-medium">{titulo}</p>
      {descricao ? <p className="max-w-sm text-sm text-muted-foreground">{descricao}</p> : null}
      {acao}
    </div>
  );
}
