/**
 * Textos dos tutoriais.
 *
 * Cada passo aponta para um elemento pelo atributo `data-tour`. Passo cujo alvo
 * nao esta visivel na hora e pulado: e assim que o mesmo roteiro serve ao
 * computador (menu lateral) e ao celular (menu na gaveta), e a tela sem
 * nenhum card ainda (o passo do card some).
 */

export type PassoDoTour = {
  /** Valor do `data-tour` do alvo. Sem alvo, o balao aparece no meio da tela. */
  alvo?: string;
  titulo: string;
  texto: string;
  lado?: 'top' | 'right' | 'bottom' | 'left';
};

export type TourDaPagina =
  | 'painel'
  | 'despesas'
  | 'fretes'
  | 'viagens'
  | 'veiculos'
  | 'contratantes';

/** Bloco do titulo de cada tela; o botao "i" abre o tour por ele. */
export const ALVO_DO_CABECALHO = 'cabecalho';
export const ALVO_DO_BOTAO_AJUDA = 'ajuda-da-pagina';

/**
 * Primeiro acesso: o mapa do sistema. Explica o menu, e nao os campos de cada
 * tela - isso fica com o botao "i" de cada uma, para o roteiro caber em menos
 * de um minuto.
 */
export const TOUR_DE_BOAS_VINDAS: PassoDoTour[] = [
  {
    titulo: 'Bem-vindo ao Carga Certa',
    texto:
      'Em menos de um minuto, mostramos onde fica cada coisa. Se preferir, pule: dá para rever cada tela depois, no botão "i" ao lado do título.',
  },
  {
    alvo: 'menu-painel',
    titulo: 'Painel',
    texto: 'O resumo do mês: quanto entrou, quanto saiu, quantas viagens e quantos km.',
    lado: 'right',
  },
  {
    alvo: 'menu-despesas',
    titulo: 'Despesas',
    texto:
      'Todo gasto do caminhão e do motorista - diesel, pedágio, comida, manutenção -, com a foto do comprovante.',
    lado: 'right',
  },
  {
    alvo: 'menu-fretes',
    titulo: 'Fretes',
    texto: 'Cada frete com a rota no mapa, os km, o valor combinado e o que já foi recebido.',
    lado: 'right',
  },
  {
    alvo: 'menu-viagens',
    titulo: 'Viagens',
    texto: 'O caminho rodado sem frete: ir vazio até a coleta, voltar da entrega, ir à oficina.',
    lado: 'right',
  },
  {
    alvo: 'menu-veiculos',
    titulo: 'Veículos',
    texto:
      'Caminhões, cavalos e carretas, com os documentos e o aviso de vencimento. Comece por aqui: todo frete precisa de um veículo.',
    lado: 'right',
  },
  {
    alvo: 'menu-contratantes',
    titulo: 'Contratantes',
    texto: 'Quem contrata seus fretes, com atalho para ligar e para chamar no WhatsApp.',
    lado: 'right',
  },
  {
    alvo: 'menu-documentos',
    titulo: 'Documentos',
    texto: 'Esta seção ainda está em construção.',
    lado: 'right',
  },
  // No celular o menu fica numa gaveta: os sete passos acima somem, e este
  // aparece no lugar deles.
  {
    alvo: 'menu-abrir',
    titulo: 'Menu',
    texto:
      'Aqui ficam as seções: Painel, Despesas, Fretes, Viagens, Veículos, Contratantes e Documentos. O botão Sair também fica lá.',
    lado: 'bottom',
  },
  {
    alvo: 'tema',
    titulo: 'Tema',
    texto:
      'Claro, escuro ou automático, que acompanha o aparelho. O escuro ofusca menos à noite na cabine.',
  },
  {
    alvo: 'sair',
    titulo: 'Sair',
    texto: 'Encerra a sessão neste aparelho.',
    lado: 'right',
  },
  {
    alvo: ALVO_DO_BOTAO_AJUDA,
    titulo: 'Ajuda de cada tela',
    texto:
      'Este botão explica os itens da tela em que você está. Toque nele sempre que tiver dúvida.',
    lado: 'bottom',
  },
];

/**
 * Tour do botao "i". O primeiro passo, no titulo da tela com a descricao dela,
 * e montado pelo proprio botao com o texto que a pagina ja mostra.
 */
