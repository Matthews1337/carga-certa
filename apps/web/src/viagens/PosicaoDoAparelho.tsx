import {
  descreverPrecisao,
  precisaoAceitavel,
  uuidv7,
  type LeituraDePosicao,
} from '@carga-certa/shared';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { AlertTriangle, CircleDot, LocateFixed, Square } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/feedback';
import { tempoDesde } from '@/viagens/apresentacao';
import { gravarPosicoes } from '@/viagens/api';
import { lerPosicao } from '@/viagens/gps';
import { useGravacaoDoTrajeto } from '@/viagens/useGravacaoDoTrajeto';

/** O porque da posicao aproximada, dito igual nos dois avisos. */
const POR_QUE_APROXIMADA =
  'No computador a posição vem da internet, e não do GPS. No iPhone, confira se a "Localização Precisa" está ligada para o Safari.';

type Envio =
  | { estado: 'parado' }
  | { estado: 'lendo' }
  | { estado: 'gravando' }
  | { estado: 'confirmar'; leitura: LeituraDePosicao }
  | { estado: 'enviado'; leitura: LeituraDePosicao }
  | { estado: 'erro'; mensagem: string };

/**
 * Posicao pelo navegador, no detalhe do frete e da viagem em aberto: "Enviar
 * minha posicao" (um ponto) e "Gravar trajeto" (enquanto esta janela estiver
 * aberta). Depois de gravar, recarrega a lista, e o mapa mostra o pino novo.
 */
export function PosicaoDoAparelho({
  viagemId,
  chaveDaLista,
}: {
  viagemId: string;
  /** Lista de onde o detalhe le a ultima posicao (fretes ou viagens). */
  chaveDaLista: QueryKey;
}) {
  const queryClient = useQueryClient();
  const atualizarMapa = () => void queryClient.invalidateQueries({ queryKey: chaveDaLista });

  const [envio, setEnvio] = useState<Envio>({ estado: 'parado' });
  const trajeto = useGravacaoDoTrajeto(viagemId, atualizarMapa);

  const gravarUma = async (leitura: LeituraDePosicao) => {
    setEnvio({ estado: 'gravando' });
    try {
      await gravarPosicoes(viagemId, [{ id: uuidv7(), leitura }]);
      setEnvio({ estado: 'enviado', leitura });
      atualizarMapa();
    } catch (erro) {
      setEnvio({ estado: 'erro', mensagem: `Não foi possível enviar: ${(erro as Error).message}` });
    }
  };

  const enviar = async () => {
    setEnvio({ estado: 'lendo' });
    try {
      const leitura = await lerPosicao();
      // Precisao ruim nao vai para o mapa sem a pessoa saber: do escritorio,
      // o caminhao "apareceria" parado no escritorio.
      if (precisaoAceitavel(leitura.precisaoM)) await gravarUma(leitura);
      else setEnvio({ estado: 'confirmar', leitura });
    } catch (erro) {
      setEnvio({ estado: 'erro', mensagem: (erro as Error).message });
    }
  };

  const ocupado = envio.estado === 'lendo' || envio.estado === 'gravando';

  return (
    <section className="flex flex-col gap-2" aria-label="Posição do aparelho">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={ocupado} onClick={() => void enviar()}>
          {ocupado ? <Spinner /> : <LocateFixed className="size-4" aria-hidden />}
          {envio.estado === 'lendo' ? 'Localizando...' : 'Enviar minha posição'}
        </Button>
        <Button
          variant={trajeto.ligado ? 'accent' : 'outline'}
          size="sm"
          aria-pressed={trajeto.ligado}
          onClick={() => {
            // O aviso do ultimo envio avulso ("Posicao enviada") nao vale mais
            // como situacao: quem fala agora e a gravacao.
            setEnvio({ estado: 'parado' });
            trajeto.setLigado(!trajeto.ligado);
          }}
        >
          {trajeto.ligado ? (
            <Square className="size-4" aria-hidden />
          ) : (
            <CircleDot className="size-4" aria-hidden />
          )}
          {trajeto.ligado ? 'Parar de gravar' : 'Gravar trajeto'}
        </Button>
      </div>

      <AvisoDoEnvio
        envio={envio}
        aoConfirmar={(leitura) => void gravarUma(leitura)}
        aoCancelar={() => setEnvio({ estado: 'parado' })}
      />

      {trajeto.ligado || trajeto.situacao.erro ? (
        <SituacaoDoTrajeto ligado={trajeto.ligado} situacao={trajeto.situacao} />
      ) : null}
    </section>
  );
}

