-- =============================================================================
-- CARGA CERTA | 02 - Row Level Security
--
-- No Supabase a anon key fica embutida no APK e qualquer um extrai dela. RLS
-- nao e hardening opcional: e o unico controle de acesso entre o React Native
-- e o banco, porque o cliente fala com o PostgREST sem backend no meio.
--
-- Convencao de performance: auth.uid() sempre dentro de (select ...), para o
-- planner avaliar uma vez como InitPlan em vez de uma vez por linha.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Habilitar RLS em todas as tabelas do schema public
-- -----------------------------------------------------------------------------

do $$
declare
    t text;
begin
    for t in
        select table_name
        from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
    loop
        execute format('alter table public.%I enable row level security', t);
        -- Vale inclusive para o dono da tabela, fechando a brecha de acesso
        -- via funcoes SECURITY DEFINER mal escritas
        execute format('alter table public.%I force row level security', t);
    end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Catalogos: leitura para autenticados, escrita so via service_role
--
-- service_role ignora RLS por definicao, entao nao precisa de policy propria.
--
-- A policy NAO filtra `deleted_at is null`, por dois motivos que so aparecem
-- quando o sync entra em cena:
--
--   1. Exclusao logica ficaria impossivel. Num UPDATE, o Postgres exige que a
--      linha resultante continue visivel sob as policies de SELECT. Gravar
--      deleted_at torna a linha invisivel para ela mesma, e o comando falha com
--      "new row violates row-level security policy".
--
--   2. A exclusao nunca se propagaria. `pull_changes` monta a lista `deleted`
--      lendo justamente as linhas com deleted_at preenchido - que a policy
--      esconderia. O registro sumiria num aparelho e continuaria nos outros.
--
-- As tabelas do piloto (secao 4) ja funcionam assim. Quem filtra registro
-- excluido e a consulta do app, nao a policy.
-- -----------------------------------------------------------------------------

do $$
declare
    t text;
begin
    foreach t in array array[
        'cidade', 'tipo_veiculo', 'tipo_documento', 'tipo_carga',
        'condicao_trajeto', 'estabelecimento'
    ]
    loop
        execute format(
            'create policy "%1$s_select" on public.%1$I
             for select to authenticated
             using (true)', t
        );
    end loop;
end;
$$;

-- Estabelecimento e o unico catalogo que o usuario alimenta: ao registrar um
-- abastecimento num posto ainda nao cadastrado, ele cria a linha. Todo mundo
-- enxerga o posto criado por qualquer um, mas so o autor corrige o proprio.
--
-- O `criado_por` do INSERT nao vem do cliente - a coluna tem DEFAULT auth.uid()
-- e o check existe para rejeitar quem tentar mandar o id de outra pessoa.
create policy "estabelecimento_insert" on public.estabelecimento
for insert to authenticated
with check (criado_por = (select auth.uid()));

create policy "estabelecimento_update" on public.estabelecimento
for update to authenticated
using (criado_por = (select auth.uid()))
with check (criado_por = (select auth.uid()));

create policy "estabelecimento_delete" on public.estabelecimento
for delete to authenticated
using (criado_por = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 3. Perfil
-- -----------------------------------------------------------------------------

create policy "piloto_select" on public.piloto
for select to authenticated
using (id = (select auth.uid()));

create policy "piloto_update" on public.piloto
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- A linha nasce pela trigger on_auth_user_created, entao esta policy nunca
-- insere nada de fato. Ela existe porque a RPC de push grava com
-- `insert ... on conflict (id) do update`, e o Postgres exige policy de INSERT
-- para o comando mesmo quando a execucao cai no caminho do UPDATE. Sem ela, o
-- motorista nao consegue sincronizar nome, telefone nem foto de perfil.
create policy "piloto_insert" on public.piloto
for insert to authenticated
with check (id = (select auth.uid()));

-- Sem policy de DELETE: a exclusao da conta passa pelo auth.users.

-- -----------------------------------------------------------------------------
-- 4. Dados do piloto
--
-- Todas as tabelas tem piloto_id proprio (denormalizado justamente para isso):
-- a policy vira um filtro indexado, sem EXISTS nem join por linha.
-- -----------------------------------------------------------------------------

do $$
declare
    t text;
begin
    foreach t in array array[
        'cnh', 'veiculo', 'documento_veiculo',
        'contratante', 'frete', 'viagem', 'carga', 'parada',
        'despesa', 'abastecimento', 'manutencao', 'receita', 'fechamento_viagem'
    ]
    loop
        execute format(
            'create policy "%1$s_select" on public.%1$I
             for select to authenticated
             using (piloto_id = (select auth.uid()))', t
        );

        execute format(
            'create policy "%1$s_insert" on public.%1$I
             for insert to authenticated
             with check (piloto_id = (select auth.uid()))', t
        );

        execute format(
            'create policy "%1$s_update" on public.%1$I
             for update to authenticated
             using (piloto_id = (select auth.uid()))
             with check (piloto_id = (select auth.uid()))', t
        );

        -- DELETE fisico existe, mas o app usa exclusao logica (deleted_at):
        -- um DELETE real feito offline nunca chegaria aos outros dispositivos.
        execute format(
            'create policy "%1$s_delete" on public.%1$I
             for delete to authenticated
             using (piloto_id = (select auth.uid()))', t
        );
    end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Categorias de despesa
--
-- Caso hibrido: as padrao (piloto_id nulo) sao visiveis para todos e imutaveis;
-- as do usuario sao dele.
-- -----------------------------------------------------------------------------

-- Sem `deleted_at is null` pelo mesmo motivo da secao 2: com o filtro, o
-- usuario nao consegue apagar a propria categoria e a exclusao nao se propaga.
create policy "categoria_despesa_select" on public.categoria_despesa
for select to authenticated
using (piloto_id is null or piloto_id = (select auth.uid()));

create policy "categoria_despesa_insert" on public.categoria_despesa
for insert to authenticated
with check (piloto_id = (select auth.uid()) and is_padrao = false);

create policy "categoria_despesa_update" on public.categoria_despesa
for update to authenticated
using (piloto_id = (select auth.uid()))
with check (piloto_id = (select auth.uid()) and is_padrao = false);

create policy "categoria_despesa_delete" on public.categoria_despesa
for delete to authenticated
using (piloto_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 6. Grants
--
-- RLS filtra linhas, mas quem decide se a role enxerga a tabela e o GRANT.
-- anon so precisa do fluxo de autenticacao, entao nao recebe nada aqui.
-- -----------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.vw_resultado_viagem to authenticated;

alter default privileges in schema public
    grant select, insert, update, delete on tables to authenticated;
