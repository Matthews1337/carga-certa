import { zodResolver } from '@hookform/resolvers/zod';
import {
  FORMA_PAGAMENTO,
  ROTULOS,
  STATUS_DESPESA,
  formatarBRL,
  parseValorDigitado,
  uuidv7,
  type FormaPagamento,
  type StatusDespesa,
} from '@carga-certa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { usePilotoId } from '@/auth/AuthProvider';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  chavesDespesa,
  listarCategorias,
  listarVeiculos,
  listarViagens,
  salvarDespesa,
  subirComprovante,
  type DespesaDaLista,
} from '@/despesas/api';

const SEM_VINCULO = 'nenhum';

const esquema = z.object({
  valor: z
    .string()
    .min(1, 'Informe o valor')
    .refine((v) => {
      const n = parseValorDigitado(v);
      return n !== null && n > 0;
    }, 'Valor invalido'),
  dataHora: z.string().min(1, 'Informe a data'),
  categoriaId: z.string().uuid('Escolha a categoria'),
  formaPagamento: z.enum(FORMA_PAGAMENTO),
  status: z.enum(STATUS_DESPESA),
  descricao: z.string().trim().max(500).optional(),
  viagemId: z.string(),
  veiculoId: z.string(),
});

type Campos = z.infer<typeof esquema>;

