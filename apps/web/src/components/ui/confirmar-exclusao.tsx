import { useEffect, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/feedback';

/**
 * Confirmacao de exclusao. Mostra o erro do banco dentro do proprio dialogo, em
 * vez de fechar e deixar o usuario achando que excluiu.
 */
export function ConfirmarExclusao({
  aberto,
  titulo,
  descricao,
  aoConfirmar,
  aoFechar,
}: {
  aberto: boolean;
  titulo: string;
  descricao: ReactNode;
  aoConfirmar: () => Promise<void>;
  aoFechar: () => void;
}) {
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aberto) setErro(null);
  }, [aberto]);

  const confirmar = async () => {
    setPendente(true);
    setErro(null);
    try {
      await aoConfirmar();
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setPendente(false);
    }
  };

  return (
    // Enquanto grava, nao fecha: fechar no meio deixaria a duvida se excluiu.
    <Dialog open={aberto} onOpenChange={(v) => !v && !pendente && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>

        {erro ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {erro}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={aoFechar} disabled={pendente}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => void confirmar()} disabled={pendente}>
            {pendente ? <Spinner /> : null}
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
