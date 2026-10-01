-- =============================================================================
-- CARGA CERTA | Teste da rota da viagem, das posicoes do GPS e da ordem do push
--
-- Cobre a migration 20260929230000_rota_e_posicao_da_viagem.sql, com RLS real
-- (role `authenticated` e o claim de JWT que o PostgREST injeta).
--
-- Diferente de rls_sync.sql, este roda INTEIRO numa transacao que termina em
-- ROLLBACK: nao precisa de db:reset e nao deixa rastro no banco local - pode
-- rodar em cima dos seus dados de teste a qualquer hora.
--
--   pnpm db:test:rota
--
-- Todas as linhas do resultado devem comecar com OK.
-- =============================================================================

\set ON_ERROR_STOP off

begin;

create temp table _r (ordem serial, teste text, resultado text) on commit drop;
grant all on _r to authenticated;
grant usage on sequence _r_ordem_seq to authenticated;

-- Dois usuarios de teste. A trigger on_auth_user_created cria os pilotos.
insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
    ('00000000-0000-0000-0000-000000000000', 'f0f0f0f0-0000-4000-8000-00000000000a',
     'authenticated', 'authenticated', 'rota-a@teste.local', 'x',
     now(), now(), now(), '{"provider":"email"}', '{"nome":"Motorista A"}'),
    ('00000000-0000-0000-0000-000000000000', 'f0f0f0f0-0000-4000-8000-00000000000b',
     'authenticated', 'authenticated', 'rota-b@teste.local', 'x',
     now(), now(), now(), '{"provider":"email"}', '{"nome":"Motorista B"}');

-- ---------------------------------------------------------------------------
-- Motorista A
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0f0f0f0-0000-4000-8000-00000000000a","role":"authenticated"}';

-- TESTE 1: veiculo, viagem e posicoes novos no mesmo lote, posicoes fora de ordem
do $$
declare
    v_tipo uuid;
begin
    select id into v_tipo from public.tipo_veiculo where nome = 'Cavalo trucado';

    perform public.push_changes(jsonb_build_object(
        'posicao_viagem', jsonb_build_object('created', jsonb_build_array(
            jsonb_build_object('id', 'f1000000-0000-7000-8000-000000000001',
                'viagem_id', 'f2000000-0000-7000-8000-000000000001',
                'latitude', -17.79, 'longitude', -50.92, 'precisao_m', 8,
                'registrado_em', '2026-09-29T10:00:00+00:00'),
            jsonb_build_object('id', 'f1000000-0000-7000-8000-000000000003',
                'viagem_id', 'f2000000-0000-7000-8000-000000000001',
                'latitude', -17.30, 'longitude', -50.10, 'precisao_m', 12,
                'registrado_em', '2026-09-29T10:20:00+00:00'),
            jsonb_build_object('id', 'f1000000-0000-7000-8000-000000000002',
                'viagem_id', 'f2000000-0000-7000-8000-000000000001',
                'latitude', -17.50, 'longitude', -50.40, 'precisao_m', 10,
                'registrado_em', '2026-09-29T10:10:00+00:00'),
            -- Relogio do celular adiantado um dia.
            jsonb_build_object('id', 'f1000000-0000-7000-8000-000000000009',
                'viagem_id', 'f2000000-0000-7000-8000-000000000001',
                'latitude', 0, 'longitude', 0,
                'registrado_em', now() + interval '1 day')
        )),
        'viagem', jsonb_build_object('created', jsonb_build_array(jsonb_build_object(
            'id', 'f2000000-0000-7000-8000-000000000001',
            'veiculo_tracao_id', 'f3000000-0000-7000-8000-000000000001',
            'status', 'EM_ANDAMENTO',
            'origem_nome', 'Rio Verde, GO', 'origem_lat', -17.797780, 'origem_lng', -50.928060,
            'destino_nome', 'Porto de Santos, SP', 'destino_lat', -23.960830, 'destino_lng', -46.333610,
            'rota_polyline', '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
            'km_previsto', 1072.4
        ))),
        'veiculo', jsonb_build_object('created', jsonb_build_array(jsonb_build_object(
            'id', 'f3000000-0000-7000-8000-000000000001',
            'tipo_veiculo_id', v_tipo, 'natureza', 'TRACAO', 'placa', 'ROT1A23'
        )))
    ));
    insert into _r (teste, resultado) values ('push de veiculo, viagem e posicoes no mesmo lote', 'OK');
