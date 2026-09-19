-- =============================================================================
-- CARGA CERTA | 01 - Schema base
--
-- Adaptado para Supabase:
--   * piloto.id referencia auth.users (sem coluna de senha propria)
--   * piloto_id propagado para todas as tabelas de dados do usuario, porque a
--     policy de RLS precisa resolver o dono sem join
--   * created_at / updated_at / deleted_at em TODAS as tabelas sincronizaveis,
--     exigencia do protocolo do WatermelonDB
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extensoes e funcoes de apoio
-- -----------------------------------------------------------------------------

create extension if not exists pgcrypto with schema extensions;

-- UUID v7: ordenavel por tempo. O app gera o ID offline; sem ordenacao temporal
-- os indices fragmentam quando o lote sobe.
create or replace function public.uuid_generate_v7()
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
begin
    return encode(
        set_bit(
            set_bit(
                overlay(
                    uuid_send(extensions.gen_random_uuid())
                    placing substring(
                        int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint)
                        from 3
                    )
                    from 1 for 6
                ),
                52, 1
            ),
            53, 1
        ),
        'hex'
    )::uuid;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

-- Valida que o registro-pai pertence ao mesmo piloto. Roda como SECURITY INVOKER
-- de proposito: se a RLS esconde o pai, a busca nao retorna nada e a operacao
-- falha, que e exatamente o comportamento desejado.
-- Uso: create trigger ... execute function valida_parente('viagem', 'viagem_id');
create or replace function public.valida_parente()
returns trigger
language plpgsql
as $$
declare
    v_parent_table text;
    v_fk_column    text;
    v_fk_value     uuid;
    v_dono         uuid;
    i              int := 0;
begin
    while i < array_length(tg_argv, 1) loop
        v_parent_table := tg_argv[i];
        v_fk_column    := tg_argv[i + 1];
        v_fk_value     := (to_jsonb(new) ->> v_fk_column)::uuid;

        if v_fk_value is not null then
            execute format('select piloto_id from public.%I where id = $1 and deleted_at is null', v_parent_table)
            into v_dono
            using v_fk_value;

            if v_dono is null or v_dono <> new.piloto_id then
                raise exception 'Registro % referenciado em %.% nao pertence ao usuario atual',
                    v_fk_value, tg_table_name, v_fk_column
                    using errcode = '42501';
            end if;
        end if;

        i := i + 2;
    end loop;

    return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Tipos enumerados
--
-- Virou ENUM tudo em que o codigo faz "if" e cuja lista nao cresce sem deploy.
-- Listas que o usuario ve e escolhe viraram tabela de catalogo.
-- -----------------------------------------------------------------------------

create type public.natureza_veiculo     as enum ('TRACAO', 'REBOQUE');
create type public.carroceria_veiculo   as enum ('BAU', 'SIDER', 'GRANELEIRO', 'CACAMBA', 'TANQUE',
                                                 'FRIGORIFICA', 'PRANCHA', 'PORTA_CONTAINER',
                                                 'CEGONHA', 'SILO', 'NAO_APLICA');
create type public.aplica_documento     as enum ('VEICULO', 'PILOTO');
create type public.status_frete         as enum ('RASCUNHO', 'CONTRATADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO');
create type public.status_viagem        as enum ('PLANEJADA', 'EM_ANDAMENTO', 'PAUSADA', 'CONCLUIDA', 'CANCELADA');
create type public.status_despesa       as enum ('PENDENTE', 'CONFIRMADA', 'CANCELADA');
create type public.responsavel_pedagio  as enum ('EMBARCADOR', 'TRANSPORTADOR');
create type public.escopo_categoria     as enum ('VEICULO', 'PESSOAL', 'ADMIN');
create type public.forma_pagamento      as enum ('DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO',
                                                 'CARTAO_FRETE', 'BOLETO', 'TRANSFERENCIA', 'FATURADO');