export function DespesaFormDialog({
  aberto,
  aoFechar,
  despesa,
}: {
  aberto: boolean;
  aoFechar: () => void;
  /** Ausente = criando. */
  despesa?: DespesaDaLista;
}) {
  const pilotoId = usePilotoId();
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const categorias = useQuery({ queryKey: chavesDespesa.categorias, queryFn: listarCategorias });
  const viagens = useQuery({ queryKey: chavesDespesa.viagens, queryFn: listarViagens });
  const veiculos = useQuery({ queryKey: chavesDespesa.veiculos, queryFn: listarVeiculos });

  const form = useForm<Campos>({
    resolver: zodResolver(esquema),
    defaultValues: valoresIniciais(despesa),
  });

  // O dialogo e montado uma vez e reaproveitado entre "nova" e "editar"; sem o
  // reset, abrir para editar mostraria os dados da despesa anterior.
  useEffect(() => {
    if (aberto) {
      form.reset(valoresIniciais(despesa));
      setArquivo(null);
      setErro(null);
    }
  }, [aberto, despesa, form]);

  const gravar = useMutation({
    mutationFn: async (campos: Campos) => {
      const id = despesa?.id ?? uuidv7();

      // O upload vem antes do insert porque o caminho vai gravado na despesa.
      // Se o upload falhar, nada foi escrito no banco - melhor que uma despesa
      // apontando para um arquivo que nao existe.
      let comprovante = despesa?.comprovante_path ?? null;
      if (arquivo) {
        comprovante = await subirComprovante(pilotoId, id, arquivo);
      }

      await salvarDespesa({
        id,
        categoria_id: campos.categoriaId,
        valor: parseValorDigitado(campos.valor) ?? 0,
        data_hora: new Date(campos.dataHora).toISOString(),
        forma_pagamento: campos.formaPagamento,
        status: campos.status,
        descricao: campos.descricao?.trim() || null,
        viagem_id: campos.viagemId === SEM_VINCULO ? null : campos.viagemId,
        veiculo_id: campos.veiculoId === SEM_VINCULO ? null : campos.veiculoId,
        comprovante_path: comprovante,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chavesDespesa.todas });
      aoFechar();
    },
    onError: (e: unknown) => setErro(e instanceof Error ? e.message : String(e)),
  });

  const agrupadas = useMemo(() => agruparCategorias(categorias.data ?? []), [categorias.data]);
  const valorDigitado = form.watch('valor');
  const previa = parseValorDigitado(valorDigitado ?? '');

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{despesa ? 'Editar despesa' : 'Nova despesa'}</DialogTitle>
          <DialogDescription>
            Deixe a viagem em branco para registrar um gasto fora de frete.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit((c) => gravar.mutate(c))}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              rotulo="Valor"
              erro={form.formState.errors.valor?.message}
              dica={previa !== null && previa > 0 ? formatarBRL(previa) : undefined}
            >
              <Input
                {...form.register('valor')}
                inputMode="decimal"
                placeholder="1.234,56"
                aria-invalid={!!form.formState.errors.valor}
              />
            </Campo>

            <Campo rotulo="Data e hora" erro={form.formState.errors.dataHora?.message}>
              <Input
                {...form.register('dataHora')}
                type="datetime-local"
                aria-invalid={!!form.formState.errors.dataHora}
              />
            </Campo>
          </div>

          <Campo rotulo="Categoria" erro={form.formState.errors.categoriaId?.message}>
            <Controller
              control={form.control}
              name="categoriaId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-invalid={!!form.formState.errors.categoriaId}>
                    <SelectValue placeholder="Escolha a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {agrupadas.map((grupo) => (
                      <SelectGroup key={grupo.id}>
                        <SelectLabel>
                          {grupo.nome} · {ROTULOS.escopoCategoria[grupo.escopo]}
                        </SelectLabel>
                        <SelectItem value={grupo.id}>{grupo.nome} (geral)</SelectItem>
                        {grupo.filhas.map((filha) => (
                          <SelectItem key={filha.id} value={filha.id}>
                            {filha.nome}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Forma de pagamento">
              <Controller
                control={form.control}
                name="formaPagamento"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMA_PAGAMENTO.map((f) => (
                        <SelectItem key={f} value={f}>
                          {ROTULOS.formaPagamento[f]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Campo>

            <Campo rotulo="Situacao">
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_DESPESA.map((s) => (
                        <SelectItem key={s} value={s}>
                          {ROTULOS.statusDespesa[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Viagem" dica="Em branco = gasto fora de frete">
              <Controller
                control={form.control}
                name="viagemId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_VINCULO}>Sem viagem</SelectItem>
                      {(viagens.data ?? []).map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {descreverViagem(v.inicio_em, v.status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Campo>

            <Campo rotulo="Veiculo">
              <Controller
                control={form.control}
                name="veiculoId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_VINCULO}>Nenhum</SelectItem>
                      {(veiculos.data ?? []).map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {[v.marca, v.modelo].filter(Boolean).join(' ') || v.placa}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Campo>
          </div>

          <Campo rotulo="Descricao">
            <Input {...form.register('descricao')} placeholder="Diesel S10, 180 litros" />
          </Campo>

          <Campo rotulo="Comprovante" dica="JPG, PNG, WEBP ou PDF, ate 5 MB">
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
                  (despesa?.comprovante_path ? 'Comprovante ja anexado' : 'Nenhum arquivo')}
              </span>
              <input
                ref={inputArquivo}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              />
            </div>
          </Campo>

          {erro ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {erro}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" variant="accent" disabled={gravar.isPending}>
              {gravar.isPending ? <Spinner /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Campo({
  rotulo,
  erro,
  dica,
  children,
}: {
  rotulo: string;
  erro?: string;
  dica?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label>{rotulo}</Label>
      {children}
      {erro ? (
        <p className="text-sm text-destructive">{erro}</p>
      ) : dica ? (
        <p className="text-sm text-muted-foreground">{dica}</p>
      ) : null}
    </div>
  );
}

function valoresIniciais(despesa?: DespesaDaLista): Campos {
  return {
    valor: despesa ? String(despesa.valor).replace('.', ',') : '',
    dataHora: paraInputLocal(despesa?.data_hora ?? new Date().toISOString()),
    categoriaId: despesa?.categoria_id ?? '',
    formaPagamento: (despesa?.forma_pagamento ?? 'PIX') as FormaPagamento,
    status: (despesa?.status ?? 'CONFIRMADA') as StatusDespesa,
    descricao: despesa?.descricao ?? '',
    viagemId: despesa?.viagem_id ?? SEM_VINCULO,
    veiculoId: despesa?.veiculo_id ?? SEM_VINCULO,
  };
}

/**
 * ISO -> "AAAA-MM-DDTHH:mm" no fuso do navegador.
 *
 * `toISOString().slice(0,16)` seria mais curto e estaria errado: devolve UTC, e
 * um gasto das 21h em Brasilia apareceria como meia-noite do dia seguinte.
 */
function paraInputLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

interface Grupo {
  id: string;
  nome: string;
  escopo: 'VEICULO' | 'PESSOAL' | 'ADMIN';
  filhas: { id: string; nome: string }[];
}

/** Monta pai -> filhas para o select sair na mesma hierarquia do banco. */
function agruparCategorias(
  categorias: { id: string; nome: string; escopo: string; categoria_pai_id: string | null }[],
): Grupo[] {
  const pais = categorias.filter((c) => c.categoria_pai_id === null);
  return pais.map((pai) => ({
    id: pai.id,
    nome: pai.nome,
    escopo: pai.escopo as Grupo['escopo'],
    filhas: categorias
      .filter((c) => c.categoria_pai_id === pai.id)
      .map((c) => ({ id: c.id, nome: c.nome })),
  }));
}

function descreverViagem(inicioEm: string | null, status: string): string {
  const quando = inicioEm
    ? new Date(inicioEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    : 'sem data';
  return `${quando} · ${status.toLowerCase().replace('_', ' ')}`;
}
