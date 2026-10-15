import { Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmarExclusao } from '@/components/ui/confirmar-exclusao';

/**
 * "Apagar frete" / "Apagar viagem": no formulario de edicao, no canto inferior
 * esquerdo (pedido do usuario em 2026-10-15), com uma confirmacao que diz o
 * que sai junto e o que fica.
 *
 * Vai dentro do DialogFooter: o `sm:mr-auto` o separa dos botoes da direita, e
 * no celular, com o rodape empilhado, ele fica por ultimo.
 */
export function BotaoApagar({
  rotulo,
  descricao,
  desabilitado,
  aoApagar,
}: {
  rotulo: string;
  descricao: ReactNode;
  desabilitado?: boolean;
  aoApagar: () => Promise<void>;
}) {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="text-destructive hover:text-destructive sm:mr-auto"
        disabled={desabilitado}
        onClick={() => setConfirmando(true)}
      >
        <Trash2 className="size-4" aria-hidden />
        {rotulo}
      </Button>
      <ConfirmarExclusao
        aberto={confirmando}
        titulo={`${rotulo}?`}
        descricao={descricao}
        rotuloConfirmar="Apagar"
        aoConfirmar={aoApagar}
        aoFechar={() => setConfirmando(false)}
      />
    </>
  );
}