create type public.tipo_receita         as enum ('ADIANTAMENTO', 'SALDO', 'EXTRA', 'ESTADIA', 'DEVOLUCAO_PEDAGIO');
create type public.tipo_parada          as enum ('CARREGAMENTO', 'DESCARGA', 'ABASTECIMENTO', 'DESCANSO',
                                                 'PEDAGIO', 'BALANCA', 'FRONTEIRA', 'MANUTENCAO', 'OUTRO');
create type public.tipo_manutencao      as enum ('PREVENTIVA', 'CORRETIVA', 'REVISAO', 'PNEU', 'TROCA_OLEO');
create type public.tipo_combustivel     as enum ('DIESEL_S10', 'DIESEL_S500', 'ARLA32', 'GNV', 'ETANOL', 'GASOLINA');
create type public.tipo_estabelecimento as enum ('POSTO', 'OFICINA', 'BORRACHARIA', 'RESTAURANTE',
                                                 'HOTEL', 'PEDAGIO', 'BALANCA', 'OUTRO');

-- -----------------------------------------------------------------------------
-- 3. Catalogos compartilhados
--
-- Sem piloto_id: leitura liberada para qualquer usuario autenticado, escrita
-- so via service_role. Descem uma vez para o dispositivo e raramente mudam.
-- -----------------------------------------------------------------------------

create table public.cidade (
    id          uuid primary key default public.uuid_generate_v7(),
    codigo_ibge integer not null unique,
    nome        text    not null,
    uf          char(2) not null,
    latitude    numeric(10, 7),
    longitude   numeric(10, 7),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    deleted_at  timestamptz,
    constraint ck_cidade_uf check (uf ~ '^[A-Z]{2}$')
);

create index ix_cidade_uf_nome on public.cidade (uf, nome);

create table public.tipo_veiculo (
    id                   uuid primary key default public.uuid_generate_v7(),
    nome                 text not null unique,
    natureza             public.natureza_veiculo not null,
    qtd_eixos            smallint,
    capacidade_kg_ref    numeric(10, 2),
    categoria_cnh_minima char(2),
    ordem                smallint not null default 0,
    ativo                boolean  not null default true,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now(),
    deleted_at           timestamptz,
    constraint ck_tipo_veiculo_eixos check (qtd_eixos is null or qtd_eixos between 1 and 12)
);

-- Habilita a FK composta de veiculo (impede reboque cadastrado como tracao)
create unique index ux_tipo_veiculo_id_natureza on public.tipo_veiculo (id, natureza);

create table public.tipo_documento (
    id                  uuid primary key default public.uuid_generate_v7(),
    nome                text not null unique,
    aplica_se_a         public.aplica_documento not null,
    periodicidade_meses smallint,
    obrigatorio         boolean not null default false,
    ativo               boolean not null default true,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    deleted_at          timestamptz
);

create table public.tipo_carga (
    id          uuid primary key default public.uuid_generate_v7(),
    nome        text not null unique,
    descricao   text,
    perigosa    boolean not null default false,
    refrigerada boolean not null default false,
    ativo       boolean not null default true,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    deleted_at  timestamptz
);

