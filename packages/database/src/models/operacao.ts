import { Model } from '@nozbe/watermelondb';
import { children, date, field, readonly, relation, text } from '@nozbe/watermelondb/decorators';
import type Query from '@nozbe/watermelondb/Query';
import type Relation from '@nozbe/watermelondb/Relation';
import type { Associations } from '@nozbe/watermelondb/Model';
import {
  VIAGEM_ABERTA,
  formatarCnpj,
  type ResponsavelPedagio,
  type StatusFrete,
  type StatusViagem,
  type TipoParada,
} from '@carga-certa/shared';

import type { Cidade, CondicaoTrajeto, TipoCarga } from './catalogos';
import type { Veiculo } from './frota';
import type { Despesa, Receita } from './financeiro';

/**
 * Frete e viagem sao coisas diferentes de proposito.
 *
 * O frete e o contrato: quem paga, quanto, que carga. A viagem e a execucao:
 * que cavalo, que carreta, odometro de saida e de chegada. Um frete tem no
 * maximo uma viagem (`ux_viagem_frete`), mas uma viagem pode nao ter frete -
 * e assim que o retorno vazio e a transferencia entre bases entram no sistema
 * com seus custos, sem receita nenhuma.
 */

export class Contratante extends Model {
  static override table = 'contratante';

  static override associations: Associations = {
    frete: { type: 'has_many', foreignKey: 'contratante_id' },
  };

  @text('nome') nome!: string;
  @text('cnpj') cnpj!: string | null;
  @text('contato') contato!: string | null;
  @text('telefone') telefone!: string | null;

  @children('frete') fretes!: Query<Frete>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  get cnpjFormatado(): string | null {
    return this.cnpj ? formatarCnpj(this.cnpj) : null;
  }
}

export class Frete extends Model {
  static override table = 'frete';

  static override associations: Associations = {
    contratante: { type: 'belongs_to', key: 'contratante_id' },
    viagem: { type: 'has_many', foreignKey: 'frete_id' },
    carga: { type: 'has_many', foreignKey: 'frete_id' },
    receita: { type: 'has_many', foreignKey: 'frete_id' },
  };

  @text('codigo') codigo!: string | null;
  @field('valor_total') valorTotal!: number;
  @field('valor_tonelada') valorTonelada!: number | null;
  @field('pedagio_por_conta') pedagioPorConta!: ResponsavelPedagio;
  @field('status') status!: StatusFrete;
  @text('observacao') observacao!: string | null;

  @relation('contratante', 'contratante_id') contratante!: Relation<Contratante>;
  @children('carga') cargas!: Query<Carga>;
  @children('receita') receitas!: Query<Receita>;
  @children('viagem') viagens!: Query<Viagem>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}

export class Viagem extends Model {
  static override table = 'viagem';

  static override associations: Associations = {
    frete: { type: 'belongs_to', key: 'frete_id' },
    despesa: { type: 'has_many', foreignKey: 'viagem_id' },
    parada: { type: 'has_many', foreignKey: 'viagem_id' },
    fechamento_viagem: { type: 'has_many', foreignKey: 'viagem_id' },
  };

  @field('veiculo_tracao_id') veiculoTracaoId!: string;
  @field('veiculo_reboque_id') veiculoReboqueId!: string | null;
  @date('inicio_em') inicioEm!: Date | null;
  @date('fim_em') fimEm!: Date | null;
  @field('odometro_inicial') odometroInicial!: number | null;
  @field('odometro_final') odometroFinal!: number | null;
  /** Gerada no servidor a partir dos odometros. Read-only na pratica. */
  @field('km_total') kmTotal!: number | null;
  @field('status') status!: StatusViagem;
  @text('observacao') observacao!: string | null;

  @relation('frete', 'frete_id') frete!: Relation<Frete>;
  @relation('veiculo', 'veiculo_tracao_id') veiculoTracao!: Relation<Veiculo>;
  @relation('veiculo', 'veiculo_reboque_id') veiculoReboque!: Relation<Veiculo>;
  @relation('condicao_trajeto', 'condicao_trajeto_id') condicaoTrajeto!: Relation<CondicaoTrajeto>;
  @relation('cidade', 'cidade_origem_id') cidadeOrigem!: Relation<Cidade>;
  @relation('cidade', 'cidade_destino_id') cidadeDestino!: Relation<Cidade>;

  @children('parada') paradas!: Query<Parada>;
  @children('despesa') despesas!: Query<Despesa>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /** Se ainda aceita lancamento de despesa. */
  get aberta(): boolean {
    return VIAGEM_ABERTA.includes(this.status);
  }

  /**
   * Km rodados. Usa `km_total` quando o servidor ja calculou; senao refaz a
   * conta local, porque offline a coluna gerada ainda nao voltou do sync.
   */
  get km(): number | null {
    if (this.kmTotal !== null) return this.kmTotal;
    if (this.odometroFinal === null || this.odometroInicial === null) return null;
    return this.odometroFinal - this.odometroInicial;
  }
}

export class Carga extends Model {
  static override table = 'carga';

  static override associations: Associations = {
    frete: { type: 'belongs_to', key: 'frete_id' },
    tipo_carga: { type: 'belongs_to', key: 'tipo_carga_id' },
  };

  @field('peso_kg') pesoKg!: number | null;
  @field('valor_mercadoria') valorMercadoria!: number | null;
  @text('descricao') descricao!: string | null;

  @relation('frete', 'frete_id') frete!: Relation<Frete>;
  @relation('tipo_carga', 'tipo_carga_id') tipoCarga!: Relation<TipoCarga>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}

export class Parada extends Model {
  static override table = 'parada';

  static override associations: Associations = {
    viagem: { type: 'belongs_to', key: 'viagem_id' },
    cidade: { type: 'belongs_to', key: 'cidade_id' },
  };

  /** Posicao no roteiro. Unica por viagem (`ux_parada_ordem`). */
  @field('ordem') ordem!: number;
  @field('tipo') tipo!: TipoParada;
  @date('chegada_em') chegadaEm!: Date | null;
  @date('saida_em') saidaEm!: Date | null;
  @field('odometro') odometro!: number | null;
  @text('observacao') observacao!: string | null;

  @relation('viagem', 'viagem_id') viagem!: Relation<Viagem>;
  @relation('cidade', 'cidade_id') cidade!: Relation<Cidade>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /** Tempo parado, em minutos. Alimenta a cobranca de estadia. */
  get minutosParado(): number | null {
    if (!this.chegadaEm || !this.saidaEm) return null;
    return Math.round((this.saidaEm.getTime() - this.chegadaEm.getTime()) / 60_000);
  }
}
