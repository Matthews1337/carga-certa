import { appSchema, tableSchema } from '@nozbe/watermelondb';

/**
 * Schema do SQLite local, espelhando supabase/migrations/20260919120000_init_schema.sql.
 *
 * Tres regras governam o que entra aqui:
 *
 * 1. `piloto_id` NAO existe no cliente. O servidor preenche por
 *    `DEFAULT auth.uid()` no push e remove o campo no pull. O banco local e de
 *    um usuario so, entao o app nao perde nada, e o cliente fica sem como forjar
 *    o dono de um registro. Declarar a coluna aqui faria o push mandar um campo
 *    que o servidor descarta - inofensivo, mas convida alguem a confiar nele.
 *
 * 2. `deleted_at` NAO existe no cliente. Exclusao logica e do servidor; no
 *    cliente quem faz o papel e o `_status: 'deleted'` do proprio WatermelonDB,
 *    via `markAsDeleted()`.
 *
 * 3. `created_at` e `updated_at` sao `number` (epoch ms). O servidor ja converte
 *    na RPC de pull; os demais timestamptz chegam como texto ISO e sao
 *    convertidos aqui pelo normalizador - ver COLUNAS_INSTANTE.
 *
 * Toda mudanca de coluna exige subir `version` e escrever o migration
 * correspondente em migrations.ts. Sem isso o WatermelonDB apaga o banco local
 * do aparelho - e o que estava offline esperando sync vai junto.
 */

// -----------------------------------------------------------------------------
// Metadados de conversao
// -----------------------------------------------------------------------------

/**
 * Colunas `timestamptz` alem de created_at/updated_at.
 *
 * Chegam do PostgREST como ISO 8601 com offset ("2026-09-19T12:00:00+00:00").
 * Guardar o texto cru pareceria mais simples, mas quebra ordenacao: duas linhas
 * gravadas no mesmo instante com offsets diferentes ordenam errado em
 * comparacao lexicografica, e "ultimas despesas" e a tela mais usada do app.
 * Por isso viram epoch ms na entrada e voltam a ISO na saida.
 */
export const COLUNAS_INSTANTE: Readonly<Record<string, readonly string[]>> = {
  viagem: ['inicio_em', 'fim_em'],
  parada: ['chegada_em', 'saida_em'],
  despesa: ['data_hora'],
  receita: ['recebido_em'],
  fechamento_viagem: ['calculado_em'],
};

/**
 * Colunas `date` (sem hora). Ficam como texto 'AAAA-MM-DD' nos dois lados.
 *
 * Converter para epoch aqui seria um erro: "validade da CNH em 2030-04-12" nao
 * tem hora nem fuso, e transformar em instante faz o vencimento mudar de dia
 * conforme o aparelho atravessa a divisa de fuso no meio do Brasil.
 */
export const COLUNAS_DATA: Readonly<Record<string, readonly string[]>> = {
  piloto: ['data_nascimento'],
  cnh: ['validade'],
  documento_veiculo: ['emissao', 'validade'],
  manutencao: ['proxima_data'],
};

/** Espelha `public.sync_tables()`. A ordem e irrelevante; a lista nao. */
export const TABELAS_SINCRONIZADAS = [
  'piloto',
  'cnh',
  'veiculo',
  'documento_veiculo',
  'contratante',
  'frete',
  'viagem',
  'carga',
  'parada',
  'categoria_despesa',
  'despesa',
  'abastecimento',
  'manutencao',
  'receita',
  'fechamento_viagem',
  'tipo_veiculo',
  'tipo_documento',
  'tipo_carga',
  'condicao_trajeto',
  'estabelecimento',
  'cidade',
] as const;

/** Espelha `public.sync_writable_tables()`. */
export const TABELAS_GRAVAVEIS = [
  'piloto',
  'cnh',
  'veiculo',
  'documento_veiculo',
  'contratante',
  'frete',
  'viagem',
  'carga',
  'parada',
  'categoria_despesa',
  'despesa',
  'abastecimento',
  'manutencao',
  'receita',
  'fechamento_viagem',
  'estabelecimento',
] as const;

export type TabelaSincronizada = (typeof TABELAS_SINCRONIZADAS)[number];

// Presente em toda tabela; repetido por tabela porque o appSchema pede lista literal.
const timestamps = [
  { name: 'created_at', type: 'number' },
  { name: 'updated_at', type: 'number' },
] as const;

