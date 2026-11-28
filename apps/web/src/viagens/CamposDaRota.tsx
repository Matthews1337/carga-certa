import { descreverPrecisao, formatarDuracao, formatarKm, precisaoAceitavel } from '@carga-certa/shared';
import { AlertTriangle, LocateFixed, MousePointerClick, Route } from 'lucide-react';
import { useState } from 'react';

import { Spinner } from '@/components/ui/feedback';
import { CORES_DO_MAPA } from '@/lib/mapa';
import type { Coordenada, Lugar } from '@/lib/rotas';
import { BuscaLugar } from '@/viagens/BuscaLugar';
import { lerPosicao } from '@/viagens/gps';
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
  aoMarcarOrigem,
  erros,
}: {
  /** Muda a cada abertura do dialogo: remonta os campos, sem sobrar texto antigo. */
  abertura: number;
  origem: Lugar | null;
  destino: Lugar | null;
  aoMudar: (qual: Qual, lugar: Lugar | null) => void;
  /** Marca o inicio num ponto, como o clique no mapa (o nome vem depois). */
  aoMarcarOrigem: (ponto: Coordenada) => void;
  erros: { origem?: string; destino?: string };
}) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <BuscaLugar
          key={`origem-${abertura}`}
          rotulo="Início"
          cor={CORES_DO_MAPA.inicio}
          valor={origem}
          aoEscolher={(l) => aoMudar('origem', l)}
          perto={destino ?? undefined}
          erro={erros.origem}
        />
        <MinhaLocalizacao key={`gps-${abertura}`} aoLer={aoMarcarOrigem} />
      </div>
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

/**
 * "Usar minha localizacao": o inicio onde o aparelho esta agora. Posicao
 * aproximada (computador, iPhone sem Localizacao Precisa) marca do mesmo
 * jeito, com aviso: o pino e arrastavel, e a pessoa corrige no mapa.
 */
function MinhaLocalizacao({ aoLer }: { aoLer: (ponto: Coordenada) => void }) {
  const [estado, setEstado] = useState<
    { tipo: 'parado' } | { tipo: 'lendo' } | { tipo: 'aproximada'; precisaoM: number } | { tipo: 'erro'; mensagem: string }
  >({ tipo: 'parado' });

  const usar = async () => {
    setEstado({ tipo: 'lendo' });
    try {
      const leitura = await lerPosicao();
      aoLer({ lat: leitura.lat, lng: leitura.lng });
      setEstado(
        precisaoAceitavel(leitura.precisaoM)
          ? { tipo: 'parado' }
          : { tipo: 'aproximada', precisaoM: leitura.precisaoM },
      );
    } catch (erro) {
      setEstado({ tipo: 'erro', mensagem: (erro as Error).message });
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => void usar()}
        disabled={estado.tipo === 'lendo'}
        className="flex min-h-9 items-center gap-1.5 self-start text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-60"
      >
        {estado.tipo === 'lendo' ? <Spinner /> : <LocateFixed className="size-4" aria-hidden />}
        {estado.tipo === 'lendo' ? 'Localizando...' : 'Usar minha localização'}
      </button>
      {estado.tipo === 'aproximada' ? (
        <p role="status" className="flex items-start gap-1.5 text-sm text-warning-foreground dark:text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Posição aproximada ({descreverPrecisao(estado.precisaoM)}): confira o pino verde no
            mapa e arraste se precisar.
          </span>
        </p>
      ) : null}
      {estado.tipo === 'erro' ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.mensagem}
        </p>
      ) : null}
    </div>
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
      {/* Sem seletor Inicio/Fim (pedido do usuario em 2026-11-28): o clique
          marca o que falta, e os pinos se arrastam. A dica diz o proximo passo. */}
      <p className="flex min-h-8 items-center gap-2 text-sm text-muted-foreground">
        <MousePointerClick className="size-4 shrink-0" aria-hidden />
        {!origem ? (
          <span>
            Toque no mapa para marcar o <PontoColorido cor={CORES_DO_MAPA.inicio}>início</PontoColorido>.
          </span>
        ) : !destino ? (
          <span>
            Agora toque no mapa para marcar o <PontoColorido cor={CORES_DO_MAPA.fim}>fim</PontoColorido>.
          </span>
        ) : (
          <span>Para mudar um ponto, arraste o pino ou toque perto dele.</span>
        )}
      </p>

      <MapaViagem
        origem={origem}
        destino={destino}
        rota={r.rota?.pontos ?? null}
        posicao={null}
        aoClicar={(ponto) => void r.clicar(ponto)}
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

/** "início" e "fim" com a bolinha da cor do pino, como nos rotulos dos campos. */
function PontoColorido({ cor, children }: { cor: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-medium text-foreground">
      <span className="size-2.5 rounded-full" style={{ background: cor }} aria-hidden />
      {children}
    </span>
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
