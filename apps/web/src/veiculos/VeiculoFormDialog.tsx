import { zodResolver } from '@hookform/resolvers/zod';
import {
  CARROCERIA_VEICULO,
  NATUREZA_VEICULO,
  ROTULOS,
  formatarPeso,
  formatarPlaca,
  type NaturezaVeiculo,
} from '@carga-certa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  chavesVeiculos,
  listarTiposVeiculo,
  salvarVeiculo,
  type VeiculoDaLista,
} from '@/veiculos/api';
import { esquemaVeiculo, paraRegistro, type CamposVeiculo } from '@/veiculos/esquema';

// "Tracao" e "Reboque" sao os termos do banco; o exemplo diz o que cai em cada um.
const GRUPO_DO_TIPO: Record<NaturezaVeiculo, string> = {
  TRACAO: 'Tração · caminhão ou cavalo mecânico',
  REBOQUE: 'Reboque · carreta, bitrem, dolly',
};

export function VeiculoFormDialog({
  aberto,
  aoFechar,
  veiculo,
}: {
  aberto: boolean;
  aoFechar: () => void;
  /** Ausente = criando. */
  veiculo?: VeiculoDaLista;
}) {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);

  const tipos = useQuery({ queryKey: chavesVeiculos.tipos, queryFn: listarTiposVeiculo });

  const form = useForm<CamposVeiculo>({
    resolver: zodResolver(esquemaVeiculo),
    defaultValues: valoresIniciais(veiculo),
  });

  // Mesmo motivo do formulario de despesa: o dialogo e reaproveitado entre
  // "novo" e "editar", e sem o reset mostraria o veiculo anterior.
  useEffect(() => {
    if (aberto) {
      form.reset(valoresIniciais(veiculo));
      setErro(null);
    }
  }, [aberto, veiculo, form]);

  const tipoEscolhido = tipos.data?.find((t) => t.id === form.watch('tipoVeiculoId'));
  const ehReboque = tipoEscolhido?.natureza === 'REBOQUE';

  const gravar = useMutation({
    mutationFn: async (campos: CamposVeiculo) => {
      const tipo = tipos.data?.find((t) => t.id === campos.tipoVeiculoId);
      if (!tipo) throw new Error('Escolha o tipo de veículo.');
      await salvarVeiculo(paraRegistro(campos, tipo.natureza), veiculo?.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chavesVeiculos.todos });
      aoFechar();
    },
    onError: (e: unknown) => setErro(e instanceof Error ? e.message : String(e)),
  });

  const erros = form.formState.errors;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{veiculo ? 'Editar veículo' : 'Novo veículo'}</DialogTitle>
          <DialogDescription>
            Cavalo e carreta entram separados, cada um com a sua placa.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit((c) => gravar.mutate(c))}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Tipo" erro={erros.tipoVeiculoId?.message}>
              <Controller
                control={form.control}
                name="tipoVeiculoId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(id) => {
                      field.onChange(id);
                      // Eixos e parte da definicao do tipo ("Cavalo trucado" tem
                      // 3); preenche se estiver vazio, sem apagar o que o
                      // usuario ja digitou.
                      const tipo = tipos.data?.find((t) => t.id === id);
                      if (tipo?.qtd_eixos && form.getValues('qtdEixos') === '') {
                        form.setValue('qtdEixos', String(tipo.qtd_eixos));
                      }
                    }}
                  >
                    <SelectTrigger aria-invalid={!!erros.tipoVeiculoId}>
                      <SelectValue placeholder={tipos.isPending ? 'Carregando...' : 'Escolha o tipo'} />
                    </SelectTrigger>
                    <SelectContent>
                      {NATUREZA_VEICULO.map((natureza) => (
                        <SelectGroup key={natureza}>
                          <SelectLabel>{GRUPO_DO_TIPO[natureza]}</SelectLabel>
                          {(tipos.data ?? [])
                            .filter((t) => t.natureza === natureza)
                            .map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.nome}
                              </SelectItem>
                            ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Campo>

            <Campo rotulo="Placa" erro={erros.placa?.message}>
              <Input
                {...form.register('placa')}
                className="uppercase"
                placeholder="ABC1D23"
                autoComplete="off"
                aria-invalid={!!erros.placa}
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Marca" erro={erros.marca?.message}>
              <Input {...form.register('marca')} placeholder="Scania" aria-invalid={!!erros.marca} />
            </Campo>
            <Campo rotulo="Modelo" erro={erros.modelo?.message}>
              <Input {...form.register('modelo')} placeholder="R 450" aria-invalid={!!erros.modelo} />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Ano" erro={erros.ano?.message}>
              <Input
                {...form.register('ano')}
                inputMode="numeric"
                placeholder="2021"
                aria-invalid={!!erros.ano}
              />
            </Campo>
            <Campo rotulo="Cor" erro={erros.cor?.message}>
              <Input {...form.register('cor')} placeholder="Branco" aria-invalid={!!erros.cor} />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Carroceria">
              <Controller
                control={form.control}
                name="carroceria"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CARROCERIA_VEICULO.map((c) => (
                        <SelectItem key={c} value={c}>
                          {ROTULOS.carroceriaVeiculo[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Campo>
            <Campo rotulo="Eixos" erro={erros.qtdEixos?.message}>
              <Input
                {...form.register('qtdEixos')}
                inputMode="numeric"
                aria-invalid={!!erros.qtdEixos}
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              rotulo="Capacidade (kg)"
              dica={
                tipoEscolhido?.capacidade_kg_ref
                  ? `Referência do tipo: ${formatarPeso(tipoEscolhido.capacidade_kg_ref)}`
                  : undefined
              }
            >
              <Input {...form.register('capacidadeKg')} inputMode="numeric" placeholder="33.000" />
            </Campo>

            {/* Reboque nao tem motor nem painel: o odometro dele e sempre zero. */}
            {!ehReboque ? (
              <Campo rotulo="Odômetro (km)" dica="O km que o painel marca hoje">
                <Input {...form.register('odometroAtual')} inputMode="numeric" placeholder="412.000" />
              </Campo>
            ) : null}
          </div>

          <Campo rotulo="RENAVAM" erro={erros.renavam?.message} dica="Opcional, 11 dígitos">
            <Input
              {...form.register('renavam')}
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={!!erros.renavam}
            />
          </Campo>

          {/* So na edicao: veiculo novo e sempre um veiculo em uso. */}
          {veiculo ? (
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                {...form.register('ativo')}
                className="mt-0.5 size-4 shrink-0 accent-accent"
              />
              <span className="text-sm">
                <span className="font-medium">Em uso</span>
                <span className="block text-muted-foreground">
                  Desmarque se vendeu ou parou de rodar. Ele sai da lista das despesas, e o que já
                  foi lançado continua ligado a ele.
                </span>
              </span>
            </label>
          ) : null}

          {erro ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {erro}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" variant="accent" disabled={gravar.isPending || tipos.isPending}>
              {gravar.isPending ? <Spinner /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Numero do banco para o campo de texto, no formato que o usuario digitaria. */
const inteiroParaCampo = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : Math.round(n).toLocaleString('pt-BR');

function valoresIniciais(veiculo?: VeiculoDaLista): CamposVeiculo {
  return {
    tipoVeiculoId: veiculo?.tipo_veiculo_id ?? '',
    placa: veiculo ? formatarPlaca(veiculo.placa) : '',
    renavam: veiculo?.renavam ?? '',
    marca: veiculo?.marca ?? '',
    modelo: veiculo?.modelo ?? '',
    ano: veiculo?.ano != null ? String(veiculo.ano) : '',
    cor: veiculo?.cor ?? '',
    carroceria: veiculo?.carroceria ?? 'NAO_APLICA',
    capacidadeKg: inteiroParaCampo(veiculo?.capacidade_kg),
    qtdEixos: veiculo?.qtd_eixos != null ? String(veiculo.qtd_eixos) : '',
    odometroAtual: veiculo?.natureza === 'TRACAO' ? inteiroParaCampo(veiculo.odometro_atual) : '',
    ativo: veiculo?.ativo ?? true,
  };
}
