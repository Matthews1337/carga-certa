import {
  ESCOPO_CATEGORIA,
  ROTULOS,
  STATUS_DESPESA,
  formatarBRL,
  resumirDespesas,
  type EscopoCategoria,
  type StatusDespesa,
} from '@carga-certa/shared';
import { useQuery } from '@tanstack/react-query';
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Carregando, ErroConsulta, Vazio } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { chavesDespesa, listarDespesas, type DespesaDaLista, type FiltrosDespesa } from '@/despesas/api';
import { DespesaFormDialog } from '@/despesas/DespesaFormDialog';
import { ExcluirDespesaDialog } from '@/despesas/ExcluirDespesaDialog';
import { BotaoComprovante } from '@/despesas/BotaoComprovante';

const TODOS = 'todos';

export function DespesasPage() {
  const [filtros, setFiltros] = useState<FiltrosDespesa>(() => ({ de: inicioDoMes() }));
  const [editando, setEditando] = useState<DespesaDaLista | undefined>();
  const [formAberto, setFormAberto] = useState(false);
  const [excluindo, setExcluindo] = useState<DespesaDaLista | null>(null);

  const despesas = useQuery({
    queryKey: chavesDespesa.lista(filtros),
    queryFn: () => listarDespesas(filtros),
  });

  const resumo = useMemo(
    () =>
      resumirDespesas(
        (despesas.data ?? []).map((d) => ({
          valor: d.valor,
          status: d.status,
          escopo: d.categoria?.escopo ?? 'ADMIN',
        })),
      ),
    [despesas.data],
  );

  const alterar = <K extends keyof FiltrosDespesa>(chave: K, valor: FiltrosDespesa[K]) =>
    setFiltros((f) => ({ ...f, [chave]: valor }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Despesas</h1>
          <p className="text-sm text-muted-foreground">
            Gastos do caminhao e do motorista, dentro e fora de frete.
          </p>
        </div>
        <Button
          variant="accent"
          onClick={() => {
            setEditando(undefined);
            setFormAberto(true);
          }}
        >
          <Plus className="size-4" aria-hidden />
          Nova despesa
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Totalizador rotulo="Total no periodo" valor={resumo.total} destaque />
        <Totalizador rotulo="Caminhao" valor={resumo.veiculo} />
        <Totalizador rotulo="Motorista" valor={resumo.pessoal} />
        <Totalizador rotulo="Administrativo" valor={resumo.admin} />
      </div>

      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
          <FiltroCampo rotulo="De">
            <Input
              type="date"
              value={filtros.de ?? ''}
              onChange={(e) => alterar('de', e.target.value || undefined)}
            />
          </FiltroCampo>

          <FiltroCampo rotulo="Ate">
            <Input
              type="date"
              value={filtros.ate ?? ''}
              onChange={(e) => alterar('ate', e.target.value || undefined)}
            />
          </FiltroCampo>

          <FiltroCampo rotulo="Escopo">
            <Select
              value={filtros.escopo ?? TODOS}
              onValueChange={(v) => alterar('escopo', v === TODOS ? undefined : (v as EscopoCategoria))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {ESCOPO_CATEGORIA.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ROTULOS.escopoCategoria[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FiltroCampo>

          <FiltroCampo rotulo="Vinculo">
            <Select
              value={filtros.vinculo ?? TODOS}
              onValueChange={(v) =>
                alterar('vinculo', v === TODOS ? undefined : (v as 'viagem' | 'avulsa'))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                <SelectItem value="viagem">Em viagem</SelectItem>
                <SelectItem value="avulsa">Fora de frete</SelectItem>
              </SelectContent>
            </Select>
          </FiltroCampo>

          <FiltroCampo rotulo="Situacao">
            <Select
              value={filtros.status ?? TODOS}
              onValueChange={(v) => alterar('status', v === TODOS ? undefined : (v as StatusDespesa))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas</SelectItem>
                {STATUS_DESPESA.map((s) => (
                  <SelectItem key={s} value={s}>
                    {ROTULOS.statusDespesa[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FiltroCampo>
        </CardContent>
      </Card>

      {despesas.isPending ? (
        <Carregando />
      ) : despesas.isError ? (
        <ErroConsulta erro={despesas.error} />
      ) : despesas.data.length === 0 ? (
        <Vazio
          titulo="Nenhuma despesa no periodo"
          descricao="Ajuste os filtros ou registre o primeiro gasto."
          acao={
            <Button
              variant="accent"
              onClick={() => {
                setEditando(undefined);
                setFormAberto(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
              Nova despesa
            </Button>
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descricao</TableHead>
                <TableHead>Vinculo</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-28 text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {despesas.data.map((d) => (
                <TableRow key={d.id} className={d.status === 'CANCELADA' ? 'opacity-50' : undefined}>
                  <TableCell className="tabular whitespace-nowrap">
                    {new Date(d.data_hora).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                    })}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="whitespace-nowrap">{d.categoria?.nome ?? '—'}</span>
                      {d.categoria ? (
                        <Badge variant={corDoEscopo(d.categoria.escopo)}>
                          {ROTULOS.escopoCategoria[d.categoria.escopo]}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell className="max-w-[18rem] truncate text-muted-foreground">
                    {d.descricao ?? '—'}
                  </TableCell>

                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {d.viagem_id ? 'Em viagem' : 'Fora de frete'}
                  </TableCell>

                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {ROTULOS.formaPagamento[d.forma_pagamento]}
                  </TableCell>

                  <TableCell className="tabular whitespace-nowrap text-right font-medium">
                    {formatarBRL(d.valor)}
                    {d.status !== 'CONFIRMADA' ? (
                      <Badge
                        variant={d.status === 'CANCELADA' ? 'destructive' : 'warning'}
                        className="ml-2"
                      >
                        {ROTULOS.statusDespesa[d.status]}
                      </Badge>
                    ) : null}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {d.comprovante_path ? (
                        <BotaoComprovante caminho={d.comprovante_path} />
                      ) : (
                        <span className="inline-flex size-9 items-center justify-center">
                          <FileText className="size-4 opacity-20" aria-label="Sem comprovante" />
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Editar despesa de ${formatarBRL(d.valor)}`}
                        onClick={() => {
                          setEditando(d);
                          setFormAberto(true);
                        }}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Excluir despesa de ${formatarBRL(d.valor)}`}
                        onClick={() => setExcluindo(d)}
                      >
                        <Trash2 className="size-4 text-destructive" aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>

            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="text-sm text-muted-foreground">
                  {despesas.data.length} lancamento{despesas.data.length === 1 ? '' : 's'}
                  {' · canceladas nao entram no total'}
                </TableCell>
                <TableCell className="tabular text-right text-base font-semibold">
                  {formatarBRL(resumo.total)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </Card>
      )}

      <DespesaFormDialog
        aberto={formAberto}
        aoFechar={() => setFormAberto(false)}
        despesa={editando}
      />

      <ExcluirDespesaDialog despesa={excluindo} aoFechar={() => setExcluindo(null)} />
    </div>
  );
}

function Totalizador({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: number;
  destaque?: boolean;
}) {
  return (
    <Card className={destaque ? 'border-accent/50 bg-accent/5' : undefined}>
      <CardContent className="p-4 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</p>
        <p className="tabular mt-1 text-2xl font-semibold">{formatarBRL(valor)}</p>
      </CardContent>
    </Card>
  );
}

function FiltroCampo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</Label>
      {children}
    </div>
  );
}

function corDoEscopo(escopo: EscopoCategoria) {
  if (escopo === 'VEICULO') return 'outline' as const;
  if (escopo === 'PESSOAL') return 'success' as const;
  return 'default' as const;
}

/** Periodo padrao: o mes corrente, que e o recorte natural de quem fecha conta. */
function inicioDoMes(): string {
  const hoje = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${hoje.getFullYear()}-${p(hoje.getMonth() + 1)}-01`;
}