create table public.condicao_trajeto (
    id         uuid primary key default public.uuid_generate_v7(),
    condicao   text not null unique,
    descricao  text,
    ativo      boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

create table public.estabelecimento (
    id         uuid primary key default public.uuid_generate_v7(),
    cidade_id  uuid references public.cidade (id) on delete set null,
    -- Quem cadastrou. Diferente de piloto_id de proposito: este catalogo e
    -- compartilhado - todo usuario enxerga todo posto - mas so o autor corrige
    -- o que ele mesmo cadastrou. Com o nome piloto_id, a RPC de sync removeria
    -- a coluna do payload e o app nao teria como saber se pode editar.
    -- A FK aponta para auth.users porque piloto so e criada mais abaixo; como
    -- piloto.id E o id do auth.users, da no mesmo.
    criado_por uuid default auth.uid() references auth.users (id) on delete set null,
    nome       text not null,
    cnpj       text,
    tipo       public.tipo_estabelecimento not null default 'POSTO',
    latitude   numeric(10, 7),
    longitude  numeric(10, 7),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

create index ix_estabelecimento_cidade on public.estabelecimento (cidade_id);
create index ix_estabelecimento_autor  on public.estabelecimento (criado_por);
create unique index ux_estabelecimento_cnpj on public.estabelecimento (cnpj) where cnpj is not null;

-- -----------------------------------------------------------------------------
-- 4. Identidade e frota
-- -----------------------------------------------------------------------------

-- Espelho do auth.users com os dados de perfil. Sem senha: credencial e do
-- GoTrue. A PK e a mesma do auth.users, entao piloto_id = auth.uid() sempre.
create table public.piloto (
    id              uuid primary key references auth.users (id) on delete cascade,
    nome            text not null default '',
    email           text,
    cpf             text,
    telefone        text,
    data_nascimento date,
    sexo            text,
    foto_path       text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    deleted_at      timestamptz,
    constraint ck_piloto_cpf   check (cpf is null or cpf ~ '^[0-9]{11}$'),
    constraint ck_piloto_idade check (data_nascimento is null or data_nascimento < current_date)
);

create unique index ux_piloto_cpf on public.piloto (cpf) where cpf is not null and deleted_at is null;

-- Cria o perfil no mesmo instante do cadastro no Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.piloto (id, nome, email)
    values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'nome', ''),
        new.email
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table public.cnh (
    id          uuid primary key default public.uuid_generate_v7(),
    piloto_id   uuid not null default auth.uid() references public.piloto (id) on delete cascade,
    numero      text not null,
    categoria   text not null,
    validade    date not null,
    ear         boolean not null default true,
    arquivo_path text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    deleted_at  timestamptz,
    constraint ck_cnh_categoria check (categoria ~ '^[ABCDE]+$')
);

create unique index ux_cnh_piloto on public.cnh (piloto_id) where deleted_at is null;
create index ix_cnh_validade on public.cnh (validade) where deleted_at is null;

create table public.veiculo (
    id              uuid primary key default public.uuid_generate_v7(),
    piloto_id       uuid not null default auth.uid() references public.piloto (id) on delete cascade,
    tipo_veiculo_id uuid not null,
    natureza        public.natureza_veiculo not null,
    carroceria      public.carroceria_veiculo not null default 'NAO_APLICA',
    placa           text not null,
    renavam         text,
    marca           text,
    modelo          text,
    ano             smallint,
    cor             text,
    capacidade_kg   numeric(10, 2),
    qtd_eixos       smallint,
    odometro_atual  bigint not null default 0,
    ativo           boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    deleted_at      timestamptz,
    -- FK composta: a natureza do veiculo sempre bate com a do tipo escolhido
    constraint fk_veiculo_tipo foreign key (tipo_veiculo_id, natureza)
        references public.tipo_veiculo (id, natureza) on delete restrict,
    constraint ck_veiculo_placa    check (placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
    constraint ck_veiculo_ano      check (ano is null or ano between 1950 and extract(year from current_date)::int + 1),
    constraint ck_veiculo_odometro check (odometro_atual >= 0)
);

-- Placa unica por piloto: dois usuarios podem cadastrar o mesmo agregado
create unique index ux_veiculo_placa on public.veiculo (piloto_id, placa) where deleted_at is null;
create index ix_veiculo_piloto on public.veiculo (piloto_id) where deleted_at is null;
-- Necessario para as FKs compostas de viagem
create unique index ux_veiculo_id_natureza on public.veiculo (id, natureza);

create table public.documento_veiculo (
    id                uuid primary key default public.uuid_generate_v7(),
    piloto_id         uuid not null default auth.uid() references public.piloto (id) on delete cascade,
    veiculo_id        uuid not null references public.veiculo (id) on delete cascade,
    tipo_documento_id uuid not null references public.tipo_documento (id) on delete restrict,
    numero            text,
    emissao           date,
    validade          date,
    arquivo_path      text,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),
    deleted_at        timestamptz,
    constraint ck_documento_datas check (emissao is null or validade is null or validade >= emissao)
);

create index ix_documento_piloto   on public.documento_veiculo (piloto_id);
create index ix_documento_veiculo  on public.documento_veiculo (veiculo_id) where deleted_at is null;
create index ix_documento_validade on public.documento_veiculo (validade) where deleted_at is null;

create trigger tg_documento_parente
before insert or update of veiculo_id on public.documento_veiculo
for each row execute function public.valida_parente('veiculo', 'veiculo_id');

-- -----------------------------------------------------------------------------
-- 5. Operacao
-- -----------------------------------------------------------------------------

create table public.contratante (
    id         uuid primary key default public.uuid_generate_v7(),
    piloto_id  uuid not null default auth.uid() references public.piloto (id) on delete cascade,
    nome       text not null,
    cnpj       text,
    contato    text,
    telefone   text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

create index ix_contratante_piloto on public.contratante (piloto_id) where deleted_at is null;

create table public.frete (
    id                uuid primary key default public.uuid_generate_v7(),
    piloto_id         uuid not null default auth.uid() references public.piloto (id) on delete cascade,
    contratante_id    uuid references public.contratante (id) on delete set null,
    codigo            text,
    valor_total       numeric(12, 2) not null default 0,
    valor_tonelada    numeric(12, 2),
    pedagio_por_conta public.responsavel_pedagio not null default 'EMBARCADOR',
    status            public.status_frete not null default 'RASCUNHO',
    observacao        text,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),
    deleted_at        timestamptz,
    constraint ck_frete_valor check (valor_total >= 0)
);

create index ix_frete_piloto_status on public.frete (piloto_id, status) where deleted_at is null;
create index ix_frete_contratante   on public.frete (contratante_id);

create trigger tg_frete_parente
before insert or update of contratante_id on public.frete
for each row execute function public.valida_parente('contratante', 'contratante_id');

create table public.viagem (
    id                  uuid primary key default public.uuid_generate_v7(),
    piloto_id           uuid not null default auth.uid() references public.piloto (id) on delete cascade,
    frete_id            uuid references public.frete (id) on delete set null,
    veiculo_tracao_id   uuid not null,
    veiculo_reboque_id  uuid,
    natureza_tracao     public.natureza_veiculo not null generated always as ('TRACAO'::public.natureza_veiculo) stored,
    natureza_reboque    public.natureza_veiculo generated always as ('REBOQUE'::public.natureza_veiculo) stored,
    condicao_trajeto_id uuid references public.condicao_trajeto (id) on delete set null,
    cidade_origem_id    uuid references public.cidade (id) on delete set null,
    cidade_destino_id   uuid references public.cidade (id) on delete set null,
    inicio_em           timestamptz,
    fim_em              timestamptz,
    odometro_inicial    bigint,
    odometro_final      bigint,
    km_total            numeric(10, 2) generated always as (
                            case when odometro_final is not null and odometro_inicial is not null
                                 then (odometro_final - odometro_inicial)::numeric
                            end
                        ) stored,
    status              public.status_viagem not null default 'PLANEJADA',
    observacao          text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    deleted_at          timestamptz,
    -- FKs compostas: impedem trocar cavalo por carreta nos campos errados
    constraint fk_viagem_tracao foreign key (veiculo_tracao_id, natureza_tracao)
        references public.veiculo (id, natureza) on delete restrict,
    constraint fk_viagem_reboque foreign key (veiculo_reboque_id, natureza_reboque)
        references public.veiculo (id, natureza) on delete restrict,
    constraint ck_viagem_periodo  check (fim_em is null or inicio_em is null or fim_em >= inicio_em),
    constraint ck_viagem_odometro check (odometro_final is null or odometro_inicial is null
                                         or odometro_final >= odometro_inicial)
);

create unique index ux_viagem_frete on public.viagem (frete_id) where frete_id is not null and deleted_at is null;
create index ix_viagem_piloto_inicio on public.viagem (piloto_id, inicio_em desc) where deleted_at is null;
create index ix_viagem_status        on public.viagem (piloto_id, status) where deleted_at is null;
create index ix_viagem_tracao        on public.viagem (veiculo_tracao_id);

create trigger tg_viagem_parente
before insert or update of frete_id, veiculo_tracao_id, veiculo_reboque_id on public.viagem
for each row execute function public.valida_parente(
    'frete', 'frete_id',
    'veiculo', 'veiculo_tracao_id',
    'veiculo', 'veiculo_reboque_id'
);

create table public.carga (
    id               uuid primary key default public.uuid_generate_v7(),
    piloto_id        uuid not null default auth.uid() references public.piloto (id) on delete cascade,
    frete_id         uuid not null references public.frete (id) on delete cascade,
    tipo_carga_id    uuid references public.tipo_carga (id) on delete set null,
    peso_kg          numeric(10, 2),
    valor_mercadoria numeric(12, 2),
    descricao        text,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    deleted_at       timestamptz,
    constraint ck_carga_peso check (peso_kg is null or peso_kg > 0)
);

create index ix_carga_piloto on public.carga (piloto_id);
create index ix_carga_frete  on public.carga (frete_id) where deleted_at is null;

create trigger tg_carga_parente
before insert or update of frete_id on public.carga
for each row execute function public.valida_parente('frete', 'frete_id');

create table public.parada (
    id         uuid primary key default public.uuid_generate_v7(),
    piloto_id  uuid not null default auth.uid() references public.piloto (id) on delete cascade,
    viagem_id  uuid not null references public.viagem (id) on delete cascade,
    cidade_id  uuid references public.cidade (id) on delete set null,
    ordem      smallint not null,
    tipo       public.tipo_parada not null default 'OUTRO',
    chegada_em timestamptz,
    saida_em   timestamptz,
    odometro   bigint,
    observacao text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    constraint ck_parada_periodo check (saida_em is null or chegada_em is null or saida_em >= chegada_em)
);

create unique index ux_parada_ordem on public.parada (viagem_id, ordem) where deleted_at is null;
create index ix_parada_piloto on public.parada (piloto_id);
create index ix_parada_viagem on public.parada (viagem_id) where deleted_at is null;

create trigger tg_parada_parente
before insert or update of viagem_id on public.parada
for each row execute function public.valida_parente('viagem', 'viagem_id');

-- -----------------------------------------------------------------------------
-- 6. Financeiro
-- -----------------------------------------------------------------------------

create table public.categoria_despesa (
    id               uuid primary key default public.uuid_generate_v7(),
    categoria_pai_id uuid references public.categoria_despesa (id) on delete restrict,
    -- NULO = categoria padrao do sistema, visivel para todos.
    -- O DEFAULT e obrigatorio: a RPC de push remove piloto_id do payload, entao
    -- sem ele toda categoria criada pelo app entraria com NULO e seria barrada
    -- pela policy. No seed nao muda nada - rodando como service_role, auth.uid()
    -- e nulo, que e exatamente o que as categorias do sistema precisam.
    piloto_id        uuid default auth.uid() references public.piloto (id) on delete cascade,
    nome             text not null,
    escopo           public.escopo_categoria not null,
    dedutivel        boolean not null default true,
    is_padrao        boolean not null default false,
    icone            text,
    ordem            smallint not null default 0,
    ativo            boolean not null default true,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    deleted_at       timestamptz,
    constraint ck_categoria_padrao check ((is_padrao and piloto_id is null)
                                          or (not is_padrao and piloto_id is not null)),
    constraint ck_categoria_ciclo  check (categoria_pai_id is null or categoria_pai_id <> id)
);

create unique index ux_categoria_sistema_raiz
    on public.categoria_despesa (nome) where piloto_id is null and categoria_pai_id is null;
create unique index ux_categoria_sistema_filha
    on public.categoria_despesa (categoria_pai_id, nome) where piloto_id is null;
create unique index ux_categoria_usuario
    on public.categoria_despesa (piloto_id, nome) where piloto_id is not null and deleted_at is null;
create index ix_categoria_pai    on public.categoria_despesa (categoria_pai_id);
create index ix_categoria_piloto on public.categoria_despesa (piloto_id);

create table public.despesa (
    id              uuid primary key default public.uuid_generate_v7(),
    piloto_id       uuid not null default auth.uid() references public.piloto (id) on delete cascade,
    -- NULO = gasto fora de frete. E este campo que permite manter gasto por
    -- piloto e gasto por viagem na mesma tabela.
    viagem_id       uuid references public.viagem (id) on delete set null,
    veiculo_id      uuid references public.veiculo (id) on delete set null,
    categoria_id    uuid not null references public.categoria_despesa (id) on delete restrict,
    valor           numeric(12, 2) not null,
    data_hora       timestamptz not null default now(),
    forma_pagamento public.forma_pagamento not null default 'DINHEIRO',
    descricao       text,
    -- Caminho no bucket, nao URL: a URL assinada e gerada na hora de exibir
    comprovante_path text,
    latitude        numeric(10, 7),
    longitude       numeric(10, 7),
    status          public.status_despesa not null default 'CONFIRMADA',
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    deleted_at      timestamptz,
    constraint ck_despesa_valor check (valor > 0)
);

create index ix_despesa_piloto_data on public.despesa (piloto_id, data_hora desc) where deleted_at is null;
create index ix_despesa_viagem      on public.despesa (viagem_id) where viagem_id is not null and deleted_at is null;
create index ix_despesa_veiculo     on public.despesa (veiculo_id) where veiculo_id is not null;
create index ix_despesa_categoria   on public.despesa (categoria_id);
-- Usado pelo pull incremental do WatermelonDB
create index ix_despesa_sync        on public.despesa (piloto_id, updated_at);

create trigger tg_despesa_parente
before insert or update of viagem_id, veiculo_id on public.despesa
for each row execute function public.valida_parente(
    'viagem', 'viagem_id',
    'veiculo', 'veiculo_id'
);

create table public.abastecimento (
    id                 uuid primary key default public.uuid_generate_v7(),
    piloto_id          uuid not null default auth.uid() references public.piloto (id) on delete cascade,
    despesa_id         uuid not null references public.despesa (id) on delete cascade,
    estabelecimento_id uuid references public.estabelecimento (id) on delete set null,
    litros             numeric(9, 3) not null,
    preco_litro        numeric(8, 3) not null,
    odometro           bigint not null,
    -- Sem esta flag nao ha km/l: o consumo so fecha entre dois tanques cheios
    tanque_cheio       boolean not null default true,
    combustivel        public.tipo_combustivel not null default 'DIESEL_S10',
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    deleted_at         timestamptz,
    constraint ck_abastecimento_litros   check (litros > 0),
    constraint ck_abastecimento_preco    check (preco_litro > 0),
    constraint ck_abastecimento_odometro check (odometro >= 0)
);

create unique index ux_abastecimento_despesa on public.abastecimento (despesa_id) where deleted_at is null;
create index ix_abastecimento_piloto   on public.abastecimento (piloto_id);
create index ix_abastecimento_odometro on public.abastecimento (odometro);

create trigger tg_abastecimento_parente
before insert or update of despesa_id on public.abastecimento
for each row execute function public.valida_parente('despesa', 'despesa_id');

create table public.manutencao (
    id               uuid primary key default public.uuid_generate_v7(),
    piloto_id        uuid not null default auth.uid() references public.piloto (id) on delete cascade,
    despesa_id       uuid references public.despesa (id) on delete cascade,
    veiculo_id       uuid not null references public.veiculo (id) on delete cascade,
    oficina_id       uuid references public.estabelecimento (id) on delete set null,
    tipo             public.tipo_manutencao not null default 'CORRETIVA',
    item             text not null,
    odometro         bigint,
    proxima_odometro bigint,
    proxima_data     date,
    observacao       text,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    deleted_at       timestamptz,
    constraint ck_manutencao_proxima check (proxima_odometro is null or odometro is null
                                            or proxima_odometro > odometro)
);

create unique index ux_manutencao_despesa on public.manutencao (despesa_id)
    where despesa_id is not null and deleted_at is null;
create index ix_manutencao_piloto       on public.manutencao (piloto_id);
create index ix_manutencao_veiculo      on public.manutencao (veiculo_id) where deleted_at is null;
create index ix_manutencao_proxima_km   on public.manutencao (proxima_odometro) where proxima_odometro is not null;
create index ix_manutencao_proxima_data on public.manutencao (proxima_data) where proxima_data is not null;

create trigger tg_manutencao_parente
before insert or update of despesa_id, veiculo_id on public.manutencao
for each row execute function public.valida_parente(
    'despesa', 'despesa_id',
    'veiculo', 'veiculo_id'
);

create table public.receita (
    id                uuid primary key default public.uuid_generate_v7(),
    piloto_id         uuid not null default auth.uid() references public.piloto (id) on delete cascade,
    frete_id          uuid not null references public.frete (id) on delete cascade,
    tipo              public.tipo_receita not null default 'SALDO',
    valor             numeric(12, 2) not null,
    recebido_em       timestamptz,
    forma_recebimento public.forma_pagamento not null default 'PIX',
    observacao        text,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),
    deleted_at        timestamptz,
    constraint ck_receita_valor check (valor > 0)
);

