import { useMutation } from '@tanstack/react-query';
import { FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/feedback';
import { urlDoComprovante } from '@/despesas/api';

/**
 * Abre o comprovante numa aba nova.
 *
 * A URL e assinada na hora do clique, e nao junto com a listagem: sao URLs de
 * validade curta, e gerar uma para cada linha faria dezenas de chamadas ao
 * Storage a cada troca de filtro, quase todas para links que ninguem abre.
 */
export function BotaoComprovante({ caminho }: { caminho: string }) {
  const abrir = useMutation({
    mutationFn: () => urlDoComprovante(caminho),
    onSuccess: (url) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
  });

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Ver comprovante"
      title={abrir.isError ? String(abrir.error) : 'Ver comprovante'}
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
