import { zodResolver } from '@hookform/resolvers/zod';
import {
  ROTULOS,
  decodificarPolyline,
  formatarBRL,
  formatarDuracao,
  formatarKm,
  formatarPlaca,
  parseValorDigitado,
  uuidv7,
  type Ponto,
  type StatusFrete,
} from '@carga-certa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Route } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

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
import { BuscaLugar } from '@/fretes/BuscaLugar';
import { chavesFretes, salvarFrete, type FreteDaLista } from '@/fretes/api';
import {
  SEM_VINCULO,
  SITUACOES_FRETE,
  diaLocal,
  esquemaFrete,
  paraRegistros,
  type CamposFrete,
  type LugarDoFrete,
  type SituacaoFrete,
} from '@/fretes/esquema';
import { MapaFrete } from '@/fretes/MapaFrete';
import { CORES_DO_MAPA } from '@/lib/mapa';
import { calcularRota, lugarDoPonto, type Coordenada } from '@/lib/rotas';
import { cn } from '@/lib/utils';
import { chavesVeiculos, listarVeiculos } from '@/veiculos/api';

type Qual = 'origem' | 'destino';

interface RotaNaTela {
  pontos: Ponto[];
  polyline: string;
  distanciaKm: number;
  duracaoMin: number | null;
}

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
  const [marcando, setMarcando] = useState<Qual>('origem');
  // Remonta os campos de busca a cada abertura, para nao sobrar texto antigo.
  const [abertura, setAbertura] = useState(0);

  const veiculos = useQuery({ queryKey: chavesVeiculos.lista, queryFn: listarVeiculos });
  const contratantes = useQuery({ queryKey: chavesContratantes.lista, queryFn: listarContratantes });

  const form = useForm<CamposFrete>({
    resolver: zodResolver(esquemaFrete),
    defaultValues: valoresIniciais(frete),
  });

  useEffect(() => {
    if (aberto) {
      form.reset(valoresIniciais(frete));
      setErro(null);
      setMarcando(frete?.viagem ? 'destino' : 'origem');
      setAbertura((n) => n + 1);
    }
  }, [aberto, frete, form]);

  const origem = form.watch('origem');
  const destino = form.watch('destino');

  // A rota ja gravada vale enquanto os pontos forem os mesmos: abrir para
  // corrigir o valor nao gasta uma consulta ao servico de rotas.
  const rotaGravada = useMemo(() => rotaDoFrete(frete), [frete]);
  // Frete salvo sem rota (o calculo tinha falhado) recalcula ao abrir.
  const pontosDaRotaGravada = Boolean(
    rotaGravada?.rota &&
      origem &&
      destino &&
      mesmoPonto(origem, rotaGravada.origem) &&
      mesmoPonto(destino, rotaGravada.destino),
  );

  const calculo = useQuery({
    queryKey: ['rotas', 'rota', origem?.lat, origem?.lng, destino?.lat, destino?.lng],
    queryFn: () => calcularRota(origem as Coordenada, destino as Coordenada),
    enabled: aberto && origem !== null && destino !== null && !pontosDaRotaGravada,
    staleTime: Infinity,
    retry: false,
  });

  const rota: RotaNaTela | null = pontosDaRotaGravada
    ? (rotaGravada?.rota ?? null)
    : calculo.data
      ? { ...calculo.data }
      : null;

  const marcar = async (qual: Qual, ponto: Coordenada) => {
    // Primeiro o ponto, com as coordenadas como nome; o nome de verdade chega
    // depois, sem segurar o desenho da rota.
    const provisorio: LugarDoFrete = { nome: `${ponto.lat.toFixed(5)}, ${ponto.lng.toFixed(5)}`, ...ponto };
    form.setValue(qual, provisorio, { shouldValidate: form.formState.isSubmitted });
    if (qual === 'origem' && !form.getValues('destino')) setMarcando('destino');
    try {
      const lugar = await lugarDoPonto(ponto);
      const atual = form.getValues(qual);
      // So troca o nome se o ponto ainda for o mesmo (o usuario pode ter
      // clicado de novo enquanto a busca do nome estava no ar).
      if (lugar && atual && mesmoPonto(atual, ponto)) {
        form.setValue(qual, { ...lugar, lat: ponto.lat, lng: ponto.lng });
      }
    } catch {
      // Sem nome, fica a coordenada. O frete salva do mesmo jeito.
    }
  };

  const gravar = useMutation({
    mutationFn: async (campos: CamposFrete) => {
      const ids = { frete: frete?.id ?? uuidv7(), viagem: frete?.viagem?.id ?? uuidv7() };
      const original = frete?.viagem
        ? { situacao: situacaoDe(frete.status), statusViagem: frete.viagem.status, inicioEm: frete.viagem.inicio_em }
        : undefined;
      const { frete: registroFrete, viagem } = paraRegistros(
        campos,
        rota ? { polyline: rota.polyline, distanciaKm: rota.distanciaKm } : null,
        ids,
        original,
      );
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

  // Veiculo inativo que ja esta no frete continua na lista, para a edicao nao
  // trocar o caminhao por baixo do usuario.
  const tracaoAtual = form.watch('veiculoTracaoId');
  const reboqueAtual = form.watch('veiculoReboqueId');
  const tracoes = (veiculos.data ?? []).filter(
    (v) => v.natureza === 'TRACAO' && (v.ativo || v.id === tracaoAtual),
  );
  const reboques = (veiculos.data ?? []).filter(
    (v) => v.natureza === 'REBOQUE' && (v.ativo || v.id === reboqueAtual),
  );
  const descreverVeiculo = (v: (typeof tracoes)[number]) =>
    [formatarPlaca(v.placa), v.tipo?.nome, [v.marca, v.modelo].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(' · ');

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
            <Controller
              control={form.control}
              name="origem"
              render={({ field }) => (
                <BuscaLugar
                  key={`origem-${abertura}`}
                  rotulo="Início"
                  cor={CORES_DO_MAPA.inicio}
                  valor={field.value}
                  aoEscolher={(l) => field.onChange(l)}
                  perto={destino ?? undefined}
                  erro={erros.origem?.message}
                />
              )}
            />
            <Controller
              control={form.control}
              name="destino"
              render={({ field }) => (
                <BuscaLugar
                  key={`destino-${abertura}`}
                  rotulo="Fim"
                  cor={CORES_DO_MAPA.fim}
                  valor={field.value}
                  aoEscolher={(l) => field.onChange(l)}
                  perto={origem ?? undefined}
                  erro={erros.destino?.message}
                />
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Caminhão ou cavalo" erro={erros.veiculoTracaoId?.message}>
                <Controller
                  control={form.control}
                  name="veiculoTracaoId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-invalid={!!erros.veiculoTracaoId}>
                        <SelectValue placeholder={veiculos.isPending ? 'Carregando...' : 'Escolha'} />
                      </SelectTrigger>
                      <SelectContent>
                        {tracoes.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {descreverVeiculo(v)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Campo>
              <Campo rotulo="Carreta">
                <Controller
                  control={form.control}
                  name="veiculoReboqueId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SEM_VINCULO}>Sem carreta</SelectItem>
                        {reboques.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {descreverVeiculo(v)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Campo>
            </div>
            {veiculos.isSuccess && tracoes.length === 0 ? (
              <p className="-mt-2 text-sm text-muted-foreground">
                Nenhum caminhão ou cavalo cadastrado.{' '}
                <Link to="/veiculos" className="font-medium text-foreground underline underline-offset-4">
                  Cadastrar em Veículos
                </Link>
              </p>
            ) : null}

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

          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="O clique no mapa marca">
              <span className="text-muted-foreground">O clique no mapa marca:</span>
              {(['origem', 'destino'] as const).map((qual) => (
                <button
                  key={qual}
                  type="button"
                  aria-pressed={marcando === qual}
                  onClick={() => setMarcando(qual)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-colors',
                    marcando === qual ? 'border-foreground bg-secondary' : 'border-border text-muted-foreground',
                  )}
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: qual === 'origem' ? CORES_DO_MAPA.inicio : CORES_DO_MAPA.fim }}
                    aria-hidden
                  />
                  {qual === 'origem' ? 'Início' : 'Fim'}
                </button>
              ))}
            </div>

            <MapaFrete
              origem={origem}
              destino={destino}
              rota={rota?.pontos ?? null}
              posicao={null}
              aoClicar={(ponto) => void marcar(marcando, ponto)}
              aoArrastar={(qual, ponto) => void marcar(qual, ponto)}
              className="h-72 lg:h-auto lg:min-h-104 lg:flex-1"
            />

            <SituacaoDaRota
              temPontos={origem !== null && destino !== null}
              calculando={calculo.isFetching}
              erro={calculo.isError ? (calculo.error as Error).message : null}
              rota={rota}
            />
          </div>

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
            <Button type="submit" variant="accent" disabled={gravar.isPending || calculo.isFetching}>
              {gravar.isPending ? <Spinner /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SituacaoDaRota({
  temPontos,
  calculando,
  erro,
  rota,
}: {
  temPontos: boolean;
  calculando: boolean;
  erro: string | null;
  rota: RotaNaTela | null;
}) {
  if (!temPontos) {
    return <p className="text-sm text-muted-foreground">Marque o início e o fim para calcular a rota.</p>;
  }
  if (calculando) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Spinner /> Calculando a rota de caminhão...
      </p>
    );
  }
  if (erro) {
    return (
      <p className="flex items-start gap-2 text-sm text-warning-foreground dark:text-warning" role="alert">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {erro} Dá para salvar assim: o frete fica sem rota e sem km previstos, e o mapa mostra uma
          reta entre os pontos.
        </span>
      </p>
    );
  }
  if (!rota) return null;
  return (
    <p className="flex items-center gap-2 text-sm font-medium" role="status">
      <Route className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      {formatarKm(rota.distanciaKm)}
      {rota.duracaoMin !== null ? (
        <span className="font-normal text-muted-foreground">
          · cerca de {formatarDuracao(0, rota.duracaoMin * 60_000)} de estrada
        </span>
      ) : null}
    </p>
  );
}

function situacaoDe(status: StatusFrete): SituacaoFrete {
  return status === 'RASCUNHO' ? 'CONTRATADO' : status;
}

/** Mesmo ponto com a precisao que vai para o banco (numeric(9,6)). */
function mesmoPonto(a: Coordenada, b: Coordenada): boolean {
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
}

function rotaDoFrete(frete: FreteDaLista | undefined) {
  const v = frete?.viagem;
  if (!v || v.origem_lat === null || v.origem_lng === null || v.destino_lat === null || v.destino_lng === null) {
    return null;
  }
  let rota: RotaNaTela | null = null;
  if (v.rota_polyline && v.km_previsto !== null) {
    try {
      rota = {
        pontos: decodificarPolyline(v.rota_polyline),
        polyline: v.rota_polyline,
        distanciaKm: v.km_previsto,
        duracaoMin: null,
      };
    } catch {
      // Rota corrompida: sera recalculada se o usuario mexer num ponto.
    }
  }
  return {
    origem: { lat: v.origem_lat, lng: v.origem_lng },
    destino: { lat: v.destino_lat, lng: v.destino_lng },
    rota,
  };
}

function valoresIniciais(frete?: FreteDaLista): CamposFrete {
  const v = frete?.viagem;
  const lugar = (nome: string | null, lat: number | null, lng: number | null): LugarDoFrete | null =>
    lat !== null && lng !== null ? { nome: nome ?? `${lat}, ${lng}`, lat, lng } : null;
  return {
    origem: v ? lugar(v.origem_nome, v.origem_lat, v.origem_lng) : null,
    destino: v ? lugar(v.destino_nome, v.destino_lat, v.destino_lng) : null,
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
