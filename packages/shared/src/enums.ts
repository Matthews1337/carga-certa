/**
 * Espelho dos `create type ... as enum` de supabase/migrations/20260919120000_init_schema.sql.
 *
 * Quando `supabase gen types typescript` rodar, os mesmos valores aparecem em
 * database.types.ts como union types. A diferenca e que la nao existe o array
 * em runtime, e a UI precisa dele para montar seletor. Por isso cada enum vira
 * um array `as const` e o union sai dele, nunca o contrario: mudar o array e a
 * unica forma de mudar o tipo, entao os dois nao tem como divergir.
 *
 * Alterar qualquer lista aqui exige migration correspondente no banco.
 */

export const NATUREZA_VEICULO = ['TRACAO', 'REBOQUE'] as const;
export type NaturezaVeiculo = (typeof NATUREZA_VEICULO)[number];

export const CARROCERIA_VEICULO = [
  'BAU',
  'SIDER',
  'GRANELEIRO',
  'CACAMBA',
  'TANQUE',
  'FRIGORIFICA',
  'PRANCHA',
  'PORTA_CONTAINER',
  'CEGONHA',
  'SILO',
  'NAO_APLICA',
] as const;
export type CarroceriaVeiculo = (typeof CARROCERIA_VEICULO)[number];

export const APLICA_DOCUMENTO = ['VEICULO', 'PILOTO'] as const;
export type AplicaDocumento = (typeof APLICA_DOCUMENTO)[number];

export const STATUS_FRETE = [
  'RASCUNHO',
  'CONTRATADO',
  'EM_ANDAMENTO',
  'CONCLUIDO',
  'CANCELADO',
] as const;
export type StatusFrete = (typeof STATUS_FRETE)[number];

export const STATUS_VIAGEM = [
  'PLANEJADA',
  'EM_ANDAMENTO',
  'PAUSADA',
  'CONCLUIDA',
  'CANCELADA',
] as const;
export type StatusViagem = (typeof STATUS_VIAGEM)[number];

export const STATUS_DESPESA = ['PENDENTE', 'CONFIRMADA', 'CANCELADA'] as const;
export type StatusDespesa = (typeof STATUS_DESPESA)[number];

export const RESPONSAVEL_PEDAGIO = ['EMBARCADOR', 'TRANSPORTADOR'] as const;
export type ResponsavelPedagio = (typeof RESPONSAVEL_PEDAGIO)[number];

export const ESCOPO_CATEGORIA = ['VEICULO', 'PESSOAL', 'ADMIN'] as const;
export type EscopoCategoria = (typeof ESCOPO_CATEGORIA)[number];

export const FORMA_PAGAMENTO = [
  'DINHEIRO',
  'PIX',
  'CARTAO_CREDITO',
  'CARTAO_DEBITO',
  'CARTAO_FRETE',
  'BOLETO',
  'TRANSFERENCIA',
  'FATURADO',
] as const;
export type FormaPagamento = (typeof FORMA_PAGAMENTO)[number];

export const TIPO_RECEITA = [
  'ADIANTAMENTO',
  'SALDO',
  'EXTRA',
  'ESTADIA',
  'DEVOLUCAO_PEDAGIO',
] as const;
export type TipoReceita = (typeof TIPO_RECEITA)[number];

export const TIPO_PARADA = [
  'CARREGAMENTO',
  'DESCARGA',
  'ABASTECIMENTO',
  'DESCANSO',
  'PEDAGIO',
  'BALANCA',
  'FRONTEIRA',
  'MANUTENCAO',
  'OUTRO',
] as const;
export type TipoParada = (typeof TIPO_PARADA)[number];

export const TIPO_MANUTENCAO = [
  'PREVENTIVA',
  'CORRETIVA',
  'REVISAO',
  'PNEU',
  'TROCA_OLEO',
] as const;
export type TipoManutencao = (typeof TIPO_MANUTENCAO)[number];

export const TIPO_COMBUSTIVEL = [
  'DIESEL_S10',
  'DIESEL_S500',
  'ARLA32',
  'GNV',
  'ETANOL',
  'GASOLINA',
] as const;
export type TipoCombustivel = (typeof TIPO_COMBUSTIVEL)[number];

export const TIPO_ESTABELECIMENTO = [
  'POSTO',
  'OFICINA',
  'BORRACHARIA',
  'RESTAURANTE',
  'HOTEL',
  'PEDAGIO',
  'BALANCA',
  'OUTRO',
] as const;
export type TipoEstabelecimento = (typeof TIPO_ESTABELECIMENTO)[number];

/**
 * Rotulos em portugues para exibicao. Separados do valor porque o banco guarda
 * o codigo e a tela mostra o texto - e o texto muda sem migration.
 */
