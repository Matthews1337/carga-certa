import type { DriveStep, Driver, Popover } from 'driver.js';

import type { PassoDoTour } from '@/tutorial/passos';
import type { FimDoTutorial } from '@/tutorial/situacao';

let tourAtivo: Driver | null = null;

/**
 * Primeiro elemento VISIVEL com aquele data-tour. O tema, por exemplo, tem um
 * botao na barra do celular e outro no menu lateral, e so um aparece por vez;
 * o querySelector puro devolveria o escondido.
 */
export function elementoVisivel(alvo: string): Element | undefined {
  return Array.from(document.querySelectorAll(`[data-tour="${alvo}"]`)).find(
    (el) => el.getClientRects().length > 0,
  );
}

/** Espera o elemento aparecer (a tela pode ser um pedaco lazy ainda baixando). */
export function esperarElemento(alvo: string, limiteMs: number): Promise<void> {
  return new Promise((resolve) => {
    const inicio = Date.now();
    const conferir = () => {
      if (elementoVisivel(alvo) || Date.now() - inicio >= limiteMs) resolve();
      else window.setTimeout(conferir, 100);
    };
    conferir();
  });
}

export function encerrarTour(): void {
  if (tourAtivo?.isActive()) tourAtivo.destroy();
  tourAtivo = null;
}

/**
 * Roda um tour e resolve quando ele termina: "concluido" se a pessoa chegou ao
 * fim, "pulado" se fechou antes (X, Esc ou "Pular tutorial").
 *
 * O driver.js e o CSS dele vem por import dinamico, num pedaco proprio do
 * build (vite.config.ts): quase toda sessao passa sem abrir tour nenhum.
 */
export async function executarTour(
  passos: PassoDoTour[],
  opcoes: { comPular?: boolean } = {},
): Promise<FimDoTutorial> {
  encerrarTour();

  const [{ driver }] = await Promise.all([
    import('driver.js'),
    import('driver.js/dist/driver.css'),
  ]);

  // Filtra antes de comecar, e nao so no meio (skipMissingElement): assim o
  // "3 de 8" do rodape conta so o que a pessoa vai ver de fato.
  const visiveis = passos.filter((p) => !p.alvo || elementoVisivel(p.alvo));
  if (visiveis.length === 0) return 'concluido';

  return new Promise((resolve) => {
    const tour = driver({
      steps: visiveis.map((p, i) => paraPassoDoDriver(p, i === 0 && !p.alvo)),
      showProgress: visiveis.length > 1,
      progressText: '{{current}} de {{total}}',
      nextBtnText: 'Próximo',
      prevBtnText: 'Voltar',
      doneBtnText: 'Concluir',
      closeBtnLabel: 'Fechar tutorial',
      popoverClass: 'tour-carga-certa',
      overlayColor: '#000',
      overlayOpacity: 0.6,
      // Os dois casam com a moldura amarela do index.css: o outline vai ate
      // 4 px fora do item, dentro dos 6 px do recorte, e com raio 6 os cantos
      // de item quadrado nao caem embaixo da camada escura.
      stagePadding: 6,
      stageRadius: 6,
      // Clique fora do balao nao fecha: um toque sem querer na tela do celular
      // encerraria o tutorial de boas-vindas como "pulado".
      overlayClickBehavior: 'none',
      // O destaque e para olhar: clicar no link do menu destacado trocaria de
      // tela no meio do tour.
      disableActiveInteraction: true,
      skipMissingElement: true,
      onPopoverRender: (popover, { driver: atual }) => {
        if (!opcoes.comPular || atual.isLastStep()) return;
        const pular = document.createElement('button');
        pular.type = 'button';
        pular.className = 'tour-pular';
        pular.textContent = 'Pular tutorial';
        pular.addEventListener('click', () => atual.destroy());
        popover.wrapper.append(pular);
      },
      onDestroyed: (_elemento, _passo, { reason }) => {
        if (tourAtivo === tour) tourAtivo = null;
        resolve(reason === 'done' ? 'concluido' : 'pulado');
      },
    });

    tourAtivo = tour;
    tour.drive();
  });
}

function paraPassoDoDriver(passo: PassoDoTour, abertura: boolean): DriveStep {
  const { alvo } = passo;
  const balao: Popover = {
    title: passo.titulo,
    description: passo.texto,
    side: passo.lado,
    align: 'start',
  };
  if (abertura) {
    // O balao de abertura, sem alvo, so tem "Comecar": voltar para onde?
    balao.nextBtnText = 'Começar';
    balao.showButtons = ['next', 'close'];
  }
  return {
    // Funcao, e nao seletor: o alvo e resolvido na hora do passo, ja com a
    // regra do visivel.
    element: alvo ? () => elementoVisivel(alvo) as Element : undefined,
    popover: balao,
  };
}
