import { zodResolver } from '@hookform/resolvers/zod';
import { ROTULOS, STATUS_VIAGEM, uuidv7 } from '@carga-certa/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { chavesDespesa } from '@/despesas/api';
import { CamposDoConjunto } from '@/veiculos/CamposDoConjunto';
import { apagarViagem, chavesViagens, salvarViagem, type ViagemDaLista } from '@/viagens/api';
import { cidadeDoLugar, fraseDasDespesas } from '@/viagens/apresentacao';
import { BotaoApagar } from '@/viagens/BotaoApagar';
import { BuscasDaRota, MapaDaRota } from '@/viagens/CamposDaRota';
import { useDespesasDaViagem } from '@/viagens/DetalheDaViagem';
import {
  SEM_VINCULO,
  diaLocal,
  esquemaViagem,
  paraRegistroViagem,
  type CamposViagem,
} from '@/viagens/esquema';
import { lugaresDa, rotaGravadaDa, useRotaDoFormulario } from '@/viagens/useRotaDoFormulario';

/**
 * Cadastro e edicao de viagem sem frete. O formulario do frete sem a parte de
 * pagamento: inicio, fim, conjunto, data e situacao.
 */
export function ViagemFormDialog({
  aberto,
  aoFechar,
  viagem,
}: {
  aberto: boolean;
  aoFechar: () => void;
  /** Ausente = criando. */
  viagem?: ViagemDaLista;
}) {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  // Remonta os campos de busca a cada abertura, para nao sobrar texto antigo.
  const [abertura, setAbertura] = useState(0);

  const form = useForm<CamposViagem>({
    resolver: zodResolver(esquemaViagem),
    defaultValues: valoresIniciais(viagem),
  });

  const origem = form.watch('origem');
  const destino = form.watch('destino');
  const gravada = useMemo(() => rotaGravadaDa(viagem), [viagem]);
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
      form.reset(valoresIniciais(viagem));
      setErro(null);
      setMarcando(viagem ? 'destino' : 'origem');
      setAbertura((n) => n + 1);
    }
  }, [aberto, viagem, form, setMarcando]);

  const gravar = useMutation({
    mutationFn: (campos: CamposViagem) =>
      salvarViagem(paraRegistroViagem(campos, rota.rota, viagem?.id ?? uuidv7(), viagem)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: chavesViagens.todos }),
        queryClient.invalidateQueries({ queryKey: ['painel'] }),
        // A viagem nova passa a aparecer no formulario de despesa.
        queryClient.invalidateQueries({ queryKey: chavesDespesa.viagens }),
      ]);
      aoFechar();
    },
    onError: (e: unknown) => setErro(e instanceof Error ? e.message : String(e)),
  });

  // So para dizer na confirmacao quantas despesas ficam; o detalhe ja as buscou.
  const despesas = useDespesasDaViagem(viagem?.id ?? null).consulta.data;

  const apagar = async () => {
    if (!viagem) return;
    await apagarViagem(viagem.id);
    await Promise.all(
      // Despesas: as da viagem passam a "sem viagem" na lista e no menu.
      [chavesViagens.todos, ['painel'], chavesDespesa.todas, chavesDespesa.viagens].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
    aoFechar();
  };

  const erros = form.formState.errors;
  const validarSeJaEnviou = { shouldValidate: form.formState.isSubmitted };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !gravar.isPending && aoFechar()}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{viagem ? 'Editar viagem' : 'Nova viagem'}</DialogTitle>
          <DialogDescription>
            Viagem sem frete. Busque o início e o fim, ou clique no mapa: a rota de caminhão e os km
            são calculados sozinhos.
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

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Início" erro={erros.inicio?.message}>
                <Input {...form.register('inicio')} type="date" aria-invalid={!!erros.inicio} />
              </Campo>
              <Campo rotulo="Situação">
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_VIAGEM.map((s) => (
                          <SelectItem key={s} value={s}>
                            {ROTULOS.statusViagem[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Campo>
            </div>
          </div>

          <MapaDaRota rota={rota} origem={origem} destino={destino} oQue="a viagem" />

          {erro ? (
            <p role="alert" className="text-sm font-medium text-destructive lg:col-span-2">
              {erro}
            </p>
          ) : null}

          <DialogFooter className="lg:col-span-2">
            {viagem ? (
              <BotaoApagar
                rotulo="Apagar viagem"
                desabilitado={gravar.isPending}
                aoApagar={apagar}
                descricao={
                  <>
                    A viagem {cidadeDoLugar(viagem.origem_nome)} → {cidadeDoLugar(viagem.destino_nome)} sai de
                    Viagens e do Painel. {fraseDasDespesas(despesas?.length)}
                  </>
                }
              />
            ) : null}
            <Button type="button" variant="ghost" onClick={aoFechar} disabled={gravar.isPending}>
              Cancelar
            </Button>
            {/* Com a rota no meio do calculo, salvar agora gravaria a viagem sem ela. */}
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

function valoresIniciais(viagem?: ViagemDaLista): CamposViagem {
  return {
    ...lugaresDa(viagem),
    veiculoTracaoId: viagem?.veiculo_tracao_id ?? '',
    veiculoReboqueId: viagem?.veiculo_reboque_id ?? SEM_VINCULO,
    inicio: diaLocal(viagem?.inicio_em ?? new Date().toISOString()),
    status: viagem?.status ?? 'PLANEJADA',
  };
}