// -----------------------------------------------------------------------------
// Schema
// -----------------------------------------------------------------------------

export const schema = appSchema({
  version: 1,
  tables: [
    // ---------------------------------------------------------------------
    // Catalogos: descem no pull, so o estabelecimento sobe no push
    // ---------------------------------------------------------------------
    tableSchema({
      name: 'cidade',
      columns: [
        { name: 'codigo_ibge', type: 'number', isIndexed: true },
        { name: 'nome', type: 'string', isIndexed: true },
        { name: 'uf', type: 'string', isIndexed: true },
        { name: 'latitude', type: 'number', isOptional: true },
        { name: 'longitude', type: 'number', isOptional: true },
        ...timestamps,
      ],
    }),

    tableSchema({
      name: 'tipo_veiculo',
      columns: [
        { name: 'nome', type: 'string' },
        { name: 'natureza', type: 'string', isIndexed: true },
        { name: 'qtd_eixos', type: 'number', isOptional: true },
        { name: 'capacidade_kg_ref', type: 'number', isOptional: true },
        { name: 'categoria_cnh_minima', type: 'string', isOptional: true },
        { name: 'ordem', type: 'number' },
        { name: 'ativo', type: 'boolean' },
        ...timestamps,
      ],
    }),

    tableSchema({
      name: 'tipo_documento',
      columns: [
        { name: 'nome', type: 'string' },
        { name: 'aplica_se_a', type: 'string', isIndexed: true },
        { name: 'periodicidade_meses', type: 'number', isOptional: true },
        { name: 'obrigatorio', type: 'boolean' },
        { name: 'ativo', type: 'boolean' },
        ...timestamps,
      ],
    }),

    tableSchema({
      name: 'tipo_carga',
      columns: [
        { name: 'nome', type: 'string' },
        { name: 'descricao', type: 'string', isOptional: true },
        { name: 'perigosa', type: 'boolean' },
        { name: 'refrigerada', type: 'boolean' },
        { name: 'ativo', type: 'boolean' },
        ...timestamps,
      ],
    }),

    tableSchema({
      name: 'condicao_trajeto',
      columns: [
        { name: 'condicao', type: 'string' },
        { name: 'descricao', type: 'string', isOptional: true },
        { name: 'ativo', type: 'boolean' },
        ...timestamps,
      ],
    }),

    tableSchema({
      name: 'estabelecimento',
      columns: [
        { name: 'cidade_id', type: 'string', isOptional: true, isIndexed: true },
        // Diferente das outras tabelas, este id de usuario desce para o
        // cliente: o catalogo e compartilhado e o app precisa saber se o posto
        // e editavel. O servidor preenche por DEFAULT auth.uid() e a policy
        // rejeita qualquer outro valor.
        { name: 'criado_por', type: 'string', isOptional: true, isIndexed: true },
        { name: 'nome', type: 'string', isIndexed: true },
        { name: 'cnpj', type: 'string', isOptional: true },
        { name: 'tipo', type: 'string', isIndexed: true },
        { name: 'latitude', type: 'number', isOptional: true },
        { name: 'longitude', type: 'number', isOptional: true },
        ...timestamps,
      ],
    }),

    // ---------------------------------------------------------------------
    // Perfil e frota
    // ---------------------------------------------------------------------
    tableSchema({
      name: 'piloto',
      columns: [
        { name: 'nome', type: 'string' },
        { name: 'email', type: 'string', isOptional: true },
        { name: 'cpf', type: 'string', isOptional: true },
        { name: 'telefone', type: 'string', isOptional: true },
        { name: 'data_nascimento', type: 'string', isOptional: true },
        { name: 'sexo', type: 'string', isOptional: true },
        { name: 'foto_path', type: 'string', isOptional: true },
        ...timestamps,
      ],
    }),

    tableSchema({
      name: 'cnh',
      columns: [
        { name: 'numero', type: 'string' },
        { name: 'categoria', type: 'string' },
        { name: 'validade', type: 'string', isIndexed: true },
        { name: 'ear', type: 'boolean' },
        { name: 'arquivo_path', type: 'string', isOptional: true },
        ...timestamps,
      ],
    }),

    tableSchema({
      name: 'veiculo',
      columns: [
        { name: 'tipo_veiculo_id', type: 'string', isIndexed: true },
        { name: 'natureza', type: 'string', isIndexed: true },
        { name: 'carroceria', type: 'string' },
        { name: 'placa', type: 'string', isIndexed: true },
        { name: 'renavam', type: 'string', isOptional: true },
        { name: 'marca', type: 'string', isOptional: true },
        { name: 'modelo', type: 'string', isOptional: true },
        { name: 'ano', type: 'number', isOptional: true },
        { name: 'cor', type: 'string', isOptional: true },
        { name: 'capacidade_kg', type: 'number', isOptional: true },
        { name: 'qtd_eixos', type: 'number', isOptional: true },
        { name: 'odometro_atual', type: 'number' },
        { name: 'ativo', type: 'boolean', isIndexed: true },
        ...timestamps,
      ],
    }),

    tableSchema({
      name: 'documento_veiculo',
      columns: [
        { name: 'veiculo_id', type: 'string', isIndexed: true },
        { name: 'tipo_documento_id', type: 'string', isIndexed: true },
        { name: 'numero', type: 'string', isOptional: true },
        { name: 'emissao', type: 'string', isOptional: true },
        { name: 'validade', type: 'string', isOptional: true, isIndexed: true },
        { name: 'arquivo_path', type: 'string', isOptional: true },
        ...timestamps,
      ],
    }),

    // ---------------------------------------------------------------------
    // Operacao
    // ---------------------------------------------------------------------
    tableSchema({
      name: 'contratante',
      columns: [
        { name: 'nome', type: 'string', isIndexed: true },
        { name: 'cnpj', type: 'string', isOptional: true },
        { name: 'contato', type: 'string', isOptional: true },
        { name: 'telefone', type: 'string', isOptional: true },
        ...timestamps,
      ],
    }),

    tableSchema({
      name: 'frete',
      columns: [
        { name: 'contratante_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'codigo', type: 'string', isOptional: true },
        { name: 'valor_total', type: 'number' },
        { name: 'valor_tonelada', type: 'number', isOptional: true },
        { name: 'pedagio_por_conta', type: 'string' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'observacao', type: 'string', isOptional: true },
        ...timestamps,
      ],
    }),

    tableSchema({
      name: 'viagem',
      columns: [
        { name: 'frete_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'veiculo_tracao_id', type: 'string', isIndexed: true },
        { name: 'veiculo_reboque_id', type: 'string', isOptional: true },
        { name: 'condicao_trajeto_id', type: 'string', isOptional: true },
        { name: 'cidade_origem_id', type: 'string', isOptional: true },
        { name: 'cidade_destino_id', type: 'string', isOptional: true },
        { name: 'inicio_em', type: 'number', isOptional: true, isIndexed: true },
        { name: 'fim_em', type: 'number', isOptional: true },
        { name: 'odometro_inicial', type: 'number', isOptional: true },
        { name: 'odometro_final', type: 'number', isOptional: true },
        // Coluna gerada no servidor. Desce no pull e sobe no push, mas o push
        // descarta colunas geradas (filtro `is_generated = 'NEVER'`), entao
        // reenviar e inofensivo. Ter o valor local evita recalcular na listagem.
        { name: 'km_total', type: 'number', isOptional: true },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'observacao', type: 'string', isOptional: true },
        ...timestamps,
      ],
    }),

    tableSchema({
      name: 'carga',
      columns: [
        { name: 'frete_id', type: 'string', isIndexed: true },
        { name: 'tipo_carga_id', type: 'string', isOptional: true },
        { name: 'peso_kg', type: 'number', isOptional: true },
        { name: 'valor_mercadoria', type: 'number', isOptional: true },
        { name: 'descricao', type: 'string', isOptional: true },
        ...timestamps,
      ],
    }),

    tableSchema({
      name: 'parada',
      columns: [
        { name: 'viagem_id', type: 'string', isIndexed: true },
        { name: 'cidade_id', type: 'string', isOptional: true },
        { name: 'ordem', type: 'number' },
        { name: 'tipo', type: 'string' },
        { name: 'chegada_em', type: 'number', isOptional: true },
        { name: 'saida_em', type: 'number', isOptional: true },
        { name: 'odometro', type: 'number', isOptional: true },
        { name: 'observacao', type: 'string', isOptional: true },
        ...timestamps,
      ],
    }),

    // ---------------------------------------------------------------------
    // Financeiro
    // ---------------------------------------------------------------------
    tableSchema({
      name: 'categoria_despesa',
      columns: [
        { name: 'categoria_pai_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'nome', type: 'string' },
        { name: 'escopo', type: 'string', isIndexed: true },
        { name: 'dedutivel', type: 'boolean' },
        // Substitui `piloto_id is null` do servidor: com piloto_id fora do
        // cliente, e este campo que diz se a categoria e do sistema (imutavel)
        // ou criada pelo usuario.
        { name: 'is_padrao', type: 'boolean', isIndexed: true },
        { name: 'icone', type: 'string', isOptional: true },
        { name: 'ordem', type: 'number' },
        { name: 'ativo', type: 'boolean' },
        ...timestamps,
      ],
    }),

    tableSchema({
      name: 'despesa',
      columns: [
        // NULO = gasto fora de frete. E este campo que permite gasto por piloto
        // e gasto por viagem conviverem na mesma tabela.
        { name: 'viagem_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'veiculo_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'categoria_id', type: 'string', isIndexed: true },
        { name: 'valor', type: 'number' },
        { name: 'data_hora', type: 'number', isIndexed: true },
        { name: 'forma_pagamento', type: 'string' },
        { name: 'descricao', type: 'string', isOptional: true },
        // Caminho no bucket, nunca URL. A URL assinada e gerada na exibicao.
        { name: 'comprovante_path', type: 'string', isOptional: true },
        { name: 'latitude', type: 'number', isOptional: true },
        { name: 'longitude', type: 'number', isOptional: true },
        { name: 'status', type: 'string', isIndexed: true },
        ...timestamps,
      ],
    }),

    tableSchema({
      name: 'abastecimento',
      columns: [
        { name: 'despesa_id', type: 'string', isIndexed: true },
        { name: 'estabelecimento_id', type: 'string', isOptional: true },
        { name: 'litros', type: 'number' },
        { name: 'preco_litro', type: 'number' },
        { name: 'odometro', type: 'number', isIndexed: true },
        { name: 'tanque_cheio', type: 'boolean' },
        { name: 'combustivel', type: 'string' },
        ...timestamps,
      ],
    }),

    tableSchema({
      name: 'manutencao',
      columns: [
        { name: 'despesa_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'veiculo_id', type: 'string', isIndexed: true },
        { name: 'oficina_id', type: 'string', isOptional: true },
        { name: 'tipo', type: 'string' },
        { name: 'item', type: 'string' },
        { name: 'odometro', type: 'number', isOptional: true },
        { name: 'proxima_odometro', type: 'number', isOptional: true, isIndexed: true },
        { name: 'proxima_data', type: 'string', isOptional: true, isIndexed: true },
        { name: 'observacao', type: 'string', isOptional: true },
        ...timestamps,
      ],
    }),

    tableSchema({
      name: 'receita',
      columns: [
        { name: 'frete_id', type: 'string', isIndexed: true },
        { name: 'tipo', type: 'string' },
        { name: 'valor', type: 'number' },
        { name: 'recebido_em', type: 'number', isOptional: true },
        { name: 'forma_recebimento', type: 'string' },
        { name: 'observacao', type: 'string', isOptional: true },
        ...timestamps,
      ],
    }),

    tableSchema({
      name: 'fechamento_viagem',
      columns: [
        { name: 'viagem_id', type: 'string', isIndexed: true },
        { name: 'receita_total', type: 'number' },
        { name: 'despesa_total', type: 'number' },
        { name: 'lucro_liquido', type: 'number' },
        { name: 'custo_por_km', type: 'number', isOptional: true },
        { name: 'consumo_medio', type: 'number', isOptional: true },
        { name: 'km_total', type: 'number', isOptional: true },
        { name: 'calculado_em', type: 'number' },
        ...timestamps,
      ],
    }),
  ],
});

/**
 * Colunas numericas por tabela, derivadas do proprio schema.
 *
 * Derivar em vez de manter uma lista a mao: a lista sairia de sincronia na
 * primeira coluna nova, e o sintoma seria um valor chegando como string e
 * virando "15001500" numa soma, em vez de 3000.
 */
export const COLUNAS_NUMERICAS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.entries(schema.tables).map(([nome, tabela]) => [
    nome,
    Object.values(tabela.columns)
      .filter((c) => c.type === 'number')
      .map((c) => c.name),
  ]),
);
