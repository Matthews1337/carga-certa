import { BotaoArquivo } from '@/components/ui/botao-arquivo';
import { urlDoComprovante } from '@/despesas/api';

export function BotaoComprovante({ caminho }: { caminho: string }) {
  return <BotaoArquivo rotulo="Ver comprovante" obterUrl={() => urlDoComprovante(caminho)} />;
}
