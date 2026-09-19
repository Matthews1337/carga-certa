-- =============================================================================
-- CARGA CERTA | Teste do protocolo de sync sob RLS real
--
-- Cada caso roda numa transacao propria, como a role `authenticated` e com o
-- mesmo claim de JWT que o PostgREST injeta numa requisicao do app. Testar como
-- `postgres` nao serve para nada aqui: o superusuario ignora RLS, e RLS e o
-- unico controle de acesso que existe entre o celular e o banco.
--
-- Rodar (exige o stack local de pe):
--
--   pnpm db:reset
--   pnpm db:test
--
-- Todas as 17 linhas do resultado devem comecar com OK. Tres bugs foram
-- encontrados por este script e corrigidos nas migrations:
--
--   * categoria_despesa.piloto_id sem DEFAULT auth.uid(): o push remove o campo,
--     a linha entrava com NULO e a policy barrava. Categoria personalizada era
--     impossivel.
--   * piloto sem policy de INSERT: o Postgres exige uma para
--     `insert ... on conflict do update`, mesmo caindo no caminho do UPDATE.
--     O motorista nao conseguia sincronizar o proprio perfil.
--   * policy de SELECT filtrando `deleted_at is null`: impede a propria
--     exclusao logica, porque o UPDATE deixa a linha invisivel para si mesma, e
--     impede o pull de montar a lista `deleted`.
--
-- Rode de novo depois de qualquer mexida em policy, trigger ou nas RPCs.
-- =============================================================================

\set ON_ERROR_STOP off

drop table if exists _diag;
create table _diag (ordem serial, teste text, resultado text);

-- Usuario de teste. A trigger on_auth_user_created cria o piloto.
insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
) values (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'motorista@teste.local', 'x',
    now(), now(), now(),
    '{"provider":"email"}', '{"nome":"Joao Motorista"}'
);

-- Segundo usuario, para testar isolamento no catalogo compartilhado.
insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
) values (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'outro@teste.local', 'x',
    now(), now(), now(),
    '{"provider":"email"}', '{"nome":"Outro Motorista"}'
);

insert into _diag (teste, resultado)
select 'trigger cria o perfil do piloto',
       case when exists (select 1 from public.piloto where id = 'aaaaaaaa-0000-4000-8000-000000000001')
            then 'OK' else 'FALHOU: perfil nao criado' end;

-- ---------------------------------------------------------------------------
-- TESTE 1: push de despesa comum (caminho feliz, controle)
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

do $$
declare
    v_cat uuid;
begin
    select id into v_cat from public.categoria_despesa
    where nome = 'Combustivel' and piloto_id is null and categoria_pai_id is null;

    perform public.push_changes(jsonb_build_object(
        'despesa', jsonb_build_object(
            'created', jsonb_build_array(jsonb_build_object(
                'id', 'bbbbbbbb-0000-7000-8000-000000000001',
                'categoria_id', v_cat,
                'valor', 1500.50,
                'data_hora', '2026-09-19T12:00:00+00:00',
                'forma_pagamento', 'PIX',
                'descricao', 'Diesel S10',
                'status', 'CONFIRMADA',
                '_status', 'created',
                '_changed', ''
            )),
            'updated', '[]'::jsonb,
            'deleted', '[]'::jsonb
        )
    ));
    insert into _diag (teste, resultado) values ('push de despesa', 'OK');
exception when others then
    insert into _diag (teste, resultado) values ('push de despesa', 'ERRO: ' || sqlerrm);
end
$$;
commit;

insert into _diag (teste, resultado)
select 'despesa recebeu piloto_id pelo DEFAULT auth.uid()',
       coalesce((select case when piloto_id = 'aaaaaaaa-0000-4000-8000-000000000001'
                             then 'OK' else 'FALHOU: ' || piloto_id::text end
                 from public.despesa where id = 'bbbbbbbb-0000-7000-8000-000000000001'),
                'FALHOU: despesa nao gravada');

-- ---------------------------------------------------------------------------
-- TESTE 2: push de categoria personalizada  <-- a hipotese
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

do $$
begin
    perform public.push_changes(jsonb_build_object(
        'categoria_despesa', jsonb_build_object(
            'created', jsonb_build_array(jsonb_build_object(
                'id', 'cccccccc-0000-7000-8000-000000000001',
                'nome', 'Chapa / ajudante',
                'escopo', 'PESSOAL',
                'dedutivel', false,
                'is_padrao', false,
                'ordem', 0,
                'ativo', true,
                '_status', 'created',
                '_changed', ''
            )),
            'updated', '[]'::jsonb,
            'deleted', '[]'::jsonb
        )
    ));
    insert into _diag (teste, resultado) values ('push de categoria personalizada', 'OK');
