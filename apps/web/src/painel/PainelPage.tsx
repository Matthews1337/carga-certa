import {
  deslocarMes,
  ehMesValido,
  formatarBRL,
  formatarKm,
  mesAtual,
  rotuloDoMes,
  type ResumoMensal,
} from '@carga-certa/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Route,
  type LucideIcon,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Carregando, ErroConsulta } from '@/components/ui/feedback';
import { cn } from '@/lib/utils';
import { carregarResumoDoMes, chavesPainel } from '@/painel/api';

const plural = (n: number, singular: string, pluralizado: string) =>
  `${n} ${n === 1 ? singular : pluralizado}`;

export function PainelPage() {
  const [parametros, setParametros] = useSearchParams();

  // O mes mora na URL (?mes=2026-08): sobrevive ao F5 e da para mandar o link.
  // Valor torto na URL cai no mes atual em vez de quebrar a tela.
  const bruto = parametros.get('mes');
  const hoje = mesAtual();
  const mes = ehMesValido(bruto) ? bruto : hoje;
  const ehMesAtual = mes === hoje;

  const irPara = (novo: string) => setParametros({ mes: novo }, { replace: true });

  const resumo = useQuery({
    queryKey: chavesPainel.resumo(mes),
    queryFn: () => carregarResumoDoMes(mes),
    // Ao trocar de mes, os numeros anteriores ficam na tela ate os novos
    // chegarem. Sem isto, cada clique na seta faria a tela piscar vazia.
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
          <p className="text-sm text-muted-foreground">Resumo financeiro e de rodagem do mês.</p>
        </div>

        <nav className="flex items-center gap-1" aria-label="Escolher o mês">
          <Button
            variant="outline"
            size="icon"
            onClick={() => irPara(deslocarMes(mes, -1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="size-5" />
          </Button>

          <p className="min-w-44 text-center font-medium" aria-live="polite">
            {rotuloDoMes(mes)}
          </p>

          <Button
            variant="outline"
            size="icon"
            onClick={() => irPara(deslocarMes(mes, 1))}
            // Mes futuro so teria zeros; a seta para no mes atual.
            disabled={ehMesAtual || mes > hoje}
            aria-label="Próximo mês"
          >
            <ChevronRight className="size-5" />
          </Button>

          {!ehMesAtual ? (
            <Button variant="ghost" size="sm" onClick={() => irPara(hoje)} className="ml-1">
              Mês atual
            </Button>
          ) : null}
        </nav>
      </header>

      {resumo.isPending ? (
        <Carregando />
      ) : resumo.isError ? (
        <ErroConsulta erro={resumo.error} />
      ) : (
        <div
          className={cn(
            'grid gap-4 transition-opacity lg:grid-cols-3',
            resumo.isPlaceholderData && 'opacity-60',
          )}
          aria-busy={resumo.isPlaceholderData}
        >
          <CartaoResultado resumo={resumo.data} />
          <CartaoIndicador
            icone={Route}
            titulo="Viagens"
            valor={String(resumo.data.viagens.total)}
            detalhe={detalheViagens(resumo.data)}
          />
          <CartaoIndicador
            icone={Gauge}
            titulo="Km rodados"
            valor={formatarKm(resumo.data.km.total)}
            detalhe={detalheKm(resumo.data)}
            alerta={resumo.data.km.viagensSemKm > 0}
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Receitas contam pela data em que o dinheiro caiu; despesas, pela data do gasto, sem as
        canceladas. Viagens e km contam pela data de início da viagem.
      </p>
    </div>
  );
}

function CartaoResultado({ resumo }: { resumo: ResumoMensal }) {
  const { entrou, saiu, saldo } = resumo;
  return (
    <Card className="border-accent/50 bg-accent/5">
      <CardContent className="flex flex-col gap-4 p-5 pt-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Resultado do mês
          </p>
          <p
            className={cn(
              'tabular mt-1 text-3xl font-semibold',
              saldo > 0 && 'text-success',
              saldo < 0 && 'text-destructive',
            )}
          >
            {formatarBRL(saldo)}
          </p>
        </div>

        <dl className="grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <ArrowUpRight className="size-4 text-success" aria-hidden />
              Entrou
            </dt>
            <dd className="tabular font-medium">{formatarBRL(entrou)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <ArrowDownRight className="size-4 text-destructive" aria-hidden />
              Saiu
            </dt>
            <dd className="tabular font-medium">{formatarBRL(saiu)}</dd>
          </div>
        </dl>

        {entrou === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma receita recebida neste mês.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CartaoIndicador({
  icone: Icone,
  titulo,
  valor,
  detalhe,
  alerta,
}: {
  icone: LucideIcon;
  titulo: string;
  valor: string;
  detalhe: string;
  alerta?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-5 pt-5">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icone className="size-4" aria-hidden />
          {titulo}
        </p>
        <p className="tabular text-3xl font-semibold">{valor}</p>
        <p className={cn('text-sm', alerta ? 'text-warning-foreground' : 'text-muted-foreground')}>
          {detalhe}
        </p>
      </CardContent>
    </Card>
  );
}

function detalheViagens({ viagens }: ResumoMensal): string {
  if (viagens.total === 0) return 'Nenhuma viagem iniciada neste mês.';
  const partes = [];
  if (viagens.concluidas > 0) partes.push(plural(viagens.concluidas, 'concluída', 'concluídas'));
  if (viagens.emAberto > 0) partes.push(`${viagens.emAberto} em aberto`);
  return partes.join(' · ');
}

function detalheKm({ viagens, km }: ResumoMensal): string {
  if (viagens.total === 0) return 'Nenhuma viagem iniciada neste mês.';
  // A soma ignora quem ainda nao tem odometro final. Dizer quantas ficaram de
  // fora evita que o motorista leia um total menor como erro de conta.
  if (km.viagensSemKm > 0) {
    return `${plural(km.viagensSemKm, 'viagem', 'viagens')} sem odômetro final, fora da soma`;
  }
  return `em ${plural(km.viagensComKm, 'viagem', 'viagens')}`;
}
