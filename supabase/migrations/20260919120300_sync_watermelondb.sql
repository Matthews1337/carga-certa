-- =============================================================================
-- CARGA CERTA | 04 - Protocolo de sincronizacao do WatermelonDB
--
-- O cliente do Supabase nao tem suporte offline: e um wrapper HTTP sobre o
-- PostgREST. O WatermelonDB cobre esse buraco, mas espera dois endpoints com
-- formato especifico. Como nao ha backend proprio, ambos viram RPC no banco.
--
-- Contrato esperado pelo synchronize() do WatermelonDB:
--   pull -> { changes: { tabela: { created: [], updated: [], deleted: [] } },
--             timestamp: <epoch ms> }
--   push -> recebe o mesmo formato de changes e aplica
--
-- Decisoes importantes:
--   * SECURITY INVOKER (padrao): a RLS continua valendo dentro das funcoes.
--     Nunca transforme estas funcoes em SECURITY DEFINER.
--   * piloto_id e removido na saida e ignorado na entrada. O banco local e de
--     um usuario so, entao o app nao precisa do campo, e assim o cliente nao
--     tem como forjar o dono de um registro.
--   * created_at / updated_at sao convertidos para epoch em milissegundos, que
--     e o formato que o WatermelonDB usa internamente.
--   * O relogio que vale e o do servidor: os timestamps enviados pelo cliente
--     sao descartados no push. Celular em estrada tem relogio nao confiavel.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Whitelists
-- -----------------------------------------------------------------------------

-- Tabelas que descem para o dispositivo
create or replace function public.sync_tables()
returns text[]
language sql
immutable
as $$
    select array[
        'piloto', 'cnh', 'veiculo', 'documento_veiculo',
        'contratante', 'frete', 'viagem', 'carga', 'parada',
        'categoria_despesa', 'despesa', 'abastecimento', 'manutencao',
        'receita', 'fechamento_viagem',
        -- catalogos (somente leitura, exceto estabelecimento)
        'tipo_veiculo', 'tipo_documento', 'tipo_carga',
        'condicao_trajeto', 'estabelecimento', 'cidade'
    ]::text[];
$$;

-- Tabelas que o dispositivo pode escrever. A RLS ainda decide linha a linha;
-- esta lista so evita que um push malformado tente escrever em outro lugar.
create or replace function public.sync_writable_tables()
returns text[]
language sql
immutable
as $$
    select array[
        'piloto', 'cnh', 'veiculo', 'documento_veiculo',
        'contratante', 'frete', 'viagem', 'carga', 'parada',
        'categoria_despesa', 'despesa', 'abastecimento', 'manutencao',
        'receita', 'fechamento_viagem', 'estabelecimento'
    ]::text[];
$$;

-- -----------------------------------------------------------------------------
-- 2. Serializacao de saida
-- -----------------------------------------------------------------------------

create or replace function public.sync_out(r jsonb)
returns jsonb
language sql
immutable
as $$
    select (r - 'piloto_id' - 'deleted_at')
        || jsonb_build_object(
               'created_at', (extract(epoch from (r ->> 'created_at')::timestamptz) * 1000)::bigint,
               'updated_at', (extract(epoch from (r ->> 'updated_at')::timestamptz) * 1000)::bigint
           );
$$;

-- -----------------------------------------------------------------------------
-- 3. PULL
-- -----------------------------------------------------------------------------

create or replace function public.pull_changes(last_pulled_at bigint default null)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
    t          text;
    v_since    timestamptz;
    v_ate      timestamptz;
    v_created  jsonb;
    v_updated  jsonb;
    v_deleted  jsonb;
    v_changes  jsonb := '{}'::jsonb;
begin
    if (select auth.uid()) is null then
        raise exception 'Sincronizacao exige usuario autenticado' using errcode = '42501';
    end if;

    v_since := to_timestamp(coalesce(last_pulled_at, 0) / 1000.0);

    -- Janela de seguranca de 1 segundo: uma transacao aberta antes deste ponto
    -- pode commitar depois da leitura e ficar invisivel para sempre. Com a
    -- margem, o proximo pull a reencontra. Reenviar registro e inofensivo,
    -- porque o WatermelonDB aplica updates de forma idempotente.
    v_ate := now() - interval '1 second';

    foreach t in array public.sync_tables()
    loop
        execute format($q$
            select
                coalesce(jsonb_agg(public.sync_out(to_jsonb(x)))
                         filter (where x.deleted_at is null and x.created_at > $1), '[]'::jsonb),
                coalesce(jsonb_agg(public.sync_out(to_jsonb(x)))
                         filter (where x.deleted_at is null and x.created_at <= $1), '[]'::jsonb),
                coalesce(jsonb_agg(to_jsonb(x.id))
                         filter (where x.deleted_at is not null), '[]'::jsonb)
            from public.%I x
            where x.updated_at > $1 and x.updated_at <= $2
        $q$, t)
        into v_created, v_updated, v_deleted
        using v_since, v_ate;

        v_changes := v_changes || jsonb_build_object(
            t,
            jsonb_build_object(
                'created', v_created,
                'updated', v_updated,
                'deleted', v_deleted
            )
        );
    end loop;

    return jsonb_build_object(
        'changes',   v_changes,
        'timestamp', (extract(epoch from v_ate) * 1000)::bigint
    );
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. PUSH
-- -----------------------------------------------------------------------------

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

    for t in select key from jsonb_each(changes)
    loop
        if not (t = any(public.sync_writable_tables())) then
            raise exception 'Tabela % nao e sincronizavel', t using errcode = '42501';
        end if;

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

-- -----------------------------------------------------------------------------
-- 5. Permissoes
-- -----------------------------------------------------------------------------

revoke execute on function public.pull_changes(bigint) from public, anon;
revoke execute on function public.push_changes(jsonb, bigint) from public, anon;

grant execute on function public.pull_changes(bigint) to authenticated;
grant execute on function public.push_changes(jsonb, bigint) to authenticated;

comment on function public.pull_changes(bigint) is
    'Endpoint de pull do WatermelonDB. Retorna changes + timestamp em epoch ms.';
comment on function public.push_changes(jsonb, bigint) is
    'Endpoint de push do WatermelonDB. Upsert idempotente com exclusao logica.';
