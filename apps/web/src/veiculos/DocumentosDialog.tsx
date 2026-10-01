import {
  dataLocal,
  descreverVencimento,
  formatarPlaca,
  situacaoVencimento,
  type SituacaoVencimento,
} from '@carga-certa/shared';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { BotaoArquivo } from '@/components/ui/botao-arquivo';
import { Button } from '@/components/ui/button';
import { ConfirmarExclusao } from '@/components/ui/confirmar-exclusao';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Carregando, ErroConsulta, Vazio } from '@/components/ui/feedback';
import {
  chavesVeiculos,
  excluirDocumento,
  listarDocumentos,
  urlDoArquivoDocumento,
  type DocumentoDoVeiculo,
  type VeiculoDaLista,
} from '@/veiculos/api';
import { DocumentoForm } from '@/veiculos/DocumentoForm';

type Tela = { modo: 'lista' } | { modo: 'form'; documento?: DocumentoDoVeiculo };

const VARIANTE: Record<SituacaoVencimento, 'destructive' | 'warning' | 'success'> = {
  VENCIDO: 'destructive',
  CRITICO: 'warning',
  ATENCAO: 'warning',
  OK: 'success',
};

const formatarData = (iso: string) => dataLocal(iso).toLocaleDateString('pt-BR');

export function DocumentosDialog({
  veiculo,
  aoFechar,
}: {
  /** Null = fechado. */
  veiculo: VeiculoDaLista | null;
  aoFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const [tela, setTela] = useState<Tela>({ modo: 'lista' });
  const [excluindo, setExcluindo] = useState<DocumentoDoVeiculo | null>(null);

  // Abrir os documentos de outro veiculo sempre comeca pela lista.
  useEffect(() => {
    if (veiculo) setTela({ modo: 'lista' });
  }, [veiculo]);

  const documentos = useQuery({
    queryKey: chavesVeiculos.documentos(veiculo?.id ?? ''),
    queryFn: veiculo ? () => listarDocumentos(veiculo.id) : skipToken,
  });

  const placa = veiculo ? formatarPlaca(veiculo.placa) : '';

  return (
    <>
      <Dialog open={veiculo !== null} onOpenChange={(v) => !v && aoFechar()}>
        <DialogContent className="sm:max-w-2xl">
          {tela.modo === 'form' && veiculo ? (
            <>
              <DialogHeader>
                <DialogTitle>{tela.documento ? 'Editar documento' : 'Novo documento'}</DialogTitle>
                <DialogDescription>
                  Veículo {placa}. Com a foto ou o PDF anexado, o documento fica à mão numa
                  fiscalização.
                </DialogDescription>
              </DialogHeader>
              <DocumentoForm
                key={tela.documento?.id ?? 'novo'}
                veiculoId={veiculo.id}
                documento={tela.documento}
                aoTerminar={() => setTela({ modo: 'lista' })}
              />
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Documentos · {placa}</DialogTitle>
                <DialogDescription>O que vence primeiro aparece no topo.</DialogDescription>
              </DialogHeader>

              {documentos.isPending ? (
                <Carregando />
              ) : documentos.isError ? (
                <ErroConsulta erro={documentos.error} />
              ) : documentos.data.length === 0 ? (
                <Vazio
                  titulo="Nenhum documento cadastrado"
                  descricao="Cadastre o CRLV, a ANTT e os seguros para o app avisar antes de vencer."
                />
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {documentos.data.map((d) => (
                    <LinhaDocumento
                      key={d.id}
                      documento={d}
                      aoEditar={() => setTela({ modo: 'form', documento: d })}
                      aoExcluir={() => setExcluindo(d)}
                    />
                  ))}
                </ul>
              )}

              <DialogFooter>
                <Button variant="ghost" onClick={aoFechar}>
                  Fechar
                </Button>
                <Button variant="accent" onClick={() => setTela({ modo: 'form' })}>
                  <Plus className="size-4" aria-hidden />
                  Adicionar documento
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmarExclusao
        aberto={excluindo !== null}
        titulo="Excluir documento"
        descricao={
          excluindo
            ? `${excluindo.tipo?.nome ?? 'Documento'} do veículo ${placa} sai da lista e para de gerar aviso.`
            : ''
        }
        aoConfirmar={async () => {
          if (!excluindo) return;
          await excluirDocumento(excluindo.id);
          await queryClient.invalidateQueries({ queryKey: chavesVeiculos.todos });
        }}
        aoFechar={() => setExcluindo(null)}
      />
    </>
  );
}

function LinhaDocumento({
  documento: d,
  aoEditar,
  aoExcluir,
}: {
  documento: DocumentoDoVeiculo;
  aoEditar: () => void;
  aoExcluir: () => void;
}) {
  const nome = d.tipo?.nome ?? 'Documento';
  const validade = d.validade ? dataLocal(d.validade) : null;
  const situacao = situacaoVencimento(validade);

  const detalhes = [
    d.numero ? `Nº ${d.numero}` : null,
    d.emissao ? `Emitido em ${formatarData(d.emissao)}` : null,
    d.validade ? `Válido até ${formatarData(d.validade)}` : 'Sem validade',
  ].filter(Boolean);

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
      {/* min-w-48: no celular o texto fica com a linha toda, e selo e botoes
          descem, em vez de espremer o nome do documento letra a letra. */}
      <div className="min-w-48 flex-1">
        <p className="font-medium">{nome}</p>
        <p className="text-sm text-muted-foreground">{detalhes.join(' · ')}</p>
      </div>

      {validade && situacao ? (
        <Badge variant={VARIANTE[situacao]}>{descreverVencimento(validade)}</Badge>
      ) : null}

      <div className="ml-auto flex items-center gap-1">
        {d.arquivo_path ? (
          <BotaoArquivo
            rotulo={`Ver arquivo: ${nome}`}
            obterUrl={() => urlDoArquivoDocumento(d.arquivo_path as string)}
          />
        ) : (
          // Mesmo tamanho do botao: sem isto, as linhas sem arquivo desalinham.
          <span className="inline-flex size-9 items-center justify-center">
            <FileText className="size-4 opacity-20" aria-label="Sem arquivo" />
          </span>
        )}
        <Button variant="ghost" size="sm" aria-label={`Editar ${nome}`} onClick={aoEditar}>
          <Pencil className="size-4" aria-hidden />
        </Button>
        <Button variant="ghost" size="sm" aria-label={`Excluir ${nome}`} onClick={aoExcluir}>
          <Trash2 className="size-4 text-destructive" aria-hidden />
        </Button>
      </div>
    </li>
  );
}
