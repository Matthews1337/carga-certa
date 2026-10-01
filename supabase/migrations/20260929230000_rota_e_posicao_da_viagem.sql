-- =============================================================================
-- CARGA CERTA | Rota da viagem e posicoes do GPS (base dos fretes com mapa)
--
-- O web cadastra o frete marcando origem e destino num mapa; a Edge Function
-- `rotas` pergunta ao OpenRouteService a rota de caminhao e a distancia. O
-- celular grava o caminho percorrido, e o card do frete mostra onde o motorista
-- esta em relacao a rota.
--
-- Tres mudancas:
--   1. viagem ganha origem, destino, rota prevista e km previsto;
--   2. tabela posicao_viagem, que so SOBE do celular (fora do pull);
--   3. o push grava as tabelas em ordem de dependencia, e nao na ordem das
--      chaves do JSON.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Viagem: origem, destino e rota prevista
--
-- cidade_origem_id / cidade_destino_id continuam existindo, mas o mapa nao usa:
-- o ponto marcado e um endereco, um porto ou uma fazenda, nao uma cidade do IBGE
-- - e a tabela cidade ainda esta vazia.
-- -----------------------------------------------------------------------------

alter table public.viagem
    add column origem_nome   text,
    add column origem_lat    numeric(9, 6),
    add column origem_lng    numeric(9, 6),
    add column destino_nome  text,
    add column destino_lat   numeric(9, 6),
    add column destino_lng   numeric(9, 6),
    -- "Encoded polyline" (formato do Google), ja simplificada: poucos kB por
    -- rota. Ver packages/shared/src/polyline.ts.
    add column rota_polyline text,
    -- Distancia da rota calculada. O km rodado de verdade continua sendo o
    -- km_total, dos odometros; este e o numero do card enquanto nao ha odometro.
    add column km_previsto   numeric(10, 1),
    add constraint ck_viagem_origem check (
        (origem_lat is null) = (origem_lng is null)
        and (origem_lat is null or (origem_lat between -90 and 90 and origem_lng between -180 and 180))
    ),
    add constraint ck_viagem_destino check (
        (destino_lat is null) = (destino_lng is null)
        and (destino_lat is null or (destino_lat between -90 and 90 and destino_lng between -180 and 180))
    ),
    add constraint ck_viagem_km_previsto check (km_previsto is null or km_previsto >= 0);

-- -----------------------------------------------------------------------------
-- 2. Posicoes do GPS
--
-- Sobem do celular pelo push, como qualquer outra tabela, mas NAO descem no
-- pull: baixar a trilha inteira de toda viagem em todo aparelho pesaria, e o
-- unico aparelho que precisa dela e o que a gravou.
--
-- A ultima posicao NAO e copiada para a viagem por trigger. Parece mais barato
-- para o card, mas o celular reenvia a viagem inteira a cada edicao: com a
-- copia, a posicao antiga que ele tinha guardado sobrescreveria a nova. A view
-- vw_posicao_atual calcula na leitura, pelo indice (viagem_id, registrado_em).
-- -----------------------------------------------------------------------------

create table public.posicao_viagem (
    id            uuid primary key default public.uuid_generate_v7(),
    piloto_id     uuid not null default auth.uid() references public.piloto (id) on delete cascade,
    viagem_id     uuid not null references public.viagem (id) on delete cascade,
    latitude      numeric(9, 6) not null,
    longitude     numeric(9, 6) not null,
    -- Raio de incerteza informado pelo GPS. Posicao de 2 km de erro nao serve
    -- para dizer em que ponto da rota o caminhao esta.
    precisao_m    numeric(7, 1),
    -- Hora do GPS, e nao do servidor: a posicao pode subir horas depois, quando
    -- o caminhao sai da area sem sinal.
    registrado_em timestamptz not null,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    deleted_at    timestamptz,
    constraint ck_posicao_coordenadas check (
        latitude between -90 and 90 and longitude between -180 and 180
    ),
    constraint ck_posicao_precisao check (precisao_m is null or precisao_m >= 0)
);

create index ix_posicao_viagem_ultima on public.posicao_viagem (viagem_id, registrado_em desc)
    where deleted_at is null;
create index ix_posicao_piloto on public.posicao_viagem (piloto_id);

create trigger tg_posicao_viagem_updated_at
before update on public.posicao_viagem
for each row execute function public.set_updated_at();

-- Nas outras tabelas, valida_parente LEVANTA ERRO quando o pai nao existe ou foi
-- excluido. Aqui nao pode: o push aborta o lote inteiro no primeiro erro, e o
-- celular tentaria de novo para sempre. Basta o motorista excluir uma viagem
-- em outro aparelho enquanto este gravava o GPS sem sinal para o sync travar.
-- Posicao de viagem que nao existe mais (ou que nao e dele) e descartada em
-- silencio: nada e gravado, e nada de ninguem e tocado.
create or replace function public.descarta_posicao_orfa()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if not exists (
        select 1
        from public.viagem v
        where v.id = new.viagem_id
          and v.piloto_id = new.piloto_id
          and v.deleted_at is null
    ) then
        return null;
    end if;
    return new;
end;
$$;

create trigger tg_posicao_viagem_orfa
before insert on public.posicao_viagem
for each row execute function public.descarta_posicao_orfa();

alter table public.posicao_viagem enable row level security;
alter table public.posicao_viagem force row level security;

create policy "posicao_viagem_select" on public.posicao_viagem
for select to authenticated
using (piloto_id = (select auth.uid()));

create policy "posicao_viagem_insert" on public.posicao_viagem
for insert to authenticated
with check (piloto_id = (select auth.uid()));

