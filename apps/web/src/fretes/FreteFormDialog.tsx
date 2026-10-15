import { zodResolver } from '@hookform/resolvers/zod';
import { ROTULOS, formatarBRL, parseValorDigitado, uuidv7, type StatusFrete } from '@carga-certa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { chavesContratantes, listarContratantes } from '@/contratantes/api';
import { chavesDespesa } from '@/despesas/api';
import { chavesFretes, salvarFrete, type FreteDaLista } from '@/fretes/api';
import {
  SITUACOES_FRETE,
  esquemaFrete,
  paraRegistros,
  type CamposFrete,
  type SituacaoFrete,
} from '@/fretes/esquema';
import { CamposDoConjunto } from '@/veiculos/CamposDoConjunto';
import { BuscasDaRota, MapaDaRota } from '@/viagens/CamposDaRota';
import { SEM_VINCULO, diaLocal } from '@/viagens/esquema';
import { lugaresDa, rotaGravadaDa, useRotaDoFormulario } from '@/viagens/useRotaDoFormulario';

/**
 * Cadastro e edicao de frete. No web, o frete e a viagem dele sao um
 * formulario so; as partes da viagem (busca, mapa, rota, conjunto) sao as
 * mesmas da tela de Viagens.
 */
export function FreteFormDialog({
  aberto,
  aoFechar,
  frete,
}: {
  aberto: boolean;
  aoFechar: () => void;
  /** Ausente = criando. */
  frete?: FreteDaLista;
}) {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  // Remonta os campos de busca a cada abertura, para nao sobrar texto antigo.
  const [abertura, setAbertura] = useState(0);

  const contratantes = useQuery({ queryKey: chavesContratantes.lista, queryFn: listarContratantes });

  const form = useForm<CamposFrete>({
    resolver: zodResolver(esquemaFrete),
    defaultValues: valoresIniciais(frete),
  });

  const origem = form.watch('origem');
  const destino = form.watch('destino');
  const gravada = useMemo(() => rotaGravadaDa(frete?.viagem), [frete]);
  const rota = useRotaDoFormulario({
    ativo: aberto,
    origem,
    destino,
    gravada,
    definir: (qual, lugar) => form.setValue(qual, lugar, { shouldValidate: form.formState.isSubmitted }),
  });

  const { setMarcando } = rota;
  useEffect(() => {
    if (aberto) {
      form.reset(valoresIniciais(frete));
      setErro(null);
      setMarcando(frete?.viagem ? 'destino' : 'origem');
      setAbertura((n) => n + 1);
    }
  }, [aberto, frete, form, setMarcando]);

  const gravar = useMutation({
    mutationFn: async (campos: CamposFrete) => {
      const ids = { frete: frete?.id ?? uuidv7(), viagem: frete?.viagem?.id ?? uuidv7() };
      const original = frete?.viagem
        ? {
            situacao: situacaoDe(frete.status),
            statusViagem: frete.viagem.status,
            inicioEm: frete.viagem.inicio_em,
            fimEm: frete.viagem.fim_em,
          }
        : undefined;
      const { frete: registroFrete, viagem } = paraRegistros(campos, rota.rota, ids, original);
      await salvarFrete(registroFrete, viagem);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: chavesFretes.todos }),
        queryClient.invalidateQueries({ queryKey: ['painel'] }),
        // A viagem nova passa a aparecer no formulario de despesa.
        queryClient.invalidateQueries({ queryKey: chavesDespesa.viagens }),
      ]);
      aoFechar();
    },
    onError: (e: unknown) => setErro(e instanceof Error ? e.message : String(e)),
  });

  const erros = form.formState.errors;
  const valorDigitado = parseValorDigitado(form.watch('valor') ?? '');
  const validarSeJaEnviou = { shouldValidate: form.formState.isSubmitted };

  const contratanteAtual = frete?.contratante;
  const opcoesContratante = [
    ...(contratantes.data ?? []),
    // Contratante excluido depois do frete: continua aparecendo, marcado.
    ...(contratanteAtual && !(contratantes.data ?? []).some((c) => c.id === contratanteAtual.id)
      ? [{ id: contratanteAtual.id, nome: `${contratanteAtual.nome} (excluído)` }]
      : []),
  ];

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !gravar.isPending && aoFechar()}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{frete ? 'Editar frete' : 'Novo frete'}</DialogTitle>
          <DialogDescription>
            Busque o início e o fim, ou clique no mapa. A rota de caminhão e os km são calculados
            sozinhos.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit((c) => gravar.mutate(c))}
          noValidate
          className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
        >
          <div className="flex min-w-0 flex-col gap-4">
            <BuscasDaRota
              abertura={abertura}
              origem={origem}
              destino={destino}
              aoMudar={(qual, lugar) => form.setValue(qual, lugar, validarSeJaEnviou)}
              erros={{ origem: erros.origem?.message, destino: erros.destino?.message }}
            />

            <CamposDoConjunto
              tracao={form.watch('veiculoTracaoId')}
              reboque={form.watch('veiculoReboqueId')}
              aoMudarTracao={(id) => form.setValue('veiculoTracaoId', id, validarSeJaEnviou)}
              aoMudarReboque={(id) => form.setValue('veiculoReboqueId', id)}
              erroTracao={erros.veiculoTracaoId?.message}
            />

            <Campo rotulo="Contratante">
              <Controller
                control={form.control}
                name="contratanteId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_VINCULO}>Sem contratante</SelectItem>
                      {opcoesContratante.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Campo>

            <div className="grid gap-4 sm:grid-cols-3">
              <Campo
                rotulo="Valor combinado"
                erro={erros.valor?.message}
                dica={valorDigitado !== null && valorDigitado > 0 ? formatarBRL(valorDigitado) : undefined}
              >
                <Input
                  {...form.register('valor')}
                  inputMode="decimal"
                  placeholder="12.800,00"
                  aria-invalid={!!erros.valor}
                />
              </Campo>
              <Campo rotulo="Início" erro={erros.inicio?.message}>
                <Input {...form.register('inicio')} type="date" aria-invalid={!!erros.inicio} />
              </Campo>
              <Campo rotulo="Situação">
                <Controller
                  control={form.control}
                  name="situacao"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SITUACOES_FRETE.map((s) => (
                          <SelectItem key={s} value={s}>
                            {ROTULOS.statusFrete[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Campo>
            </div>
          </div>

          <MapaDaRota rota={rota} origem={origem} destino={destino} oQue="o frete" />

          {erro ? (
            <p role="alert" className="text-sm font-medium text-destructive lg:col-span-2">
              {erro}
            </p>
          ) : null}

          <DialogFooter className="lg:col-span-2">
            <Button type="button" variant="ghost" onClick={aoFechar} disabled={gravar.isPending}>
              Cancelar
            </Button>
            {/* Com a rota no meio do calculo, salvar agora gravaria o frete sem ela. */}
            <Button type="submit" variant="accent" disabled={gravar.isPending || rota.calculando}>
              {gravar.isPending ? <Spinner /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function situacaoDe(status: StatusFrete): SituacaoFrete {
  return status === 'RASCUNHO' ? 'CONTRATADO' : status;
}

function valoresIniciais(frete?: FreteDaLista): CamposFrete {
  const v = frete?.viagem;
  return {
    ...lugaresDa(v),
    veiculoTracaoId: v?.veiculo_tracao_id ?? '',
    veiculoReboqueId: v?.veiculo_reboque_id ?? SEM_VINCULO,
    contratanteId: frete?.contratante_id ?? SEM_VINCULO,
    valor: frete
      ? frete.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '',
    inicio: diaLocal(v?.inicio_em ?? new Date().toISOString()),
    situacao: frete ? situacaoDe(frete.status) : 'CONTRATADO',
  };
}
