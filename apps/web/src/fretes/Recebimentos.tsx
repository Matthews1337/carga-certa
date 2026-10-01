import { zodResolver } from '@hookform/resolvers/zod';
import {
  FORMA_PAGAMENTO,
  ROTULOS,
  TIPO_RECEITA,
  formatarBRL,
  parseValorDigitado,
  uuidv7,
  type ResumoRecebimento,
} from '@carga-certa/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { ConfirmarExclusao } from '@/components/ui/confirmar-exclusao';
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
  chavesFretes,
  excluirRecebimento,
  salvarRecebimento,
  type FreteDaLista,
  type Recebimento,
} from '@/fretes/api';
import { diaLocal, meioDiaLocal } from '@/fretes/esquema';

/**
 * Recebimentos do frete: adiantamento, saldo, estadia... So se lancam aqui,
 * dentro do frete - todo recebimento pertence a um (decisao de 2026-09-29).
 *
 * E o que faz o "Entrou" do Painel sair do zero: ele conta pela data em que o
 * dinheiro caiu.
 */
export function Recebimentos({ frete, resumo }: { frete: FreteDaLista; resumo: ResumoRecebimento }) {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<Recebimento | 'novo' | null>(null);
  const [excluindo, setExcluindo] = useState<Recebimento | null>(null);

  const atualizar = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: chavesFretes.todos }),
      queryClient.invalidateQueries({ queryKey: ['painel'] }),
    ]);

  const ordenados = [...frete.recebimentos].sort((a, b) =>
    (b.recebido_em ?? '9999').localeCompare(a.recebido_em ?? '9999'),
  );

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Recebimentos</h3>
          <p className="text-sm text-muted-foreground">
            Caiu {formatarBRL(resumo.pagoDoFrete)} de {formatarBRL(frete.valor_total)}
            {/* Recebido com saldo menor que o combinado e desconto (quebra,
                avaria), nao divida: "falta" ao lado de "Recebido" se contradiz. */}
            {resumo.faltaReceber > 0
              ? resumo.situacao === 'RECEBIDO'
                ? ` · ${formatarBRL(resumo.faltaReceber)} abaixo do combinado`
                : ` · falta ${formatarBRL(resumo.faltaReceber)}`
              : ''}
            {resumo.recebido > resumo.pagoDoFrete
              ? ` · mais ${formatarBRL(resumo.recebido - resumo.pagoDoFrete)} de extras`
              : ''}
          </p>
        </div>
        {editando === null ? (
          <Button size="sm" variant="outline" onClick={() => setEditando('novo')}>
            <Plus className="size-4" aria-hidden />
            Registrar recebimento
          </Button>
        ) : null}
      </div>

      {editando !== null ? (
        <FormRecebimento
          key={editando === 'novo' ? 'novo' : editando.id}
          freteId={frete.id}
          recebimento={editando === 'novo' ? undefined : editando}
          resumo={resumo}
          aoTerminar={async (salvou) => {
            if (salvou) await atualizar();
            setEditando(null);
          }}
        />
      ) : null}

      {ordenados.length === 0 ? (
        editando === null ? (
          <p className="text-sm text-muted-foreground">Nenhum recebimento lançado.</p>
        ) : null
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {ordenados.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{ROTULOS.tipoReceita[r.tipo]}</p>
                <p className="text-xs text-muted-foreground">
                  {ROTULOS.formaPagamento[r.forma_recebimento]}
                  {r.recebido_em ? ` · caiu em ${new Date(r.recebido_em).toLocaleDateString('pt-BR')}` : ''}
                </p>
              </div>
              {r.recebido_em ? null : <Badge variant="warning">A receber</Badge>}
              <span className="tabular font-semibold">{formatarBRL(r.valor)}</span>
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Editar ${ROTULOS.tipoReceita[r.tipo]} de ${formatarBRL(r.valor)}`}
                  onClick={() => setEditando(r)}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Excluir ${ROTULOS.tipoReceita[r.tipo]} de ${formatarBRL(r.valor)}`}
                  onClick={() => setExcluindo(r)}
                >
                  <Trash2 className="size-4 text-destructive" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmarExclusao
        aberto={excluindo !== null}
        titulo="Excluir recebimento"
        descricao={
          excluindo
            ? `${ROTULOS.tipoReceita[excluindo.tipo]} de ${formatarBRL(excluindo.valor)} sai do frete e do Painel.`
            : ''
        }
        aoConfirmar={async () => {
          if (!excluindo) return;
          await excluirRecebimento(excluindo.id);
          await atualizar();
        }}
        aoFechar={() => setExcluindo(null)}
      />
    </section>
  );
}