export const TOURS_DAS_PAGINAS: Record<TourDaPagina, PassoDoTour[]> = {
  painel: [
    {
      alvo: 'painel-mes',
      titulo: 'Mês',
      texto: 'Use as setas para ver os meses anteriores. "Mês atual" volta para hoje.',
      lado: 'bottom',
    },
    {
      alvo: 'painel-resultado',
      titulo: 'Resultado do mês',
      texto:
        'O que entrou menos o que saiu. Entrou: os recebimentos dos fretes, pela data em que o dinheiro caiu. Saiu: as despesas, pela data do gasto.',
    },
    {
      alvo: 'painel-viagens',
      titulo: 'Viagens',
      texto: 'Quantas viagens começaram no mês, concluídas e em aberto.',
    },
    {
      alvo: 'painel-km',
      titulo: 'Km rodados',
      texto:
        'Pelo odômetro; sem ele, pela rota prevista das viagens concluídas. O "≈" na frente indica que parte é estimativa.',
    },
  ],

  despesas: [
    {
      alvo: 'despesas-nova',
      titulo: 'Nova despesa',
      texto:
        'Lance um gasto: valor, categoria, forma de pagamento e, se quiser, a foto do comprovante. Se o gasto foi no caminho, ligue à viagem ou ao frete.',
      lado: 'bottom',
    },
    {
      alvo: 'despesas-totais',
      titulo: 'Totais do período',
      texto:
        'Quanto saiu no período, separado em caminhão, motorista e administrativo. Despesa cancelada não entra na conta.',
    },
    {
      alvo: 'despesas-filtros',
      titulo: 'Filtros',
      texto:
        'Escolha o período em "De" e "Até" e filtre por escopo, por vínculo (em viagem ou fora de frete) e por situação. Os totais acompanham o filtro.',
    },
    {
      alvo: 'despesas-lista',
      titulo: 'Lançamentos',
      texto:
        'As despesas do período. Em "Ações": ver o comprovante, editar (lápis) e excluir (lixeira).',
      lado: 'top',
    },
  ],

  fretes: [
    {
      alvo: 'fretes-novo',
      titulo: 'Novo frete',
      texto:
        'Busque ou marque no mapa onde o frete começa e termina: o app calcula a rota de caminhão e os km. Depois, o veículo, o contratante e o valor combinado.',
      lado: 'bottom',
    },
    {
      alvo: 'fretes-card',
      titulo: 'Card do frete',
      texto:
        'Rota, km, mês de início e o valor combinado: laranja enquanto falta receber, verde quando recebido. Toque no card para lançar recebimentos e concluir o frete.',
    },
  ],

  viagens: [
    {
      alvo: 'viagens-nova',
      titulo: 'Nova viagem',
      texto:
        'Registre o caminho rodado sem carga: de onde saiu, para onde foi e com qual veículo. A viagem de um frete fica no card do frete, e não aqui.',
      lado: 'bottom',
    },
    {
      alvo: 'viagens-card',
      titulo: 'Card da viagem',
      texto:
        'Trajeto, km e o que foi gasto nela. Toque no card para ver os gastos e concluir a viagem.',
    },
  ],

  veiculos: [
    {
      alvo: 'veiculos-novo',
      titulo: 'Novo veículo',
      texto:
        'Cadastre primeiro o caminhão ou o cavalo mecânico: todo frete precisa de um veículo de tração. Carretas entram como reboque.',
      lado: 'bottom',
    },
    {
      alvo: 'veiculos-card',
      titulo: 'Card do veículo',
      texto:
        'Placa, tipo e os dados principais. A última linha avisa o documento que vence primeiro. O lápis edita e a lixeira exclui.',
    },
    {
      alvo: 'veiculos-documentos',
      titulo: 'Documentos do veículo',
      texto: 'CRLV, seguro e outros documentos, com a validade e a foto ou o PDF.',
      lado: 'top',
    },
  ],

  contratantes: [
    {
      alvo: 'contratantes-novo',
      titulo: 'Novo contratante',
      texto:
        'Só o nome é obrigatório. Quem você cadastrar aparece na lista na hora de lançar um frete.',
      lado: 'bottom',
    },
    {
      alvo: 'contratantes-busca',
      titulo: 'Busca',
      texto: 'Procure por nome, CNPJ ou contato. Não precisa de acento.',
      lado: 'bottom',
    },
    {
      alvo: 'contratantes-card',
      titulo: 'Card do contratante',
      texto:
        'Toque no telefone para ligar; se for celular, o atalho do WhatsApp abre a conversa. O lápis edita e a lixeira exclui.',
    },
  ],
};
