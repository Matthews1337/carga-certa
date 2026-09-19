# Carga Certa — Banco de dados (Supabase + WatermelonDB)

Migrations do backend do MVP: 21 tabelas, RLS completa, Storage e o protocolo de
sincronização offline consumido pelo app React Native.

```
supabase/
├── migrations/
│   ├── 20260919120000_init_schema.sql   # enums, tabelas, índices, triggers, view
│   ├── 20260919120100_rls.sql           # RLS e policies
│   ├── 20260919120200_storage.sql       # buckets e policies de arquivo
│   └── 20260919120300_sync_watermelondb.sql  # RPC pull_changes / push_changes
└── seed.sql                             # catálogos
```

## Aplicando

```bash
supabase init
supabase start
supabase db reset        # aplica migrations + seed
supabase db push         # envia para o projeto remoto
```

Tipos do TypeScript saem direto do schema, compartilhados entre web e mobile:

```bash
supabase gen types typescript --local > packages/shared/src/database.types.ts
```

Os `ENUM` viram union types automaticamente — `status_viagem` vira
`'PLANEJADA' | 'EM_ANDAMENTO' | ...`.

## Decisões que afetam o código do app

### `piloto_id` não existe no cliente

O servidor preenche por `DEFAULT auth.uid()` no push e remove o campo no pull.
O banco local é de um usuário só, então o app não perde nada, e some a classe
inteira de ataque em que o cliente forja o dono do registro. **Não declare
`piloto_id` no schema do WatermelonDB.**

### Exclusão é lógica

O app nunca manda `DELETE`. `markAsDeleted()` do WatermelonDB vira `deleted_at`
no servidor. Um delete físico feito offline não teria linha para sincronizar e
sumiria só naquele aparelho.

### O relógio que vale é o do servidor

`created_at` e `updated_at` enviados pelo cliente são descartados no push.
Celular em estrada, sem sinal e trocando de fuso, não tem relógio confiável.

### Comprovantes

`despesa.comprovante_path` guarda o caminho no bucket, nunca a URL. O caminho
precisa começar com o id do usuário, porque a policy valida o primeiro segmento:

```ts
const path = `${user.id}/${despesaId}.jpg`;
await supabase.storage.from('comprovantes').upload(path, file);
// na exibição:
const { data } = await supabase.storage.from('comprovantes').createSignedUrl(path, 3600);
```

Upload é o único passo que não funciona offline. Guarde o arquivo local, salve o
path esperado na despesa e suba a foto quando a rede voltar.

## Schema do cliente (WatermelonDB)

Espelhe as colunas do servidor, menos `piloto_id` e `deleted_at`:

```ts
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'despesa',
      columns: [
        { name: 'viagem_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'veiculo_id', type: 'string', isOptional: true },
        { name: 'categoria_id', type: 'string', isIndexed: true },
        { name: 'valor', type: 'number' },
        { name: 'data_hora', type: 'string' },
        { name: 'forma_pagamento', type: 'string' },
        { name: 'descricao', type: 'string', isOptional: true },
        { name: 'comprovante_path', type: 'string', isOptional: true },
        { name: 'latitude', type: 'number', isOptional: true },
        { name: 'longitude', type: 'number', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    // ... demais tabelas de public.sync_tables()
  ],
});
```

Gere os IDs no cliente com UUID v7 para casar com a PK do servidor.
`numeric` do Postgres chega como string no JSON — converta no model.

## Sincronização

```ts
import { synchronize } from '@nozbe/watermelondb/sync';

export async function sync(database) {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => {
      const { data, error } = await supabase.rpc('pull_changes', {
        last_pulled_at: lastPulledAt,
      });
      if (error) throw error;
      return { changes: data.changes, timestamp: data.timestamp };
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      const { error } = await supabase.rpc('push_changes', {
        changes,
        last_pulled_at: lastPulledAt,
      });
      if (error) throw error;
    },
  });
}
```

Chame em três momentos: ao abrir o app, ao recuperar conexão
(`NetInfo.addEventListener`) e depois de gravar algo relevante.

## Carga das cidades

`cidade` está no pull mas fora do seed: são cerca de 5.570 linhas do IBGE e o
primeiro sync ficaria pesado. Duas opções, nesta ordem de preferência para o MVP:

1. Empacotar o JSON do IBGE no app e popular o SQLite local na primeira abertura,
   tirando `cidade` de `sync_tables()`.
2. Carregar no Supabase com a service_role key e aceitar o pull inicial maior.

## Limitações conhecidas

**Resolução de conflito é last-write-wins por registro, não por campo.** Dois
aparelhos editando a mesma despesa: a última escrita vence e a outra se perde.
Para um caminhoneiro autônomo com um celular, isso praticamente não acontece.
Se aparecer, a saída é LWW por campo usando o `_changed` do WatermelonDB.

**O pull tem uma janela de segurança de 1 segundo.** Alterações do último
segundo ficam para o próximo sync. Sem essa margem, uma transação que commita
depois da leitura ficaria invisível para sempre.

**`push_changes` não valida o `last_pulled_at`.** Recebe o parâmetro por
compatibilidade de assinatura, mas não rejeita push de cliente desatualizado.
Para o MVP é aceitável; com múltiplos dispositivos, vale implementar.

**Validação de CPF e CNPJ é só de formato.** Dígito verificador é regra de
negócio e fica no pacote compartilhado entre web e mobile.

## Verificação

As quatro migrations foram aplicadas num PostgreSQL 16 com `auth` e `storage`
emulados, e os seguintes cenários testados: criação de perfil pela trigger,
`piloto_id` preenchido sozinho, isolamento entre dois usuários, bloqueio de
referência cruzada entre donos, pull inicial, push com `piloto_id` forjado
(ignorado), reenvio do mesmo lote (idempotente), exclusão lógica e tentativa de
escrita em tabela fora da whitelist (rejeitada).
