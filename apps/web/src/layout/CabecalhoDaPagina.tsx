import type { ReactNode } from 'react';

import { BotaoAjuda } from '@/tutorial/BotaoAjuda';
import { ALVO_DO_CABECALHO, type TourDaPagina } from '@/tutorial/passos';

/**
 * Titulo, descricao e o botao "i" de cada tela. `children` sao as acoes do
 * lado direito ("Nova despesa", o seletor de mes do Painel).
 */
export function CabecalhoDaPagina({
  titulo,
  descricao,
  tour,
  children,
}: {
  titulo: string;
  descricao: string;
  tour: TourDaPagina;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div data-tour={ALVO_DO_CABECALHO} className="min-w-0">
        {/* relative: a dica do botao "i" se posiciona por esta linha. */}
        <div className="relative flex items-center gap-0.5">
          <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
          <BotaoAjuda tour={tour} titulo={titulo} descricao={descricao} />
        </div>
        <p className="text-sm text-muted-foreground">{descricao}</p>
      </div>
      {children}
    </header>
  );
}
