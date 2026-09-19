import { Cidade, CondicaoTrajeto, Estabelecimento, TipoCarga, TipoDocumento, TipoVeiculo } from './catalogos';
import { Cnh, Piloto } from './perfil';
import { DocumentoVeiculo, Veiculo } from './frota';
import { Carga, Contratante, Frete, Parada, Viagem } from './operacao';
import {
  Abastecimento,
  CategoriaDespesa,
  Despesa,
  FechamentoViagem,
  Manutencao,
  Receita,
} from './financeiro';

export * from './catalogos';
export * from './perfil';
export * from './frota';
export * from './operacao';
export * from './financeiro';

/**
 * Todos os models, na ordem em que o Database os registra.
 *
 * A lista tem que cobrir exatamente as tabelas do `schema`. Uma tabela sem model
 * so aparece no erro quando o sync tenta grava-la - ou seja, em campo.
 */
export const models = [
  // Catalogos
  Cidade,
  TipoVeiculo,
  TipoDocumento,
  TipoCarga,
  CondicaoTrajeto,
  Estabelecimento,
  // Perfil e frota
  Piloto,
  Cnh,
  Veiculo,
  DocumentoVeiculo,
  // Operacao
  Contratante,
  Frete,
  Viagem,
  Carga,
  Parada,
  // Financeiro
  CategoriaDespesa,
  Despesa,
  Abastecimento,
  Manutencao,
  Receita,
  FechamentoViagem,
] as const;
