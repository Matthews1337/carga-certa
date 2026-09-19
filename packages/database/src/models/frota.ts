import { Model } from '@nozbe/watermelondb';
import { children, date, field, readonly, relation, text } from '@nozbe/watermelondb/decorators';
import type Query from '@nozbe/watermelondb/Query';
import type Relation from '@nozbe/watermelondb/Relation';
import type { Associations } from '@nozbe/watermelondb/Model';
import {
  formatarPlaca,
  situacaoVencimento,
  type CarroceriaVeiculo,
  type NaturezaVeiculo,
  type SituacaoVencimento,
} from '@carga-certa/shared';

import type { TipoDocumento, TipoVeiculo } from './catalogos';
import { dataLocal } from './perfil';

export class Veiculo extends Model {
  static override table = 'veiculo';

  static override associations: Associations = {
    tipo_veiculo: { type: 'belongs_to', key: 'tipo_veiculo_id' },
    documento_veiculo: { type: 'has_many', foreignKey: 'veiculo_id' },
    despesa: { type: 'has_many', foreignKey: 'veiculo_id' },
    manutencao: { type: 'has_many', foreignKey: 'veiculo_id' },
  };

  /**
   * Denormalizado de tipo_veiculo. No servidor uma FK composta garante que os
   * dois batem; aqui e so leitura, entao nao ha o que divergir.
   */
  @field('natureza') natureza!: NaturezaVeiculo;
  @field('carroceria') carroceria!: CarroceriaVeiculo;
  @text('placa') placa!: string;
  @text('renavam') renavam!: string | null;
  @text('marca') marca!: string | null;
  @text('modelo') modelo!: string | null;
  @field('ano') ano!: number | null;
  @text('cor') cor!: string | null;
  @field('capacidade_kg') capacidadeKg!: number | null;
  @field('qtd_eixos') qtdEixos!: number | null;
  /** Maior odometro ja registrado. O servidor atualiza por trigger no abastecimento. */
  @field('odometro_atual') odometroAtual!: number;
  @field('ativo') ativo!: boolean;

  @relation('tipo_veiculo', 'tipo_veiculo_id') tipoVeiculo!: Relation<TipoVeiculo>;
  @children('documento_veiculo') documentos!: Query<DocumentoVeiculo>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  get placaFormatada(): string {
    return formatarPlaca(this.placa);
  }

  /** "Scania R450 - RTA1B23", ou so a placa quando marca e modelo faltam. */
  get descricaoCurta(): string {
    const nome = [this.marca, this.modelo].filter(Boolean).join(' ');
    return nome ? `${nome} - ${this.placaFormatada}` : this.placaFormatada;
  }
}

export class DocumentoVeiculo extends Model {
  static override table = 'documento_veiculo';

  static override associations: Associations = {
    veiculo: { type: 'belongs_to', key: 'veiculo_id' },
    tipo_documento: { type: 'belongs_to', key: 'tipo_documento_id' },
  };

  @text('numero') numero!: string | null;
  /** 'AAAA-MM-DD'. */
  @text('emissao') emissao!: string | null;
  /** 'AAAA-MM-DD'. */
  @text('validade') validade!: string | null;
  @text('arquivo_path') arquivoPath!: string | null;

  @relation('veiculo', 'veiculo_id') veiculo!: Relation<Veiculo>;
  @relation('tipo_documento', 'tipo_documento_id') tipoDocumento!: Relation<TipoDocumento>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  get validadeEmData(): Date | null {
    return this.validade ? dataLocal(this.validade) : null;
  }

  get situacao(): SituacaoVencimento | null {
    return situacaoVencimento(this.validadeEmData);
  }
}