create index ix_receita_piloto on public.receita (piloto_id);
create index ix_receita_frete  on public.receita (frete_id) where deleted_at is null;

create trigger tg_receita_parente
before insert or update of frete_id on public.receita
for each row execute function public.valida_parente('frete', 'frete_id');

-- Snapshot congelado do resultado. Para o valor em tempo real, ver a view.
create table public.fechamento_viagem (
    id            uuid primary key default public.uuid_generate_v7(),
    piloto_id     uuid not null default auth.uid() references public.piloto (id) on delete cascade,
    viagem_id     uuid not null references public.viagem (id) on delete cascade,
    receita_total numeric(12, 2) not null default 0,
    despesa_total numeric(12, 2) not null default 0,
    lucro_liquido numeric(12, 2) not null default 0,
    custo_por_km  numeric(10, 4),
    consumo_medio numeric(6, 3),
    km_total      numeric(10, 2),
    calculado_em  timestamptz not null default now(),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    deleted_at    timestamptz
);

create unique index ux_fechamento_viagem on public.fechamento_viagem (viagem_id) where deleted_at is null;
create index ix_fechamento_piloto on public.fechamento_viagem (piloto_id);

create trigger tg_fechamento_parente
before insert or update of viagem_id on public.fechamento_viagem
for each row execute function public.valida_parente('viagem', 'viagem_id');

