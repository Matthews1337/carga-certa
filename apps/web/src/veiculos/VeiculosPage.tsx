import {
  NATUREZA_VEICULO,
  ROTULOS,
  formatarKm,
  formatarPeso,
  formatarPlaca,
  type NaturezaVeiculo,
  type SituacaoVencimento,
} from '@carga-certa/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CircleCheck,
  FileText,
  OctagonAlert,
  Pencil,
  Plus,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { ConfirmarExclusao } from '@/components/ui/confirmar-exclusao';
import { Carregando, ErroConsulta, Vazio } from '@/components/ui/feedback';
import { cn } from '@/lib/utils';
import {
  chavesVeiculos,
  excluirVeiculo,
  listarVeiculos,
  type DocumentoResumo,
  type VeiculoDaLista,
} from '@/veiculos/api';
import { DocumentosDialog } from '@/veiculos/DocumentosDialog';
import { VeiculoFormDialog } from '@/veiculos/VeiculoFormDialog';
import { avisoDeVencimento } from '@/veiculos/vencimentos';

const TITULO_DO_GRUPO: Record<NaturezaVeiculo, string> = {
  TRACAO: 'Tração',
  REBOQUE: 'Reboques',
};

export function VeiculosPage() {
  const queryClient = useQueryClient();
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<VeiculoDaLista | undefined>();
  const [documentosDe, setDocumentosDe] = useState<VeiculoDaLista | null>(null);
  const [excluindo, setExcluindo] = useState<VeiculoDaLista | null>(null);

  const veiculos = useQuery({ queryKey: chavesVeiculos.lista, queryFn: listarVeiculos });

  // A consulta ja vem em uso primeiro e por placa; o filtro preserva essa ordem.
  const grupos = useMemo(
    () =>
      NATUREZA_VEICULO.map((natureza) => ({
        natureza,
        veiculos: (veiculos.data ?? []).filter((v) => v.natureza === natureza),
      })).filter((g) => g.veiculos.length > 0),
    [veiculos.data],
  );

  const novo = () => {
    setEditando(undefined);
    setFormAberto(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Veículos</h1>
          <p className="text-sm text-muted-foreground">
            Caminhões, cavalos e carretas, com os documentos de cada um.
          </p>
        </div>
        <Button variant="accent" onClick={novo}>
          <Plus className="size-4" aria-hidden />
          Novo veículo
        </Button>
      </header>

      {veiculos.isPending ? (
        <Carregando />
      ) : veiculos.isError ? (
        <ErroConsulta erro={veiculos.error} />
      ) : veiculos.data.length === 0 ? (
        <Vazio
          titulo="Nenhum veículo cadastrado"
          descricao="Comece pelo caminhão ou pelo cavalo mecânico: todo frete precisa de um veículo de tração."
          acao={
            <Button variant="accent" onClick={novo}>
              <Plus className="size-4" aria-hidden />
              Novo veículo
            </Button>
          }
        />
      ) : (
        grupos.map((grupo) => (
          <section key={grupo.natureza} className="flex flex-col gap-3">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {TITULO_DO_GRUPO[grupo.natureza]} · {grupo.veiculos.length}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {grupo.veiculos.map((v) => (
                <CartaoVeiculo
                  key={v.id}
                  veiculo={v}
                  aoAbrirDocumentos={() => setDocumentosDe(v)}
                  aoEditar={() => {
                    setEditando(v);
                    setFormAberto(true);
                  }}
                  aoExcluir={() => setExcluindo(v)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <VeiculoFormDialog
        aberto={formAberto}
        aoFechar={() => setFormAberto(false)}
        veiculo={editando}
      />

      <DocumentosDialog veiculo={documentosDe} aoFechar={() => setDocumentosDe(null)} />

      <ConfirmarExclusao
        aberto={excluindo !== null}
        titulo="Excluir veículo"
        descricao={
          excluindo
            ? `${formatarPlaca(excluindo.placa)} sai da lista, e viagens e despesas já lançadas ` +
              'continuam ligadas a ele. Se só parou de rodar, prefira editar e desmarcar "Em uso".'
            : ''
        }
        aoConfirmar={async () => {
          if (!excluindo) return;
          await excluirVeiculo(excluindo.id);
          await queryClient.invalidateQueries({ queryKey: chavesVeiculos.todos });
        }}
        aoFechar={() => setExcluindo(null)}
      />
    </div>
  );
}

function CartaoVeiculo({
  veiculo: v,
  aoAbrirDocumentos,
  aoEditar,
  aoExcluir,
}: {
  veiculo: VeiculoDaLista;
  aoAbrirDocumentos: () => void;
  aoEditar: () => void;
  aoExcluir: () => void;
}) {
  const placa = formatarPlaca(v.placa);
  const descricao = [[v.marca, v.modelo].filter(Boolean).join(' '), v.ano, v.cor]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card className={cn('flex flex-col', !v.ativo && 'opacity-70')}>
      <CardContent className="flex flex-1 flex-col gap-4 p-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="tabular font-mono text-xl font-semibold tracking-wider">{placa}</p>
            <p className="truncate text-sm text-muted-foreground">
              {descricao || 'Marca e modelo não informados'}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant="outline">{v.tipo?.nome ?? ROTULOS.naturezaVeiculo[v.natureza]}</Badge>
            {!v.ativo ? <Badge>Fora de uso</Badge> : null}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {v.carroceria !== 'NAO_APLICA' ? (
            <Dado rotulo="Carroceria" valor={ROTULOS.carroceriaVeiculo[v.carroceria]} />
          ) : null}
          <Dado rotulo="Eixos" valor={v.qtd_eixos != null ? String(v.qtd_eixos) : '—'} />
          <Dado rotulo="Capacidade" valor={formatarPeso(v.capacidade_kg)} />
          {v.natureza === 'TRACAO' ? (
            <Dado rotulo="Odômetro" valor={formatarKm(v.odometro_atual)} />
          ) : null}
        </dl>

        <AvisoDocumentos documentos={v.documentos} />
      </CardContent>

      <CardFooter className="gap-1 border-t border-border pt-3 pb-3">
        <Button
          variant="outline"
          size="sm"
          aria-label={`Documentos de ${placa}: ${v.documentos.length}`}
          onClick={aoAbrirDocumentos}
        >
          <FileText className="size-4" aria-hidden />
          Documentos
          <span className="tabular text-muted-foreground">{v.documentos.length}</span>
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" aria-label={`Editar ${placa}`} onClick={aoEditar}>
            <Pencil className="size-4" aria-hidden />
          </Button>
          <Button variant="ghost" size="sm" aria-label={`Excluir ${placa}`} onClick={aoExcluir}>
            <Trash2 className="size-4 text-destructive" aria-hidden />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="tabular truncate font-medium">{valor}</dd>
    </div>
  );
}

const ESTILO_DO_AVISO: Record<SituacaoVencimento, { icone: LucideIcon; cor: string }> = {
  VENCIDO: { icone: OctagonAlert, cor: 'text-destructive' },
  CRITICO: { icone: AlertTriangle, cor: 'text-warning-foreground dark:text-warning' },
  ATENCAO: { icone: AlertTriangle, cor: 'text-warning-foreground dark:text-warning' },
  OK: { icone: CircleCheck, cor: 'text-success' },
};

/** Uma linha: o documento mais urgente, com icone - a cor nunca vem sozinha. */
function AvisoDocumentos({ documentos }: { documentos: DocumentoResumo[] }) {
  if (documentos.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum documento cadastrado.</p>;
  }

  const aviso = avisoDeVencimento(documentos);
  if (!aviso) {
    return <p className="text-sm text-muted-foreground">Documentos sem data de validade.</p>;
  }

  const { icone: Icone, cor } = ESTILO_DO_AVISO[aviso.situacao];
  return (
    <p className={cn('flex items-center gap-1.5 text-sm font-medium', cor)}>
      <Icone className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">
        {aviso.texto}
        {aviso.outros > 0
          ? ` · mais ${aviso.outros} ${aviso.outros === 1 ? 'documento' : 'documentos'}`
          : null}
      </span>
    </p>
  );
}
