import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, relation, text } from '@nozbe/watermelondb/decorators';
import type Relation from '@nozbe/watermelondb/Relation';
import type { Associations } from '@nozbe/watermelondb/Model';
import type {
  AplicaDocumento,
  NaturezaVeiculo,
  TipoEstabelecimento,
} from '@carga-certa/shared';

/**
 * Catalogos compartilhados entre todos os usuarios.
 *
 * No servidor nao tem `piloto_id`: leitura liberada para qualquer autenticado,
 * escrita so via service_role. A excecao e `estabelecimento`, que o proprio
 * motorista alimenta ao registrar abastecimento num posto ainda nao cadastrado.
 *
 * Nao edite os demais pelo app: o push seria rejeitado pela RLS, e o registro
 * ficaria marcado como pendente para sempre, tentando subir a cada sync.
 */

export class Cidade extends Model {
  static override table = 'cidade';

  @field('codigo_ibge') codigoIbge!: number;
  @text('nome') nome!: string;
  @text('uf') uf!: string;
  @field('latitude') latitude!: number | null;
  @field('longitude') longitude!: number | null;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  get rotulo(): string {
    return `${this.nome} - ${this.uf}`;
  }
}

export class TipoVeiculo extends Model {
  static override table = 'tipo_veiculo';

  @text('nome') nome!: string;
  @field('natureza') natureza!: NaturezaVeiculo;
  @field('qtd_eixos') qtdEixos!: number | null;
  @field('capacidade_kg_ref') capacidadeKgRef!: number | null;
  @text('categoria_cnh_minima') categoriaCnhMinima!: string | null;
  @field('ordem') ordem!: number;
  @field('ativo') ativo!: boolean;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}

export class TipoDocumento extends Model {
  static override table = 'tipo_documento';

  @text('nome') nome!: string;
  @field('aplica_se_a') aplicaSeA!: AplicaDocumento;
  @field('periodicidade_meses') periodicidadeMeses!: number | null;
  @field('obrigatorio') obrigatorio!: boolean;
  @field('ativo') ativo!: boolean;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}

export class TipoCarga extends Model {
  static override table = 'tipo_carga';

  @text('nome') nome!: string;
  @text('descricao') descricao!: string | null;
  @field('perigosa') perigosa!: boolean;
  @field('refrigerada') refrigerada!: boolean;
  @field('ativo') ativo!: boolean;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}

export class CondicaoTrajeto extends Model {
  static override table = 'condicao_trajeto';

  @text('condicao') condicao!: string;
  @text('descricao') descricao!: string | null;
  @field('ativo') ativo!: boolean;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}

export class Estabelecimento extends Model {
  static override table = 'estabelecimento';

  static override associations: Associations = {
    cidade: { type: 'belongs_to', key: 'cidade_id' },
  };

  @text('nome') nome!: string;
  @text('cnpj') cnpj!: string | null;
  @field('tipo') tipo!: TipoEstabelecimento;
  @field('latitude') latitude!: number | null;
  @field('longitude') longitude!: number | null;
  /** Quem cadastrou. Preenchido pelo servidor; nao escreva. */
  @field('criado_por') criadoPor!: string | null;

  @relation('cidade', 'cidade_id') cidade!: Relation<Cidade>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /**
   * Se este usuario pode corrigir o registro.
   *
   * Consulte antes de mostrar o botao de editar: a policy so aceita alteracao
   * de quem criou, e um push recusado fica preso na fila do WatermelonDB,
   * tentando subir de novo a cada sync.
   */
  podeEditar(pilotoId: string): boolean {
    return this.criadoPor === pilotoId;
  }
}
