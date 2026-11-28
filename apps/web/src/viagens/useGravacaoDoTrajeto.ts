import { decidirPontoDoTrajeto, uuidv7, type LeituraDePosicao } from '@carga-certa/shared';
import { useEffect, useRef, useState } from 'react';

import { gravarPosicoes, type PosicaoParaGravar } from '@/viagens/api';
import { manterTelaAcesa, observarPosicao } from '@/viagens/gps';

/** Sem sinal por muito tempo: guarda as ultimas, e nao o dia inteiro na memoria. */
const LIMITE_DA_FILA = 500;

export interface SituacaoDoTrajeto {
  /** Ultimo ponto que entrou no trajeto (enviado ou esperando sinal). */
  ultimoPonto: LeituraDePosicao | null;
  /** Ultima leitura do GPS, mesmo a que nao entrou (imprecisa, cedo). */
  ultimaLeitura: LeituraDePosicao | null;
  /** Pontos esperando sinal para subir. */
  pendentes: number;
  erro: string | null;
}

const INICIAL: SituacaoDoTrajeto = { ultimoPonto: null, ultimaLeitura: null, pendentes: 0, erro: null };

/**
 * Grava o trajeto enquanto `ligado` e o componente estiver na tela (o detalhe
 * do frete ou da viagem aberto). Quem decide se a leitura vira ponto e
 * `decidirPontoDoTrajeto`, no shared.
 *
 * Os pontos vao para uma fila e sobem em lote: na estrada sem sinal, a fila
 * cresce e sobe inteira no primeiro ponto com rede. Ao desligar ou fechar,
 * tenta mandar o que sobrou uma ultima vez.
 */
export function useGravacaoDoTrajeto(viagemId: string, aoGravar: () => void) {
  const [ligado, setLigado] = useState(false);
  const [situacao, setSituacao] = useState<SituacaoDoTrajeto>(INICIAL);

  const aoGravarAtual = useRef(aoGravar);
  aoGravarAtual.current = aoGravar;

  useEffect(() => {
    if (!ligado) return;
    let ativo = true;
    let enviando = false;
    let ultimoPonto: LeituraDePosicao | null = null;
    const fila: PosicaoParaGravar[] = [];

    const atualizar = (parcial: Partial<SituacaoDoTrajeto>) => {
      if (ativo) setSituacao((s) => ({ ...s, ...parcial, ultimoPonto, pendentes: fila.length }));
    };

    const descarregar = async () => {
      if (enviando || fila.length === 0) return;
      enviando = true;
      const lote = fila.slice();
      try {
        await gravarPosicoes(viagemId, lote);
        fila.splice(0, lote.length);
        if (ativo) aoGravarAtual.current();
      } catch {
        // Sem sinal: o lote fica na fila e sobe com o proximo ponto.
      } finally {
        enviando = false;
        atualizar({});
      }
    };

    setSituacao(INICIAL);
    const soltarTela = manterTelaAcesa();
    const pararGps = observarPosicao(
      (leitura) => {
        if (!ativo) return;
        if (decidirPontoDoTrajeto(leitura, ultimoPonto) === 'gravar') {
          ultimoPonto = leitura;
          fila.push({ id: uuidv7(), leitura });
          if (fila.length > LIMITE_DA_FILA) fila.shift();
        }
        atualizar({ ultimaLeitura: leitura, erro: null });
        void descarregar();
      },
      (erro) => {
        if (!ativo) return;
        atualizar({ erro: erro.message });
        // Sem permissao o navegador nao vai mandar mais nada: desliga, para o
        // botao nao ficar dizendo "gravando" sem gravar.
        if (erro.semPermissao) setLigado(false);
      },
    );

    return () => {
      ativo = false;
      pararGps();
      soltarTela();
      // Ultima tentativa com o que ficou na fila. Se falhar, esses pontos se
      // perdem: o site nao guarda posicao depois de fechado.
      if (fila.length > 0) void gravarPosicoes(viagemId, fila).catch(() => {});
    };
  }, [ligado, viagemId]);

  return { ligado, setLigado, situacao };
}
