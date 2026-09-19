import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, text } from '@nozbe/watermelondb/decorators';
import { diasAte, situacaoVencimento, type SituacaoVencimento } from '@carga-certa/shared';

/**
 * Perfil do usuario e sua CNH.
 *
 * Nenhum dos dois declara association com o resto do banco, e nao e esquecimento:
 * `piloto_id` nao existe no cliente. O banco local pertence a um usuario so,
 * entao "as despesas do piloto" sao simplesmente todas as despesas. A unica
 * linha de `piloto` aqui e a do dono do aparelho, e seu id e o mesmo de
 * `auth.users`.
 */

export class Piloto extends Model {
  static override table = 'piloto';

  @text('nome') nome!: string;
  @text('email') email!: string | null;
  @text('cpf') cpf!: string | null;
  @text('telefone') telefone!: string | null;
  /** 'AAAA-MM-DD'. Data sem hora nao vira epoch - ver COLUNAS_DATA no schema. */
  @text('data_nascimento') dataNascimento!: string | null;
  @text('sexo') sexo!: string | null;
  /** Caminho no bucket, nunca URL. */
  @text('foto_path') fotoPath!: string | null;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}

/**
 * Le 'AAAA-MM-DD' como data local.
 *
 * `new Date('2030-04-12')` interpreta a string como meia-noite UTC, que no
 * horario de Brasilia e dia 11 as 21h. Um documento venceria um dia antes na
 * tela - e o app existe justamente para o motorista nao ser pego por isso.
 */
export function dataLocal(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano ?? 1970, (mes ?? 1) - 1, dia ?? 1);
}

export class Cnh extends Model {
  static override table = 'cnh';

  @text('numero') numero!: string;
  @text('categoria') categoria!: string;
  /** 'AAAA-MM-DD'. */
  @text('validade') validade!: string;
  /** Exerce Atividade Remunerada: exigido para dirigir profissionalmente. */
  @field('ear') ear!: boolean;
  @text('arquivo_path') arquivoPath!: string | null;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  get validadeEmData(): Date {
    return dataLocal(this.validade);
  }

  get situacao(): SituacaoVencimento | null {
    return situacaoVencimento(this.validadeEmData);
  }

  get diasParaVencer(): number {
    return diasAte(this.validadeEmData);
  }
}
