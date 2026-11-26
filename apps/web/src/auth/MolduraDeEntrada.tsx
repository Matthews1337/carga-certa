import { Truck } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BotaoTema } from '@/tema/BotaoTema';

/** Fundo, logo e cartao das telas de quem ainda nao entrou (ou esta trocando a senha). */
export function MolduraDeEntrada({
  descricao,
  children,
}: {
  descricao: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh items-center justify-center bg-secondary/40 p-4">
      <div className="absolute right-3 top-3">
        <BotaoTema />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Truck className="size-6" aria-hidden />
          </div>
          <CardTitle className="text-2xl">Carga Certa</CardTitle>
          <CardDescription>{descricao}</CardDescription>
        </CardHeader>

        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

export function MensagemDeErro({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm font-medium text-destructive">
      {children}
    </p>
  );
}

export function MensagemDeAviso({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="text-sm font-medium text-success">
      {children}
    </p>
  );
}
