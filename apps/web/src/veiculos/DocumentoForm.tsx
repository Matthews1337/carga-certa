import { zodResolver } from '@hookform/resolvers/zod';
import { uuidv7 } from '@carga-certa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip } from 'lucide-react';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { usePilotoId } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { DialogFooter } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TAMANHO_MAXIMO_DOCUMENTO,
  chavesVeiculos,
  listarTiposDocumentoVeiculo,
  salvarDocumento,
  subirArquivoDocumento,
  type DocumentoDoVeiculo,
} from '@/veiculos/api';
import { esquemaDocumento, type CamposDocumento } from '@/veiculos/esquema';

/**
 * Cadastro e edicao de um documento. Vive dentro do dialogo de documentos, no
 * lugar da lista, em vez de abrir um segundo dialogo por cima do primeiro.
 */
export function DocumentoForm({
  veiculoId,
  documento,
  aoTerminar,
}: {
  veiculoId: string;
  /** Ausente = criando. */
  documento?: DocumentoDoVeiculo;
  aoTerminar: () => void;
}) {
  const pilotoId = usePilotoId();
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const tipos = useQuery({
    queryKey: chavesVeiculos.tiposDocumento,
    queryFn: listarTiposDocumentoVeiculo,
  });

  const form = useForm<CamposDocumento>({
    resolver: zodResolver(esquemaDocumento),
    defaultValues: {
      tipoDocumentoId: documento?.tipo_documento_id ?? '',
      numero: documento?.numero ?? '',
      emissao: documento?.emissao ?? '',
      validade: documento?.validade ?? '',
    },
  });

  const tipoEscolhido = tipos.data?.find((t) => t.id === form.watch('tipoDocumentoId'));

  const gravar = useMutation({
    mutationFn: async (campos: CamposDocumento) => {
      const id = documento?.id ?? uuidv7();

      // Upload antes do banco, como no comprovante da despesa: se o upload
      // falhar, nada foi gravado apontando para um arquivo que nao existe.
      let caminho = documento?.arquivo_path ?? null;
      if (arquivo) {
        caminho = await subirArquivoDocumento(pilotoId, id, arquivo, caminho);
      }

      await salvarDocumento({
        id,
        veiculo_id: veiculoId,
        tipo_documento_id: campos.tipoDocumentoId,
        numero: campos.numero.trim() || null,
        emissao: campos.emissao || null,
        validade: campos.validade || null,
        arquivo_path: caminho,
      });
    },
    onSuccess: async () => {
      // ['veiculos'] cobre a lista de documentos e o aviso do card.
      await queryClient.invalidateQueries({ queryKey: chavesVeiculos.todos });
      aoTerminar();
    },
    onError: (e: unknown) => setErro(e instanceof Error ? e.message : String(e)),
  });

  const escolherArquivo = (escolhido: File | null) => {
    setErro(null);
    // O bucket recusaria de qualquer jeito, mas so depois de subir 30 MB por 4G.
    if (escolhido && escolhido.size > TAMANHO_MAXIMO_DOCUMENTO) {
      setErro('O arquivo passa de 10 MB. Envie uma foto menor ou um PDF comprimido.');
      setArquivo(null);
      return;
    }
    setArquivo(escolhido);
  };

  const erros = form.formState.errors;

  return (
    <form
      onSubmit={form.handleSubmit((c) => gravar.mutate(c))}
      className="flex flex-col gap-4"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Documento" erro={erros.tipoDocumentoId?.message}>
          <Controller
            control={form.control}
            name="tipoDocumentoId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-invalid={!!erros.tipoDocumentoId}>
                  <SelectValue placeholder={tipos.isPending ? 'Carregando...' : 'Escolha o documento'} />
                </SelectTrigger>
                <SelectContent>
                  {(tipos.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Campo>

        <Campo rotulo="Número" erro={erros.numero?.message}>
          <Input {...form.register('numero')} autoComplete="off" aria-invalid={!!erros.numero} />
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Emissão" erro={erros.emissao?.message}>
          <Input {...form.register('emissao')} type="date" aria-invalid={!!erros.emissao} />
        </Campo>

        <Campo
          rotulo="Validade"
          erro={erros.validade?.message}
          dica={
            tipoEscolhido?.periodicidade_meses
              ? `Validade usual: ${descreverPeriodo(tipoEscolhido.periodicidade_meses)}`
              : 'Em branco se não vence'
          }
        >
          <Input {...form.register('validade')} type="date" aria-invalid={!!erros.validade} />
        </Campo>
      </div>

      {/* Fora do <Campo> de proposito: um <label> em volta do botao e do input
          escondido repassaria o clique e abriria o seletor duas vezes. */}
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-sm font-medium leading-none">Arquivo</span>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputArquivo.current?.click()}
          >
            <Paperclip className="size-4" aria-hidden />
            Escolher arquivo
          </Button>
          <span className="min-w-0 truncate text-sm text-muted-foreground">
            {arquivo?.name ??
              (documento?.arquivo_path ? 'Arquivo já anexado' : 'Nenhum arquivo')}
          </span>
          <input
            ref={inputArquivo}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => {
              escolherArquivo(e.target.files?.[0] ?? null);
              // Permite escolher de novo o mesmo arquivo depois de um erro.
              e.target.value = '';
            }}
          />
        </div>
        <p className="text-sm text-muted-foreground">Foto ou PDF, até 10 MB</p>
      </div>

      {erro ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {erro}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={aoTerminar} disabled={gravar.isPending}>
          Voltar
        </Button>
        <Button type="submit" variant="accent" disabled={gravar.isPending}>
          {gravar.isPending ? <Spinner /> : null}
          Salvar
        </Button>
      </DialogFooter>
    </form>
  );
}

/** 12 -> "1 ano", 60 -> "5 anos", 30 -> "30 meses". */
function descreverPeriodo(meses: number): string {
  if (meses % 12 === 0) {
    const anos = meses / 12;
    return anos === 1 ? '1 ano' : `${anos} anos`;
  }
  return meses === 1 ? '1 mês' : `${meses} meses`;
}
