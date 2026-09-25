import { Moon, MonitorCog, Sun, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTema } from '@/tema/TemaProvider';
import { proximoTema, type Tema } from '@/tema/tema';

const APARENCIA: Record<Tema, { rotulo: string; Icone: LucideIcon }> = {
  claro: { rotulo: 'claro', Icone: Sun },
  escuro: { rotulo: 'escuro', Icone: Moon },
  sistema: { rotulo: 'automatico', Icone: MonitorCog },
};

/**
 * Alterna claro -> escuro -> automatico num clique so.
 *
 * Um botao que cicla, e nao um menu: dentro da cabine o gesto precisa caber em
 * um toque, e sao so tres estados. O rotulo diz o estado atual e o proximo,
 * porque o icone sozinho nao resolve qual dos tres esta valendo.
 */
export function BotaoTema({ comRotulo = false, className }: { comRotulo?: boolean; className?: string }) {
  const { tema, definirTema } = useTema();

  const { rotulo, Icone } = APARENCIA[tema];
  const proximo = proximoTema(tema);
  const descricao = `Tema ${rotulo}. Trocar para ${APARENCIA[proximo].rotulo}`;

  return (
    <Button
      variant="ghost"
      size={comRotulo ? 'sm' : 'icon'}
      className={cn(comRotulo && 'w-full justify-start', className)}
      onClick={() => definirTema(proximo)}
      title={descricao}
      aria-label={descricao}
    >
      <Icone className={comRotulo ? 'size-4' : 'size-5'} aria-hidden />
      {comRotulo ? <span>Tema {rotulo}</span> : null}
    </Button>
  );
}
