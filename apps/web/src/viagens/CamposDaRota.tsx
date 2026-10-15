import { formatarDuracao, formatarKm } from '@carga-certa/shared';
import { AlertTriangle, Route } from 'lucide-react';

import { Spinner } from '@/components/ui/feedback';
import { CORES_DO_MAPA } from '@/lib/mapa';
import type { Lugar } from '@/lib/rotas';
import { cn } from '@/lib/utils';
import { BuscaLugar } from '@/viagens/BuscaLugar';
import { MapaViagem } from '@/viagens/MapaViagem';
import type { Qual, RotaDoFormulario, RotaNaTela } from '@/viagens/useRotaDoFormulario';

/**
 * Partes do formulario que marcam a rota, iguais no frete e na viagem: os dois
 * campos de busca (coluna da esquerda) e o mapa (coluna da direita).
 */

export function BuscasDaRota({
  abertura,
  origem,
  destino,
  aoMudar,
  erros,
}: {
  /** Muda a cada abertura do dialogo: remonta os campos, sem sobrar texto antigo. */
  abertura: number;
  origem: Lugar | null;
  destino: Lugar | null;
  aoMudar: (qual: Qual, lugar: Lugar | null) => void;
  erros: { origem?: string; destino?: string };
}) {
  return (
    <>
      <BuscaLugar
        key={`origem-${abertura}`}
        rotulo="Início"
        cor={CORES_DO_MAPA.inicio}
        valor={origem}
        aoEscolher={(l) => aoMudar('origem', l)}
        perto={destino ?? undefined}
        erro={erros.origem}
      />
      <BuscaLugar
        key={`destino-${abertura}`}
        rotulo="Fim"
        cor={CORES_DO_MAPA.fim}
        valor={destino}
        aoEscolher={(l) => aoMudar('destino', l)}
        perto={origem ?? undefined}
        erro={erros.destino}
      />
    </>
  );
}

export function MapaDaRota({
  rota: r,
  origem,
  destino,
  oQue,
}: {
  rota: RotaDoFormulario;
  origem: Lugar | null;
  destino: Lugar | null;
  /** "o frete", "a viagem": usado no aviso de rota que nao foi calculada. */
  oQue: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="O clique no mapa marca">
        <span className="text-muted-foreground">O clique no mapa marca:</span>
        {(['origem', 'destino'] as const).map((qual) => (
          <button
            key={qual}
            type="button"
            aria-pressed={r.marcando === qual}
            onClick={() => r.setMarcando(qual)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-colors',
              r.marcando === qual ? 'border-foreground bg-secondary' : 'border-border text-muted-foreground',
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

      <MapaViagem
        origem={origem}
        destino={destino}
        rota={r.rota?.pontos ?? null}
        posicao={null}
        aoClicar={(ponto) => void r.marcar(r.marcando, ponto)}
        aoArrastar={(qual, ponto) => void r.marcar(qual, ponto)}
        className="h-72 lg:h-auto lg:min-h-104 lg:flex-1"
      />

      <SituacaoDaRota
        temPontos={origem !== null && destino !== null}
        calculando={r.calculando}
        erro={r.erro}
        rota={r.rota}
        oQue={oQue}
      />
    </div>
  );
}

function SituacaoDaRota({
  temPontos,
  calculando,
  erro,
  rota,
  oQue,
}: {
  temPontos: boolean;
  calculando: boolean;
  erro: string | null;
  rota: RotaNaTela | null;
  oQue: string;
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
          {erro} Dá para salvar assim: {oQue} fica sem rota e sem km previstos, e o mapa mostra uma
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