create policy "posicao_viagem_update" on public.posicao_viagem
for update to authenticated
using (piloto_id = (select auth.uid()))
with check (piloto_id = (select auth.uid()));

create policy "posicao_viagem_delete" on public.posicao_viagem
for delete to authenticated
using (piloto_id = (select auth.uid()));

-- O default do Supabase da acesso ao anon em toda tabela nova; aqui ninguem
-- sem login tem o que fazer (mesma regra da migration de RLS).
revoke all on public.posicao_viagem from anon;
grant select, insert, update, delete on public.posicao_viagem to authenticated;

-- Ultima posicao de cada viagem. security_invoker: a RLS de posicao_viagem vale
-- aqui dentro, entao cada um so enxerga as proprias viagens.
create view public.vw_posicao_atual
with (security_invoker = on)
as
select distinct on (p.viagem_id)
    p.viagem_id,
    p.latitude,
    p.longitude,
    p.precisao_m,
    p.registrado_em
from public.posicao_viagem p
where p.deleted_at is null
  -- Celular com relogio adiantado nao pode prender a "ultima posicao" num
  -- instante futuro, escondendo todas as que chegarem depois.
  and p.registrado_em <= now() + interval '5 minutes'
order by p.viagem_id, p.registrado_em desc;

revoke all on public.vw_posicao_atual from anon;
grant select on public.vw_posicao_atual to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Sync: posicao_viagem sobe, e o push grava em ordem de dependencia
--
-- Ate aqui o push gravava na ordem de jsonb_each, que e a ordem interna do
-- jsonb: chave mais curta primeiro. Por acaso 'viagem' vinha antes de
-- 'posicao_viagem', mas 'abastecimento' vinha antes de 'estabelecimento':
-- um posto novo e um abastecimento nele, no mesmo lote, falhavam na chave
-- estrangeira - e o celular repetiria o push para sempre. Agora a ordem e a
-- desta lista, escrita de proposito com o pai antes do filho.
-- -----------------------------------------------------------------------------

create or replace function public.sync_writable_tables()
returns text[]
language sql
immutable
as $$
    select array[
        'piloto', 'cnh',
        'veiculo', 'documento_veiculo',
        'contratante', 'frete', 'viagem', 'posicao_viagem', 'carga', 'parada',
        'categoria_despesa', 'estabelecimento',
        'despesa', 'abastecimento', 'manutencao',
        'receita', 'fechamento_viagem'
    ]::text[];
$$;

-- sync_tables() (o pull) nao muda: posicao_viagem fica de fora de proposito.

create or replace function public.push_changes(
    changes        jsonb,
    last_pulled_at bigint default null
)
returns void
language plpgsql
set search_path = public
as $$
declare
    t         text;
    rec       jsonb;
    v_cols    text;
    v_set     text;
    v_ids     uuid[];
begin
    if (select auth.uid()) is null then
        raise exception 'Sincronizacao exige usuario autenticado' using errcode = '42501';
    end if;

    -- Recusa tabela desconhecida antes de gravar qualquer coisa.
    for t in select key from jsonb_each(changes)
    loop
        if not (t = any(public.sync_writable_tables())) then
            raise exception 'Tabela % nao e sincronizavel', t using errcode = '42501';
        end if;
    end loop;

    foreach t in array public.sync_writable_tables()
    loop
        continue when not (changes ? t);

        -- created e updated recebem o mesmo tratamento: upsert idempotente.
        -- O mesmo lote pode chegar duas vezes se a conexao cair no meio.
        for rec in
            select value
            from jsonb_array_elements(
                coalesce(changes -> t -> 'created', '[]'::jsonb)
                || coalesce(changes -> t -> 'updated', '[]'::jsonb)
            )
        loop
            -- _status e _changed sao controle interno do WatermelonDB.
            -- piloto_id sai porque quem preenche e o DEFAULT auth.uid().
            -- created_at / updated_at saem porque vale o relogio do servidor.
            rec := rec - '_status' - '_changed' - 'piloto_id'
                       - 'created_at' - 'updated_at' - 'deleted_at';

            select
                string_agg(quote_ident(c.column_name), ', '),
                string_agg(format('%I = excluded.%I', c.column_name, c.column_name), ', ')
                    filter (where c.column_name <> 'id')
            into v_cols, v_set
            from information_schema.columns c
            where c.table_schema = 'public'
              and c.table_name   = t
              and c.is_generated = 'NEVER'
              and c.column_name in (select jsonb_object_keys(rec));

            if v_cols is null then
                continue;
            end if;

            if v_set is null then
                execute format(
                    'insert into public.%I (%s)
                     select %s from jsonb_populate_record(null::public.%I, $1)
                     on conflict (id) do nothing',
                    t, v_cols, v_cols, t
                ) using rec;
            else
                execute format(
                    'insert into public.%I (%s)
                     select %s from jsonb_populate_record(null::public.%I, $1)
                     on conflict (id) do update
                        set %s, updated_at = now(), deleted_at = null',
                    t, v_cols, v_cols, t, v_set
                ) using rec;
            end if;
        end loop;

        -- Exclusao logica: um DELETE fisico feito offline nunca chegaria aos
        -- outros dispositivos, porque nao sobra linha para sincronizar.
        select array_agg((value #>> '{}')::uuid)
        into v_ids
        from jsonb_array_elements(coalesce(changes -> t -> 'deleted', '[]'::jsonb));

        if v_ids is not null then
            execute format(
                'update public.%I set deleted_at = now() where id = any($1) and deleted_at is null',
                t
            ) using v_ids;
        end if;
    end loop;
end;
$$;
