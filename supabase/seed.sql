-- =============================================================================
-- CARGA CERTA | Seed dos catalogos
--
-- Roda automaticamente no `supabase db reset`. Em producao, aplique uma vez
-- com a service_role key (o seed escreve em tabelas cuja RLS so permite
-- leitura para usuarios comuns).
--
-- Nao inclui `cidade`: ver README, secao "Carga das cidades".
-- =============================================================================

insert into public.tipo_veiculo (nome, natureza, qtd_eixos, capacidade_kg_ref, categoria_cnh_minima, ordem) values
    ('Toco',            'TRACAO',  2,  6000.00, 'C',  10),
    ('Truck',           'TRACAO',  3, 14000.00, 'C',  20),
    ('Bitruck',         'TRACAO',  4, 18000.00, 'C',  30),
    ('Cavalo simples',  'TRACAO',  2, 26000.00, 'E',  40),
    ('Cavalo trucado',  'TRACAO',  3, 33000.00, 'E',  50),
    ('Cavalo tracado',  'TRACAO',  3, 35000.00, 'E',  60),
    ('Carreta 2 eixos', 'REBOQUE', 2, 18000.00, null, 70),
    ('Carreta 3 eixos', 'REBOQUE', 3, 27000.00, null, 80),
    ('Vanderleia',      'REBOQUE', 3, 30000.00, null, 90),
    ('Bitrem',          'REBOQUE', 6, 37000.00, null, 100),
    ('Rodotrem',        'REBOQUE', 7, 45000.00, null, 110),
    ('Dolly',           'REBOQUE', 2,     0.00, null, 120)
on conflict (nome) do nothing;

insert into public.tipo_documento (nome, aplica_se_a, periodicidade_meses, obrigatorio) values
    ('CRLV',               'VEICULO', 12, true),
    ('RNTRC / ANTT',       'VEICULO', 60, true),
    ('Seguro obrigatorio', 'VEICULO', 12, true),
    ('Seguro de carga',    'VEICULO', 12, false),
    ('Cronotacografo',     'VEICULO', 24, true),
    ('Inspecao veicular',  'VEICULO', 12, false),
    ('Licenca AET',        'VEICULO', 12, false),
    ('CNH',                'PILOTO',  60, true),
    ('Exame toxicologico', 'PILOTO',  30, true),
    ('Curso MOPP',         'PILOTO',  60, false)
on conflict (nome) do nothing;

insert into public.tipo_carga (nome, descricao, perigosa, refrigerada) values
    ('Carga geral',       'Mercadoria embalada, paletizada ou unitizada', false, false),
    ('Granel solido',     'Graos, minerio, fertilizante, cimento',        false, false),
    ('Granel liquido',    'Combustivel, oleo vegetal, produto quimico',   false, false),
    ('Frigorificada',     'Exige controle de temperatura',                false, true),
    ('Carga perigosa',    'Sujeita a regulamentacao MOPP',                true,  false),
    ('Carga viva',        'Animais vivos',                                false, false),
    ('Carga indivisivel', 'Excede limites legais, exige AET',             false, false),
    ('Conteinerizada',    'Container maritimo ou intermodal',             false, false),
    ('Mudanca',           'Bens domesticos',                              false, false),
    ('Veiculos',          'Transporte de automoveis (cegonha)',           false, false)
on conflict (nome) do nothing;

insert into public.condicao_trajeto (condicao, descricao) values
    ('Ida com carga',     'Percurso principal do frete contratado'),
    ('Retorno com carga', 'Frete de retorno contratado separadamente'),
    ('Retorno vazio',     'Percurso sem carga, custo integral do transportador'),
    ('Transferencia',     'Deslocamento entre bases sem carga faturada'),
    ('Coleta',            'Percurso curto ate o ponto de carregamento')
on conflict (condicao) do nothing;

-- Categorias padrao: piloto_id NULO = visiveis para todos os usuarios
insert into public.categoria_despesa (nome, escopo, dedutivel, is_padrao, icone, ordem) values
    ('Combustivel',  'VEICULO', true,  true, 'fuel',      10),
    ('Manutencao',   'VEICULO', true,  true, 'wrench',    20),
    ('Pedagio',      'VEICULO', true,  true, 'road',      30),
    ('Documentacao', 'ADMIN',   true,  true, 'file-text', 40),
    ('Alimentacao',  'PESSOAL', false, true, 'utensils',  50),
    ('Hospedagem',   'PESSOAL', false, true, 'bed',       60),
    ('Higiene',      'PESSOAL', false, true, 'shower',    70),
    ('Outros',       'ADMIN',   false, true, 'dots',      80)
on conflict do nothing;

insert into public.categoria_despesa (categoria_pai_id, nome, escopo, dedutivel, is_padrao, ordem)
select p.id, v.nome, v.escopo::public.escopo_categoria, v.dedutivel, true, v.ordem
from (values
    ('Combustivel',  'Diesel S10',         'VEICULO', true,  10),
    ('Combustivel',  'Diesel S500',        'VEICULO', true,  20),
    ('Combustivel',  'Arla 32',            'VEICULO', true,  30),
    ('Manutencao',   'Pneus',              'VEICULO', true,  10),
    ('Manutencao',   'Troca de oleo',      'VEICULO', true,  20),
    ('Manutencao',   'Freios',             'VEICULO', true,  30),
    ('Manutencao',   'Eletrica',           'VEICULO', true,  40),
    ('Manutencao',   'Borracharia',        'VEICULO', true,  50),
    ('Manutencao',   'Lavagem',            'VEICULO', true,  60),
    ('Pedagio',      'Pedagio rodoviario', 'VEICULO', true,  10),
    ('Pedagio',      'Balanca',            'VEICULO', true,  20),
    ('Documentacao', 'Licenciamento',      'ADMIN',   true,  10),
    ('Documentacao', 'Seguro',             'ADMIN',   true,  20),
    ('Documentacao', 'Multas',             'ADMIN',   false, 30),
    ('Alimentacao',  'Refeicao',           'PESSOAL', false, 10),
    ('Alimentacao',  'Lanche',             'PESSOAL', false, 20),
    ('Hospedagem',   'Pernoite',           'PESSOAL', false, 10),
    ('Higiene',      'Banho',              'PESSOAL', false, 10),
    ('Higiene',      'Lavanderia',         'PESSOAL', false, 20)
) as v(pai, nome, escopo, dedutivel, ordem)
join public.categoria_despesa p
  on p.nome = v.pai and p.piloto_id is null and p.categoria_pai_id is null
on conflict do nothing;
