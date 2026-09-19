# Carga Certa

Controle de gastos de frete para caminhoneiro autonomo. Registra despesa do
caminhao e do motorista, dentro ou fora de viagem, e fecha o resultado de cada
frete: lucro, custo por km e consumo.

O app de campo funciona sem sinal. Isso e o requisito que molda toda a
arquitetura: o dado nasce no aparelho, em SQLite, e sobe quando a rede volta.

## Estrutura

```
apps/
  web/                 (a criar) React + Vite, online, fala direto com o Supabase
  mobile/              (a criar) Expo + dev build, offline-first via WatermelonDB
packages/
  shared/              regra de negocio pura: enums, validacao, calculos, formatacao
  database/            WatermelonDB: schema, models e o protocolo de sync
supabase/
  migrations/          4 migrations: schema, RLS, storage, RPCs de sync
  seed.sql             catalogos (tipos de veiculo, categorias padrao, ...)
```

O pacote `shared` nao depende de React, de React Native nem do Supabase. E o que
permite `calcularResultadoViagem()` rodar igual nos dois apps e num teste em Node.

## Como rodar

```powershell
corepack pnpm install
corepack pnpm test         # 56 testes, sem rede e sem banco
corepack pnpm typecheck
```

O `corepack` vem com o Node e dispensa instalar o pnpm globalmente. Depois de
`corepack enable` (uma vez, como administrador no Windows), `pnpm` funciona
direto, sem o prefixo.

Para o banco, e preciso a CLI do Supabase e o Docker:

```powershell
supabase start
supabase db reset          # aplica migrations + seed
corepack pnpm db:types     # gera packages/shared/src/database.types.ts
```

## O que o codigo do app precisa saber

Estas quatro decisoes estao no banco e nao sao negociaveis do lado do cliente.
A explicacao completa esta em [supabase/README.md](supabase/README.md).

**`piloto_id` nao existe no cliente.** O servidor preenche por
`DEFAULT auth.uid()` no push e remove o campo no pull. O banco local e de um
usuario so, entao "as despesas do piloto" sao todas as despesas. Some junto a
classe de ataque em que o cliente forja o dono do registro.

**Exclusao e logica.** `markAsDeleted()`, nunca `destroyPermanently()`. Um delete
fisico feito offline nao deixa linha para sincronizar e sumiria so naquele
aparelho.

**O relogio que vale e o do servidor.** `created_at` e `updated_at` enviados pelo
cliente sao descartados no push. Celular em estrada, trocando de fuso e sem
sinal, nao tem relogio confiavel.

**Comprovante guarda o caminho, nunca a URL.** O caminho comeca com o id do
usuario, porque a policy do Storage valida o primeiro segmento. Monte sempre com
`caminhoComprovante()` do pacote `shared`. Upload e o unico passo que nao
funciona offline: salve o caminho esperado na despesa e suba a foto depois.

## Convencoes

**IDs sao UUID v7, gerados no cliente.** `criarDatabase()` ja troca o gerador do
WatermelonDB. Sao ordenaveis por tempo, entao um lote de despesas de uma viagem
cai em paginas vizinhas do indice em vez de fragmentar a PK.

**Valores monetarios somam com `somar()`**, que acumula em centavos inteiros.
Somar `numeric` em ponto flutuante faz o total do app divergir do total da view
do banco em centavos - e o usuario perde a confianca no aplicativo inteiro.

**Instantes viram epoch ms no cliente e ISO no servidor.** A conversao esta em
`packages/database/src/normalize.ts` e e dirigida por `COLUNAS_INSTANTE`. Coluna
`date` (validade de CNH, por exemplo) fica como texto `AAAA-MM-DD` dos dois
lados: transformar em instante faz o vencimento mudar de dia na divisa de fuso.

**Mudar `schema.ts` exige subir a `version` e escrever a migration.** Sem a
migration o WatermelonDB apaga o banco do aparelho e recria - levando junto o que
ainda nao tinha subido.

## Sincronizacao

```ts
import { sincronizar } from '@carga-certa/database';

await sincronizar(database, supabase);
```

Chame em tres momentos: ao abrir o app, ao recuperar conexao
(`NetInfo.addEventListener`) e depois de gravar algo relevante. A funcao tem
trava de concorrencia - os tres gatilhos disparam juntos com facilidade.

## Limitacoes conhecidas

Conflito resolve por last-write-wins **por registro**, nao por campo. Dois
aparelhos editando a mesma despesa: a ultima escrita vence e a outra se perde.
Para um caminhoneiro com um celular, nao acontece.

O pull tem janela de seguranca de 1 segundo: alteracoes do ultimo segundo ficam
para o proximo sync. Sem a margem, uma transacao que commita depois da leitura
ficaria invisivel para sempre.

`cidade` sao ~5.570 linhas do IBGE e nao estao no seed. Antes do primeiro
release, decida entre empacotar o JSON no app (e tirar `cidade` de
`sync_tables()`) ou carregar no Supabase e aceitar um pull inicial maior.
