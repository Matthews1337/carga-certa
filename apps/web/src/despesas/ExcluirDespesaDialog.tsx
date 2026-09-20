import { formatarBRL } from '@carga-certa/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
import { chavesDespesa, excluirDespesa, type DespesaDaLista } from '@/despesas/api';

export function ExcluirDespesaDialog({
  despesa,
  aoFechar,
}: {
  despesa: DespesaDaLista | null;
  aoFechar: () => void;
}) {
  const queryClient = useQueryClient();

  const excluir = useMutation({
    mutationFn: (id: string) => excluirDespesa(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chavesDespesa.todas });
      aoFechar();
    },
  });

  return (
    <Dialog open={despesa !== null} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir despesa</DialogTitle>
          <DialogDescription>
            {despesa
              ? `${formatarBRL(despesa.valor)} em ${despesa.categoria?.nome ?? 'categoria removida'}.`
              : null}{' '}
            A exclusao e logica: o registro sai das listas e some tambem do celular no proximo
            sync, mas continua no banco para o historico.
          </DialogDescription>
        </DialogHeader>

        {excluir.isError ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {excluir.error instanceof Error ? excluir.error.message : String(excluir.error)}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={excluir.isPending}
            onClick={() => despesa && excluir.mutate(despesa.id)}
          >
            {excluir.isPending ? <Spinner /> : null}
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