exception when others then
    insert into _r (teste, resultado)
    values ('push de veiculo, viagem e posicoes no mesmo lote', 'ERRO: ' || sqlerrm);
end
$$;

-- TESTE 2: a view devolve a posicao mais recente pela hora do GPS, e nao a
-- ultima que chegou nem a do relogio adiantado
insert into _r (teste, resultado)
select 'ultima posicao pela hora do GPS, ignorando o futuro',
       coalesce((select case when latitude = -17.30 and longitude = -50.10
                             then 'OK' else format('FALHOU: %s, %s em %s', latitude, longitude, registrado_em) end
                 from public.vw_posicao_atual
                 where viagem_id = 'f2000000-0000-7000-8000-000000000001'),
                'FALHOU: nenhuma posicao na view');

insert into _r (teste, resultado)
select 'todas as posicoes gravadas, inclusive a do relogio adiantado',
       case when count(*) = 4 then 'OK' else format('FALHOU: %s posicoes', count(*)) end
from public.posicao_viagem where viagem_id = 'f2000000-0000-7000-8000-000000000001';

insert into _r (teste, resultado)
select 'origem, destino e rota gravados na viagem',
       case when origem_nome = 'Rio Verde, GO' and destino_lng = -46.333610
                 and rota_polyline = '_p~iF~ps|U_ulLnnqC_mqNvxq`@' and km_previsto = 1072.4
            then 'OK' else 'FALHOU' end
from public.viagem where id = 'f2000000-0000-7000-8000-000000000001';

-- TESTE 3: as posicoes nao descem no pull
do $$
declare
    v jsonb;
begin
    v := public.pull_changes(null);
    insert into _r (teste, resultado) values (
        'posicao_viagem fora do pull, viagem dentro',
        case when not (v -> 'changes' ? 'posicao_viagem') and (v -> 'changes' ? 'viagem')
             then 'OK' else 'FALHOU: ' || (select string_agg(k, ',') from jsonb_object_keys(v -> 'changes') k) end
    );
end
$$;

-- TESTE 4: coordenada pela metade na viagem e recusada
do $$
begin
    update public.viagem set origem_lng = null
    where id = 'f2000000-0000-7000-8000-000000000001';
    insert into _r (teste, resultado) values ('origem sem longitude', 'FALHOU: aceita');
exception when check_violation then
    insert into _r (teste, resultado) values ('origem sem longitude', 'OK - recusada');
end
$$;

-- TESTE 5: posto novo e abastecimento nele no mesmo lote (a ordem do push)
do $$
declare
    v_cat uuid;
begin
    select id into v_cat from public.categoria_despesa
    where nome = 'Combustível' and piloto_id is null and categoria_pai_id is null;

    perform public.push_changes(jsonb_build_object(
        'abastecimento', jsonb_build_object('created', jsonb_build_array(jsonb_build_object(
            'id', 'f4000000-0000-7000-8000-000000000003',
            'despesa_id', 'f4000000-0000-7000-8000-000000000002',
            'estabelecimento_id', 'f4000000-0000-7000-8000-000000000001',
            'litros', 80, 'preco_litro', 6.25, 'odometro', 1000))),
        'despesa', jsonb_build_object('created', jsonb_build_array(jsonb_build_object(
            'id', 'f4000000-0000-7000-8000-000000000002', 'categoria_id', v_cat, 'valor', 500,
            'data_hora', '2026-09-29T10:00:00+00:00', 'status', 'CONFIRMADA'))),
        'estabelecimento', jsonb_build_object('created', jsonb_build_array(jsonb_build_object(
            'id', 'f4000000-0000-7000-8000-000000000001', 'nome', 'Posto Novo', 'tipo', 'POSTO')))
    ));
    insert into _r (teste, resultado) values ('posto novo e abastecimento nele no mesmo lote', 'OK');