exception when others then
    insert into _diag (teste, resultado)
    values ('push de categoria personalizada', 'ERRO: ' || sqlerrm);
end
$$;
commit;

-- ---------------------------------------------------------------------------
-- TESTE 3: push de estabelecimento novo (insert) e depois edicao (update)
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

do $$
begin
    perform public.push_changes(jsonb_build_object(
        'estabelecimento', jsonb_build_object(
            'created', jsonb_build_array(jsonb_build_object(
                'id', 'dddddddd-0000-7000-8000-000000000001',
                'nome', 'Posto Beira Rio',
                'tipo', 'POSTO',
                '_status', 'created'
            )),
            'updated', '[]'::jsonb,
            'deleted', '[]'::jsonb
        )
    ));
    insert into _diag (teste, resultado) values ('push de estabelecimento novo', 'OK');
exception when others then
    insert into _diag (teste, resultado)
    values ('push de estabelecimento novo', 'ERRO: ' || sqlerrm);
end
$$;
commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

do $$
begin
    perform public.push_changes(jsonb_build_object(
        'estabelecimento', jsonb_build_object(
            'created', '[]'::jsonb,
            'updated', jsonb_build_array(jsonb_build_object(
                'id', 'dddddddd-0000-7000-8000-000000000001',
                'nome', 'Posto Beira Rio - matriz',
                'tipo', 'POSTO',
                '_status', 'updated'
            )),
            'deleted', '[]'::jsonb
        )
    ));
    insert into _diag (teste, resultado) values ('push editando estabelecimento', 'OK');
exception when others then
    insert into _diag (teste, resultado)
    values ('push editando estabelecimento', 'ERRO: ' || sqlerrm);
end
$$;
commit;

-- ---------------------------------------------------------------------------
-- TESTE 4: push do proprio perfil (INSERT ... ON CONFLICT sem policy de INSERT)
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

do $$
begin
    perform public.push_changes(jsonb_build_object(
        'piloto', jsonb_build_object(
            'created', '[]'::jsonb,
            'updated', jsonb_build_array(jsonb_build_object(
                'id', 'aaaaaaaa-0000-4000-8000-000000000001',
                'nome', 'Joao da Silva',
                'telefone', '11988887777',
                '_status', 'updated'
            )),
            'deleted', '[]'::jsonb
        )
    ));
    insert into _diag (teste, resultado) values ('push do proprio perfil', 'OK');
exception when others then
    insert into _diag (teste, resultado) values ('push do proprio perfil', 'ERRO: ' || sqlerrm);
end
$$;
commit;

-- ---------------------------------------------------------------------------
-- TESTE 5: pull inicial
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

do $$
declare
    v jsonb;
begin
    v := public.pull_changes(null);
    insert into _diag (teste, resultado) values (
        'pull inicial',
        format('OK - %s tabelas, %s categorias, %s despesas, piloto_id no payload: %s',
               (select count(*) from jsonb_object_keys(v -> 'changes')),
               jsonb_array_length(v -> 'changes' -> 'categoria_despesa' -> 'created')
                 + jsonb_array_length(v -> 'changes' -> 'categoria_despesa' -> 'updated'),
               jsonb_array_length(v -> 'changes' -> 'despesa' -> 'created')
                 + jsonb_array_length(v -> 'changes' -> 'despesa' -> 'updated'),
               (v::text like '%piloto_id%'))
    );
exception when others then
    insert into _diag (teste, resultado) values ('pull inicial', 'ERRO: ' || sqlerrm);
end
$$;
commit;

-- ---------------------------------------------------------------------------
-- TESTE 6: cliente tenta forjar o dono do registro
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

do $$
declare
    v_cat uuid;
begin
    select id into v_cat from public.categoria_despesa
    where nome = 'Pedagio' and piloto_id is null and categoria_pai_id is null;

    perform public.push_changes(jsonb_build_object(
        'despesa', jsonb_build_object(
            'created', jsonb_build_array(jsonb_build_object(
                'id', 'eeeeeeee-0000-7000-8000-000000000001',
                'piloto_id', '99999999-0000-4000-8000-000000000009',
                'categoria_id', v_cat,
                'valor', 42,
                'data_hora', '2026-09-19T15:00:00+00:00',
                'status', 'CONFIRMADA',
                '_status', 'created'
            )),
            'updated', '[]'::jsonb,
            'deleted', '[]'::jsonb
        )
    ));
    insert into _diag (teste, resultado) values ('push com piloto_id forjado', 'push aceito (esperado)');