-- -----------------------------------------------------------------------------
-- 7. Triggers gerais
-- -----------------------------------------------------------------------------

-- updated_at em toda tabela que tenha a coluna. O sync depende disso ser
-- confiavel, entao fica no banco, nunca na aplicacao.
do $$
declare
    t text;
begin
    for t in
        select c.table_name
        from information_schema.columns c
        join information_schema.tables tb
          on tb.table_name = c.table_name and tb.table_schema = c.table_schema
        where c.table_schema = 'public'
          and c.column_name = 'updated_at'
          and tb.table_type = 'BASE TABLE'
    loop
        execute format(
            'create trigger tg_%1$s_updated_at
             before update on public.%1$I
             for each row execute function public.set_updated_at()', t
        );
    end loop;
end;
$$;

-- Mantem veiculo.odometro_atual no maior valor ja registrado
create or replace function public.atualiza_odometro_veiculo()
returns trigger
language plpgsql
as $$
declare
    v_veiculo uuid;
begin
    select d.veiculo_id into v_veiculo
    from public.despesa d
    where d.id = new.despesa_id;

    if v_veiculo is not null then
        update public.veiculo
        set odometro_atual = new.odometro
        where id = v_veiculo and odometro_atual < new.odometro;
    end if;

    return new;
end;
$$;