const esquema = z.object({
  tipo: z.enum(TIPO_RECEITA),
  valor: z.string().refine((v) => (parseValorDigitado(v) ?? 0) > 0, 'Informe o valor'),
  forma: z.enum(FORMA_PAGAMENTO),
  /** 'AAAA-MM-DD'; vazio = lancado, mas ainda nao caiu. */
  recebidoEm: z.string(),
});
type Campos = z.infer<typeof esquema>;

function FormRecebimento({
  freteId,
  recebimento,
  resumo,
  aoTerminar,
}: {
  freteId: string;
  recebimento?: Recebimento;
  resumo: ResumoRecebimento;
  aoTerminar: (salvou: boolean) => void | Promise<void>;
}) {
  const [erro, setErro] = useState<string | null>(null);

  const form = useForm<Campos>({
    resolver: zodResolver(esquema),
    defaultValues: recebimento
      ? {
          tipo: recebimento.tipo,
          valor: paraCampo(recebimento.valor),
          forma: recebimento.forma_recebimento,
          recebidoEm: recebimento.recebido_em ? diaLocal(recebimento.recebido_em) : '',
        }
      : {
          // O primeiro dinheiro do frete costuma ser o adiantamento; o que vem
          // depois, o saldo - que e o que deixa o card verde.
          tipo: resumo.pagoDoFrete === 0 ? 'ADIANTAMENTO' : 'SALDO',
          valor: resumo.faltaReceber > 0 ? paraCampo(resumo.faltaReceber) : '',
          forma: 'PIX',
          recebidoEm: diaLocal(new Date().toISOString()),
        },
  });

  const gravar = useMutation({
    mutationFn: async (c: Campos) => {
      const original = recebimento?.recebido_em ?? null;
      await salvarRecebimento({
        id: recebimento?.id ?? uuidv7(),
        frete_id: freteId,
        tipo: c.tipo,
        valor: parseValorDigitado(c.valor) ?? 0,
        forma_recebimento: c.forma,
        // Mesmo dia de antes: mantem o instante gravado. Dia novo: meio-dia
        // local, que nao muda de mes em fuso nenhum do Brasil.
        recebido_em:
          c.recebidoEm === '' ? null : original && diaLocal(original) === c.recebidoEm ? original : meioDiaLocal(c.recebidoEm),
        observacao: recebimento?.observacao ?? null,
      });
    },
    onSuccess: () => aoTerminar(true),
    onError: (e: unknown) => setErro(e instanceof Error ? e.message : String(e)),
  });

  const erros = form.formState.errors;
  const previa = parseValorDigitado(form.watch('valor') ?? '');

  return (
    <form
      onSubmit={form.handleSubmit((c) => gravar.mutate(c))}
      noValidate
      className="flex flex-col gap-3 rounded-lg border border-accent/50 bg-accent/5 p-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Tipo">
          <Controller
            control={form.control}
            name="tipo"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_RECEITA.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ROTULOS.tipoReceita[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Campo>
        <Campo
          rotulo="Valor"
          erro={erros.valor?.message}
          dica={previa !== null && previa > 0 ? formatarBRL(previa) : undefined}
        >
          <Input {...form.register('valor')} inputMode="decimal" aria-invalid={!!erros.valor} />
        </Campo>
        <Campo rotulo="Forma">
          <Controller
            control={form.control}
            name="forma"
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
        <Campo rotulo="Caiu em" dica="Em branco se ainda não caiu">
          <Input {...form.register('recebidoEm')} type="date" />
        </Campo>
      </div>

      {erro ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {erro}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => void aoTerminar(false)} disabled={gravar.isPending}>
          Cancelar
        </Button>
        <Button type="submit" variant="accent" size="sm" disabled={gravar.isPending}>
          {gravar.isPending ? <Spinner /> : null}
          Salvar recebimento
        </Button>
      </div>
    </form>
  );
}

/** 1500 -> "1.500,00", o que o usuario digitaria. */
function paraCampo(valor: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