exception when others then
    insert into _diag (teste, resultado)
    values ('push com piloto_id forjado', 'ERRO: ' || sqlerrm);
end
$$;
commit;

insert into _diag (teste, resultado)
select 'piloto_id forjado foi ignorado',
       coalesce((select case when piloto_id = 'aaaaaaaa-0000-4000-8000-000000000001'
                             then 'OK - dono correto' else 'FALHA DE SEGURANCA: ' || piloto_id::text end
                 from public.despesa where id = 'eeeeeeee-0000-7000-8000-000000000001'),
                'linha nao gravada');

-- ---------------------------------------------------------------------------
-- TESTE 7: outro usuario tenta editar o posto alheio
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';

do $$
begin
    perform public.push_changes(jsonb_build_object(
        'estabelecimento', jsonb_build_object(
            'created', '[]'::jsonb,
            'updated', jsonb_build_array(jsonb_build_object(
                'id', 'dddddddd-0000-7000-8000-000000000001',
                'nome', 'Posto Sequestrado',
                'tipo', 'POSTO',
                '_status', 'updated'
            )),
            'deleted', '[]'::jsonb
        )
    ));
    insert into _diag (teste, resultado)
    values ('outro usuario editando posto alheio', 'FALHA: push aceito');
exception when others then
    insert into _diag (teste, resultado)
    values ('outro usuario editando posto alheio', 'OK - barrado: ' || sqlerrm);
end
$$;
commit;

insert into _diag (teste, resultado)
select 'nome do posto preservado',
       case when nome = 'Posto Beira Rio - matriz' then 'OK' else 'ALTERADO: ' || nome end
from public.estabelecimento where id = 'dddddddd-0000-7000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- TESTE 8: outro usuario enxerga o posto (catalogo e compartilhado)
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';

do $$
declare
    v_ve int;
    v_despesas int;
begin
    select count(*) into v_ve from public.estabelecimento
    where id = 'dddddddd-0000-7000-8000-000000000001';

    select count(*) into v_despesas from public.despesa;

    insert into _diag (teste, resultado) values (
        'isolamento entre usuarios',
        format('posto alheio visivel: %s (esperado 1) | despesas alheias visiveis: %s (esperado 0)',
               v_ve, v_despesas)
    );
end
$$;
commit;

-- ---------------------------------------------------------------------------
-- TESTE 9: exclusao logica do proprio posto
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

do $$
begin
    perform public.push_changes(jsonb_build_object(
        'estabelecimento', jsonb_build_object(
            'created', '[]'::jsonb,
            'updated', '[]'::jsonb,
            'deleted', jsonb_build_array('dddddddd-0000-7000-8000-000000000001')
        )
    ));
    insert into _diag (teste, resultado) values ('exclusao logica do proprio posto', 'OK');
exception when others then
    insert into _diag (teste, resultado)
    values ('exclusao logica do proprio posto', 'ERRO: ' || sqlerrm);
end
$$;
commit;

insert into _diag (teste, resultado)
select 'deleted_at gravado de fato',
       case when deleted_at is not null then 'OK' else 'FALHOU: delete virou no-op' end
from public.estabelecimento where id = 'dddddddd-0000-7000-8000-000000000001';

-- A janela de seguranca do pull e de 1 segundo; sem a espera, a exclusao que
-- acabou de acontecer ficaria de fora e o teste acusaria falso negativo.
select pg_sleep(1.2);

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

do $$
declare
    v jsonb;
begin
    v := public.pull_changes(null);
    insert into _diag (teste, resultado) values (
        'exclusao chega ao outro aparelho pelo pull',
        case when (v -> 'changes' -> 'estabelecimento' -> 'deleted')
                  @> '["dddddddd-0000-7000-8000-000000000001"]'::jsonb
             then 'OK'
             else 'FALHOU: id ausente da lista deleted -> ' ||
                  (v -> 'changes' -> 'estabelecimento' -> 'deleted')::text
        end
    );
exception when others then
    insert into _diag (teste, resultado)
    values ('exclusao chega ao outro aparelho pelo pull', 'ERRO: ' || sqlerrm);
end
$$;
commit;

-- ---------------------------------------------------------------------------
-- TESTE 10: categoria personalizada aparece no pull do dono, nao no do outro
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';

do $$
declare
    v int;
begin
    select count(*) into v from public.categoria_despesa
    where id = 'cccccccc-0000-7000-8000-000000000001';
    insert into _diag (teste, resultado) values (
        'categoria personalizada nao vaza para outro usuario',
        case when v = 0 then 'OK' else 'VAZAMENTO' end
    );
end
$$;
commit;

\pset format aligned
\pset border 2
select ordem, teste, resultado from _diag order by ordem;