create trigger tg_abastecimento_odometro
after insert or update of odometro on public.abastecimento
for each row execute function public.atualiza_odometro_veiculo();

-- -----------------------------------------------------------------------------
-- 8. View de resultado por viagem
--
-- security_invoker: a view respeita a RLS de quem consulta, em vez de rodar
-- com os privilegios do dono. Sem isso, ela vaza dados de outros usuarios.
-- -----------------------------------------------------------------------------

create view public.vw_resultado_viagem
with (security_invoker = on)
as
select
    v.id                                                        as viagem_id,
    v.piloto_id,
    v.status,
    v.inicio_em,
    v.fim_em,
    v.km_total,
    coalesce(r.receita_total, 0)                                as receita_total,
    coalesce(d.despesa_total, 0)                                as despesa_total,
    coalesce(d.despesa_veiculo, 0)                              as despesa_veiculo,
    coalesce(d.despesa_pessoal, 0)                              as despesa_pessoal,
    coalesce(r.receita_total, 0) - coalesce(d.despesa_total, 0) as lucro_liquido,
    case when v.km_total > 0
         then round(coalesce(d.despesa_total, 0) / v.km_total, 4)
    end                                                         as custo_por_km,
    case when coalesce(a.litros_total, 0) > 0
         then round(v.km_total / a.litros_total, 3)
    end                                                         as consumo_medio_km_l