function AvisoDoEnvio({
  envio,
  aoConfirmar,
  aoCancelar,
}: {
  envio: Envio;
  aoConfirmar: (leitura: LeituraDePosicao) => void;
  aoCancelar: () => void;
}) {
  if (envio.estado === 'enviado') {
    return (
      <p role="status" className="text-sm text-success">
        Posição enviada ({descreverPrecisao(envio.leitura.precisaoM)}).
      </p>
    );
  }
  if (envio.estado === 'erro') {
    return (
      <p role="alert" className="text-sm text-destructive">
        {envio.mensagem}
      </p>
    );
  }
  if (envio.estado !== 'confirmar') return null;

  return (
    <div role="alert" className="flex flex-col gap-2 rounded-lg border border-warning/60 bg-warning/10 p-3 text-sm">
      <p className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground dark:text-warning" aria-hidden />
        <span>
          Localização aproximada: erro de até {descreverPrecisao(envio.leitura.precisaoM).slice(1)}.{' '}
          {POR_QUE_APROXIMADA} Gravar mesmo assim?
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => aoConfirmar(envio.leitura)}>
          Gravar mesmo assim
        </Button>
        <Button size="sm" variant="ghost" onClick={aoCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function SituacaoDoTrajeto({
  ligado,
  situacao,
}: {
  ligado: boolean;
  situacao: ReturnType<typeof useGravacaoDoTrajeto>['situacao'];
}) {
  const agora = useAgora(ligado);
  const { ultimoPonto, ultimaLeitura, pendentes, erro } = situacao;
  const leituraRuim = ultimaLeitura !== null && !precisaoAceitavel(ultimaLeitura.precisaoM);

  return (
    <div role="status" className="flex flex-col gap-1 text-sm">
      {erro ? <p className="text-destructive">{erro}</p> : null}

      {ligado ? (
        <>
          <p className="flex items-center gap-2 font-medium">
            <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden />
            {ultimoPonto
              ? `Gravando o trajeto. Último ponto ${tempoDesde(new Date(ultimoPonto.em).toISOString(), agora)} (${descreverPrecisao(ultimoPonto.precisaoM)}).`
              : 'Gravando o trajeto. Esperando o sinal do GPS...'}
          </p>
          {pendentes > 0 ? (
            <p className="text-muted-foreground">
              {pendentes === 1 ? '1 ponto esperando' : `${pendentes} pontos esperando`} sinal de
              internet para subir.
            </p>
          ) : null}
          {leituraRuim ? (
            <p className="text-warning-foreground dark:text-warning">
              Precisão baixa agora ({descreverPrecisao(ultimaLeitura.precisaoM)}): estes pontos não
              vão para o mapa. {POR_QUE_APROXIMADA}
            </p>
          ) : null}
          <p className="text-muted-foreground">
            Deixe esta janela aberta e o celular desbloqueado: com a tela apagada ou em outro app,
            o navegador para de receber o GPS. A tela fica acesa enquanto grava.
          </p>
        </>
      ) : null}
    </div>
  );
}

/** Relogio que anda a cada 30 s, para o "ha 2 min" envelhecer na tela. */
function useAgora(ativo: boolean): Date {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    if (!ativo) return;
    const id = window.setInterval(() => setAgora(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, [ativo]);
  return agora;
}