exception when others then
    insert into _r (teste, resultado)
    values ('posto novo e abastecimento nele no mesmo lote', 'ERRO: ' || sqlerrm);
end
$$;

-- TESTE 6: tabela fora da lista continua recusada
do $$
begin
    perform public.push_changes('{"posicao_atual": {"created": []}}'::jsonb);
    insert into _r (teste, resultado) values ('push para tabela desconhecida', 'FALHOU: aceito');
exception when others then
    insert into _r (teste, resultado) values ('push para tabela desconhecida', 'OK - recusado');
end
$$;

-- ---------------------------------------------------------------------------
-- Motorista B
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"f0f0f0f0-0000-4000-8000-00000000000b","role":"authenticated"}';

-- TESTE 7: nao enxerga as posicoes de A, nem pela tabela nem pela view
insert into _r (teste, resultado)
select 'B nao enxerga as posicoes de A',
       case when (select count(*) from public.posicao_viagem) = 0
                 and (select count(*) from public.vw_posicao_atual) = 0
            then 'OK' else 'VAZAMENTO' end;

-- TESTE 8: B tenta gravar uma posicao na viagem de A. Nao da erro (nao pode
-- travar o sync), mas nada e gravado.
do $$
begin
    perform public.push_changes(jsonb_build_object(
        'posicao_viagem', jsonb_build_object('created', jsonb_build_array(jsonb_build_object(
            'id', 'f1000000-0000-7000-8000-0000000000b1',
            'viagem_id', 'f2000000-0000-7000-8000-000000000001',
            'latitude', -10, 'longitude', -40,
            'registrado_em', '2026-09-29T11:00:00+00:00')))
    ));
    insert into _r (teste, resultado) values ('B grava posicao na viagem de A: push', 'OK - sem erro');
exception when others then
    insert into _r (teste, resultado) values ('B grava posicao na viagem de A: push', 'ERRO: ' || sqlerrm);
end
$$;

-- ---------------------------------------------------------------------------
-- De volta a A
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"f0f0f0f0-0000-4000-8000-00000000000a","role":"authenticated"}';

insert into _r (teste, resultado)
select 'B grava posicao na viagem de A: descartada',
       case when (select count(*) from public.posicao_viagem
                  where viagem_id = 'f2000000-0000-7000-8000-000000000001') = 4
                 and (select latitude from public.vw_posicao_atual
                      where viagem_id = 'f2000000-0000-7000-8000-000000000001') = -17.30
            then 'OK' else 'FALHOU: posicao de B entrou' end;

-- TESTE 9: viagem excluida em outro aparelho; posicao gravada sem sinal chega
-- depois. Descartada, sem erro - senao o sync travaria para sempre.
do $$
begin
    perform public.push_changes(jsonb_build_object(
        'viagem', jsonb_build_object('deleted', jsonb_build_array('f2000000-0000-7000-8000-000000000001'))
    ));
    perform public.push_changes(jsonb_build_object(
        'posicao_viagem', jsonb_build_object('created', jsonb_build_array(jsonb_build_object(
            'id', 'f1000000-0000-7000-8000-000000000004',
            'viagem_id', 'f2000000-0000-7000-8000-000000000001',
            'latitude', -17.1, 'longitude', -49.9,
            'registrado_em', '2026-09-29T10:30:00+00:00')))
    ));
    insert into _r (teste, resultado)
    select 'posicao de viagem excluida',
           case when not exists (select 1 from public.posicao_viagem
                                 where id = 'f1000000-0000-7000-8000-000000000004')
                then 'OK - descartada sem erro' else 'FALHOU: gravada' end;
exception when others then
    insert into _r (teste, resultado) values ('posicao de viagem excluida', 'ERRO: ' || sqlerrm);
end
$$;

-- ---------------------------------------------------------------------------
-- Resultado e rollback
-- ---------------------------------------------------------------------------
reset role;

\pset format aligned
\pset border 2
select ordem, teste, resultado from _r order by ordem;

rollback;