from public.viagem v
left join lateral (
    select sum(re.valor) as receita_total
    from public.receita re
    where re.frete_id = v.frete_id and re.deleted_at is null
) r on true
left join lateral (
    select
        sum(de.valor)                                       as despesa_total,
        sum(de.valor) filter (where cat.escopo = 'VEICULO') as despesa_veiculo,
        sum(de.valor) filter (where cat.escopo = 'PESSOAL') as despesa_pessoal
    from public.despesa de
    join public.categoria_despesa cat on cat.id = de.categoria_id
    where de.viagem_id = v.id
      and de.deleted_at is null
      and de.status <> 'CANCELADA'
) d on true
left join lateral (
    select sum(ab.litros) as litros_total
    from public.abastecimento ab
    join public.despesa de2 on de2.id = ab.despesa_id
    where de2.viagem_id = v.id and de2.deleted_at is null and ab.deleted_at is null
) a on true
where v.deleted_at is null;

-- -----------------------------------------------------------------------------
-- 9. Comentarios
-- -----------------------------------------------------------------------------

comment on column public.despesa.viagem_id is
    'NULO = gasto fora de frete. Permite gasto por piloto e por viagem na mesma tabela.';
comment on column public.veiculo.natureza is
    'Denormalizado de tipo_veiculo para evitar join; a FK composta garante a coerencia.';
comment on column public.categoria_despesa.piloto_id is
    'NULO = categoria padrao do sistema. Preenchido = criada pelo proprio usuario.';
comment on column public.abastecimento.tanque_cheio is
    'O consumo em km/l so pode ser calculado entre dois abastecimentos de tanque cheio.';
comment on column public.despesa.comprovante_path is
    'Caminho no bucket comprovantes, no formato {piloto_id}/{despesa_id}.jpg.';