export const ROTULOS = {
  naturezaVeiculo: {
    TRACAO: 'Tracao',
    REBOQUE: 'Reboque',
  },
  carroceriaVeiculo: {
    BAU: 'Bau',
    SIDER: 'Sider',
    GRANELEIRO: 'Graneleiro',
    CACAMBA: 'Cacamba',
    TANQUE: 'Tanque',
    FRIGORIFICA: 'Frigorifica',
    PRANCHA: 'Prancha',
    PORTA_CONTAINER: 'Porta-container',
    CEGONHA: 'Cegonha',
    SILO: 'Silo',
    NAO_APLICA: 'Nao se aplica',
  },
  statusFrete: {
    RASCUNHO: 'Rascunho',
    CONTRATADO: 'Contratado',
    EM_ANDAMENTO: 'Em andamento',
    CONCLUIDO: 'Concluido',
    CANCELADO: 'Cancelado',
  },
  statusViagem: {
    PLANEJADA: 'Planejada',
    EM_ANDAMENTO: 'Em andamento',
    PAUSADA: 'Pausada',
    CONCLUIDA: 'Concluida',
    CANCELADA: 'Cancelada',
  },
  statusDespesa: {
    PENDENTE: 'Pendente',
    CONFIRMADA: 'Confirmada',
    CANCELADA: 'Cancelada',
  },
  responsavelPedagio: {
    EMBARCADOR: 'Embarcador',
    TRANSPORTADOR: 'Transportador',
  },
  escopoCategoria: {
    VEICULO: 'Veiculo',
    PESSOAL: 'Pessoal',
    ADMIN: 'Administrativo',
  },
  formaPagamento: {
    DINHEIRO: 'Dinheiro',
    PIX: 'Pix',
    CARTAO_CREDITO: 'Cartao de credito',
    CARTAO_DEBITO: 'Cartao de debito',
    CARTAO_FRETE: 'Cartao frete',
    BOLETO: 'Boleto',
    TRANSFERENCIA: 'Transferencia',
    FATURADO: 'Faturado',
  },
  tipoReceita: {
    ADIANTAMENTO: 'Adiantamento',
    SALDO: 'Saldo',
    EXTRA: 'Extra',
    ESTADIA: 'Estadia',
    DEVOLUCAO_PEDAGIO: 'Devolucao de pedagio',
  },
  tipoParada: {
    CARREGAMENTO: 'Carregamento',
    DESCARGA: 'Descarga',
    ABASTECIMENTO: 'Abastecimento',
    DESCANSO: 'Descanso',
    PEDAGIO: 'Pedagio',
    BALANCA: 'Balanca',
    FRONTEIRA: 'Fronteira',
    MANUTENCAO: 'Manutencao',
    OUTRO: 'Outro',
  },
  tipoManutencao: {
    PREVENTIVA: 'Preventiva',
    CORRETIVA: 'Corretiva',
    REVISAO: 'Revisao',
    PNEU: 'Pneu',
    TROCA_OLEO: 'Troca de oleo',
  },
  tipoCombustivel: {
    DIESEL_S10: 'Diesel S10',
    DIESEL_S500: 'Diesel S500',
    ARLA32: 'Arla 32',
    GNV: 'GNV',
    ETANOL: 'Etanol',
    GASOLINA: 'Gasolina',
  },
  tipoEstabelecimento: {
    POSTO: 'Posto',
    OFICINA: 'Oficina',
    BORRACHARIA: 'Borracharia',
    RESTAURANTE: 'Restaurante',
    HOTEL: 'Hotel',
    PEDAGIO: 'Pedagio',
    BALANCA: 'Balanca',
    OUTRO: 'Outro',
  },
} as const satisfies {
  naturezaVeiculo: Record<NaturezaVeiculo, string>;
  carroceriaVeiculo: Record<CarroceriaVeiculo, string>;
  statusFrete: Record<StatusFrete, string>;
  statusViagem: Record<StatusViagem, string>;
  statusDespesa: Record<StatusDespesa, string>;
  responsavelPedagio: Record<ResponsavelPedagio, string>;
  escopoCategoria: Record<EscopoCategoria, string>;
  formaPagamento: Record<FormaPagamento, string>;
  tipoReceita: Record<TipoReceita, string>;
  tipoParada: Record<TipoParada, string>;
  tipoManutencao: Record<TipoManutencao, string>;
  tipoCombustivel: Record<TipoCombustivel, string>;
  tipoEstabelecimento: Record<TipoEstabelecimento, string>;
};

/** Situacoes em que a viagem ainda aceita lancamento de despesa. */
export const VIAGEM_ABERTA: readonly StatusViagem[] = ['PLANEJADA', 'EM_ANDAMENTO', 'PAUSADA'];

/** Despesas que entram no resultado. A view vw_resultado_viagem usa o mesmo corte. */
export const DESPESA_CONTABILIZA: readonly StatusDespesa[] = ['PENDENTE', 'CONFIRMADA'];
