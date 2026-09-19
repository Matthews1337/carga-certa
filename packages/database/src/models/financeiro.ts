import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, relation, text } from '@nozbe/watermelondb/decorators';
import type Relation from '@nozbe/watermelondb/Relation';
import type { Associations } from '@nozbe/watermelondb/Model';
import {
  situacaoManutencao,
  type EscopoCategoria,
  type FormaPagamento,
  type SituacaoVencimento,
  type StatusDespesa,
  type TipoCombustivel,
  type TipoManutencao,
  type TipoReceita,
} from '@carga-certa/shared';

import type { Estabelecimento } from './catalogos';
import type { Veiculo } from './frota';
import { dataLocal } from './perfil';
import type { Frete, Viagem } from './operacao';

export class CategoriaDespesa extends Model {
  static override table = 'categoria_despesa';

  static override associations: Associations = {
    despesa: { type: 'has_many', foreignKey: 'categoria_id' },
    categoria_despesa: { type: 'belongs_to', key: 'categoria_pai_id' },
  };

  @text('nome') nome!: string;
  /** VEICULO separa gasto do caminhao; PESSOAL, gasto do motorista. */
  @field('escopo') escopo!: EscopoCategoria;
  @field('dedutivel') dedutivel!: boolean;
  /**
   * Categoria do sistema. No servidor equivale a `piloto_id is null`; como
   * piloto_id nao existe no cliente, este e o campo que diz o que e imutavel.
   */
  @field('is_padrao') isPadrao!: boolean;
  @text('icone') icone!: string | null;
  @field('ordem') ordem!: number;
  @field('ativo') ativo!: boolean;

  @relation('categoria_despesa', 'categoria_pai_id') categoriaPai!: Relation<CategoriaDespesa>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /** Categoria do sistema nao pode ser editada nem apagada pelo usuario. */
  get editavel(): boolean {
    return !this.isPadrao;
  }
}

export class Despesa extends Model {
  static override table = 'despesa';

  static override associations: Associations = {
    viagem: { type: 'belongs_to', key: 'viagem_id' },
    veiculo: { type: 'belongs_to', key: 'veiculo_id' },
    categoria_despesa: { type: 'belongs_to', key: 'categoria_id' },
    abastecimento: { type: 'has_many', foreignKey: 'despesa_id' },
    manutencao: { type: 'has_many', foreignKey: 'despesa_id' },
  };

  /** NULO = gasto fora de frete. O eixo que separa gasto de piloto de gasto de viagem. */
  @field('viagem_id') viagemId!: string | null;
  @field('veiculo_id') veiculoId!: string | null;
  @field('categoria_id') categoriaId!: string;
  @field('valor') valor!: number;
  @date('data_hora') dataHora!: Date;
  @field('forma_pagamento') formaPagamento!: FormaPagamento;
  @text('descricao') descricao!: string | null;
  /**
   * Caminho no bucket `comprovantes`, no formato {piloto_id}/{despesa_id}.jpg.
   * Preenchido no momento em que a foto e tirada, mesmo offline: o arquivo sobe
   * depois, quando a rede voltar. Monte sempre com `caminhoComprovante()`.
   */
  @text('comprovante_path') comprovantePath!: string | null;
  @field('latitude') latitude!: number | null;
  @field('longitude') longitude!: number | null;
  @field('status') status!: StatusDespesa;

  @relation('viagem', 'viagem_id') viagem!: Relation<Viagem>;
  @relation('veiculo', 'veiculo_id') veiculo!: Relation<Veiculo>;
  @relation('categoria_despesa', 'categoria_id') categoria!: Relation<CategoriaDespesa>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /** Gasto avulso do piloto, sem vinculo com frete. */
  get foraDeFrete(): boolean {
    return this.viagemId === null;
  }

  /** Entra no resultado. Espelha o `status <> 'CANCELADA'` da view do servidor. */
  get contabiliza(): boolean {
    return this.status !== 'CANCELADA';
  }
}

export class Abastecimento extends Model {
  static override table = 'abastecimento';

