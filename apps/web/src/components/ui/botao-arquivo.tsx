import { useMutation } from '@tanstack/react-query';
import { FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/feedback';

/**
 * Abre um arquivo do Storage numa aba nova.
 *
 * A URL e assinada na hora do clique, e nao junto com a listagem: sao URLs de
 * validade curta, e gerar uma para cada linha faria dezenas de chamadas ao
 * Storage a cada consulta, quase todas para links que ninguem abre.
 */
export function BotaoArquivo({
  obterUrl,
  rotulo,
}: {
  obterUrl: () => Promise<string>;
  /** Nome acessivel e dica do botao: "Ver comprovante". */
  rotulo: string;
}) {
  const abrir = useMutation({
    mutationFn: obterUrl,
    onSuccess: (url) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
  });

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={rotulo}
      title={abrir.isError ? String(abrir.error) : rotulo}
      disabled={abrir.isPending}
      onClick={() => abrir.mutate()}
    >
      {abrir.isPending ? (
        <Spinner />
      ) : (
        <FileText className={abrir.isError ? 'size-4 text-destructive' : 'size-4'} aria-hidden />
      )}
    </Button>
  );
}
