import { useId } from 'react';

import { executarTour } from '@/tutorial/executar';
import {
  ALVO_DO_BOTAO_AJUDA,
  ALVO_DO_CABECALHO,
  TOURS_DAS_PAGINAS,
  type TourDaPagina,
} from '@/tutorial/passos';

/**
 * Botao "i" ao lado do titulo: a dica mostra a descricao da tela, e o clique
 * percorre os itens dela.
 *
 * A dica e CSS puro (hover e foco): o projeto nao tem o Tooltip do Radix, e
 * nao vale uma dependencia para um texto. No toque nao ha hover, mas o
 * primeiro passo do tour repete a mesma descricao.
 *
 * A dica se posiciona pelo PAI com `relative` (a linha do titulo, no
 * CabecalhoDaPagina), e nao pelo botao: presa ao botao, ela comecava no meio
 * da tela do celular e passava da borda - mesmo invisivel, criava rolagem
 * lateral na pagina.
 */
export function BotaoAjuda({
  tour,
  titulo,
  descricao,
}: {
  tour: TourDaPagina;
  titulo: string;
  descricao: string;
}) {
  const idDaDica = useId();

  const abrir = () => {
    void executarTour([
      { alvo: ALVO_DO_CABECALHO, titulo, texto: descricao, lado: 'bottom' },
      ...TOURS_DAS_PAGINAS[tour],
    ]).catch(() => {
      // Sem rede para baixar o pedaco do tour. Nao ha o que mostrar; o botao
      // continua ali para a proxima tentativa.
    });
  };

  return (
    <span className="group -my-1.5 inline-flex">
      <button
        type="button"
        data-tour={ALVO_DO_BOTAO_AJUDA}
        onClick={abrir}
        aria-label={`Como usar a tela ${titulo}`}
        aria-describedby={idDaDica}
        // 44px de alvo de toque, com o circulo de 24px no meio.
        className="flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/*
          Circulo cinza com o "i" branco, como no modelo pedido pelo usuario.
          O branco e fixo de proposito: sobre o cinza ele le nos dois temas,
          e o token de texto inverteria no escuro.
        */}
        <span
          aria-hidden
          className="flex size-6 items-center justify-center rounded-full bg-muted-foreground/60 font-serif text-[15px] font-bold leading-none text-white transition-colors group-hover:bg-muted-foreground group-focus-within:bg-muted-foreground"
        >
          i
        </span>
      </button>

      <span
        role="tooltip"
        id={idDaDica}
        className="pointer-events-none invisible absolute left-0 top-full z-20 mt-1 w-max max-w-[min(18rem,calc(100vw-2rem))] rounded-md border border-border bg-popover px-3 py-2 text-sm font-normal text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {descricao}
      </span>
    </span>
  );
}