  static override associations: Associations = {
    despesa: { type: 'belongs_to', key: 'despesa_id' },
    estabelecimento: { type: 'belongs_to', key: 'estabelecimento_id' },
  };

  @field('litros') litros!: number;
  @field('preco_litro') precoLitro!: number;
  @field('odometro') odometro!: number;
  /** Sem tanque cheio nas duas pontas nao existe km/L conferivel. */
  @field('tanque_cheio') tanqueCheio!: boolean;
  @field('combustivel') combustivel!: TipoCombustivel;

  @relation('despesa', 'despesa_id') despesa!: Relation<Despesa>;
  @relation('estabelecimento', 'estabelecimento_id') estabelecimento!: Relation<Estabelecimento>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /**
   * Valor do abastecimento derivado de litros x preco. Nao substitui
   * `despesa.valor`, que e o que foi efetivamente pago - a bomba arredonda, e
   * quando os dois divergem em centavos quem vale e o que saiu do bolso.
   */
  get valorCalculado(): number {
    return Math.round(this.litros * this.precoLitro * 100) / 100;
  }
}

export class Manutencao extends Model {
  static override table = 'manutencao';

  static override associations: Associations = {
    despesa: { type: 'belongs_to', key: 'despesa_id' },
    veiculo: { type: 'belongs_to', key: 'veiculo_id' },
    estabelecimento: { type: 'belongs_to', key: 'oficina_id' },
  };

  @field('tipo') tipo!: TipoManutencao;
  @text('item') item!: string;
  @field('odometro') odometro!: number | null;
  @field('proxima_odometro') proximaOdometro!: number | null;
  /** 'AAAA-MM-DD'. */
  @text('proxima_data') proximaData!: string | null;
  @text('observacao') observacao!: string | null;

  @relation('despesa', 'despesa_id') despesa!: Relation<Despesa>;
  @relation('veiculo', 'veiculo_id') veiculo!: Relation<Veiculo>;
  @relation('estabelecimento', 'oficina_id') oficina!: Relation<Estabelecimento>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /**
   * Situacao da proxima revisao. Precisa do odometro atual do veiculo, que vem
   * de fora porque ler a relation aqui exigiria await num getter.
   */
  situacao(odometroAtual: number | null): SituacaoVencimento | null {
    return situacaoManutencao({
      proximaData: this.proximaData ? dataLocal(this.proximaData) : null,
      proximaOdometro: this.proximaOdometro,
      odometroAtual,
    });
  }
}

export class Receita extends Model {
  static override table = 'receita';

  static override associations: Associations = {
    frete: { type: 'belongs_to', key: 'frete_id' },
  };

  @field('tipo') tipo!: TipoReceita;
  @field('valor') valor!: number;
  @date('recebido_em') recebidoEm!: Date | null;
  @field('forma_recebimento') formaRecebimento!: FormaPagamento;
  @text('observacao') observacao!: string | null;

  @relation('frete', 'frete_id') frete!: Relation<Frete>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /** Lancada mas ainda nao caiu na conta. */
  get pendente(): boolean {
    return this.recebidoEm === null;
  }
}

/**
 * Snapshot do resultado no fechamento da viagem.
 *
 * Congelar importa: editar uma despesa antiga nao pode mudar o lucro de uma
 * viagem ja fechada, senao o historico se reescreve sozinho. Para o numero ao
 * vivo, use `calcularResultadoViagem()` do pacote shared, ou a view
 * `vw_resultado_viagem` no servidor.
 */
export class FechamentoViagem extends Model {
  static override table = 'fechamento_viagem';

  static override associations: Associations = {
    viagem: { type: 'belongs_to', key: 'viagem_id' },
  };

  @field('receita_total') receitaTotal!: number;
  @field('despesa_total') despesaTotal!: number;
  @field('lucro_liquido') lucroLiquido!: number;
  @field('custo_por_km') custoPorKm!: number | null;
  @field('consumo_medio') consumoMedio!: number | null;
  @field('km_total') kmTotal!: number | null;
  @date('calculado_em') calculadoEm!: Date;

  @relation('viagem', 'viagem_id') viagem!: Relation<Viagem>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
