-- =============================================================================
-- CARGA CERTA | 05 - Acentuacao dos nomes dos catalogos
--
-- Os catalogos nasceram sem acento no seed ("Combustivel", "Manutencao"), e o
-- motorista le esses nomes na tela. Esta migration corrige o que ja esta no
-- banco; o seed.sql foi corrigido junto, para instalacoes novas.
--
-- Por que UPDATE, e nao rodar o seed de novo: o seed usa
-- `on conflict (nome) do nothing`, e "Combustível" nao conflita com
-- "Combustivel". Reaplicar o seed corrigido DUPLICARIA cada categoria, com as
-- despesas antigas presas a versao sem acento.
--
-- Garantias:
--   * So toca linhas do sistema. Em categoria_despesa, isso e `piloto_id is
--     null`: categoria criada pelo usuario nunca e renomeada.
--   * Idempotente: numa segunda execucao nenhuma linha e regravada (verificado:
--     UPDATE 0 nas cinco tabelas).
--   * Numa instalacao nova (`supabase db reset`) roda antes do seed, com os
--     catalogos vazios, e nao faz nada - o seed ja insere com acento.
--   * Descricao so e trocada se ainda for o texto original do seed. Se alguem
--     ajustou uma descricao direto no banco, o ajuste fica.
--   * As despesas apontam para a categoria por id, entao nenhum vinculo muda.
--     O trigger de updated_at marca as linhas, e o proximo pull leva os nomes
--     novos para os celulares.
-- =============================================================================

update public.categoria_despesa as c
set nome = v.novo
from (values
    ('Combustivel',        'Combustível'),
    ('Manutencao',         'Manutenção'),
    ('Pedagio',            'Pedágio'),
    ('Documentacao',       'Documentação'),
    ('Alimentacao',        'Alimentação'),
    ('Troca de oleo',      'Troca de óleo'),
    ('Eletrica',           'Elétrica'),
    ('Pedagio rodoviario', 'Pedágio rodoviário'),
    ('Balanca',            'Balança'),
    ('Refeicao',           'Refeição')
) as v (antigo, novo)
where c.nome = v.antigo
  and c.piloto_id is null;

update public.tipo_veiculo as t
set nome = v.novo
from (values
    ('Cavalo tracado', 'Cavalo traçado')
) as v (antigo, novo)
where t.nome = v.antigo;

update public.tipo_documento as t
set nome = v.novo
from (values
    ('Seguro obrigatorio', 'Seguro obrigatório'),
    ('Cronotacografo',     'Cronotacógrafo'),
    ('Inspecao veicular',  'Inspeção veicular'),
    ('Licenca AET',        'Licença AET'),
    ('Exame toxicologico', 'Exame toxicológico')
) as v (antigo, novo)
where t.nome = v.antigo;

update public.tipo_carga as t
set nome      = v.novo_nome,
    descricao = case when t.descricao = v.antiga_desc then v.nova_desc else t.descricao end
from (values
    ('Granel solido',     'Granel sólido',
     'Graos, minerio, fertilizante, cimento',      'Grãos, minério, fertilizante, cimento'),
    ('Granel liquido',    'Granel líquido',
     'Combustivel, oleo vegetal, produto quimico', 'Combustível, óleo vegetal, produto químico'),
    ('Carga perigosa',    'Carga perigosa',
     'Sujeita a regulamentacao MOPP',              'Sujeita à regulamentação MOPP'),
    ('Carga indivisivel', 'Carga indivisível',
     'Excede limites legais, exige AET',           'Excede limites legais, exige AET'),
    ('Conteinerizada',    'Conteinerizada',
     'Container maritimo ou intermodal',           'Contêiner marítimo ou intermodal'),
    ('Mudanca',           'Mudança',
     'Bens domesticos',                            'Bens domésticos'),
    ('Veiculos',          'Veículos',
     'Transporte de automoveis (cegonha)',         'Transporte de automóveis (cegonha)')
) as v (antigo_nome, novo_nome, antiga_desc, nova_desc)
where t.nome = v.antigo_nome
  -- Sem esta linha a migration NAO seria idempotente: nos itens em que so a
  -- descricao muda ("Carga perigosa"), o nome antigo e igual ao novo e casaria
  -- de novo numa segunda execucao. Os dados nao mudariam, mas a linha seria
  -- regravada, o updated_at subiria e o sync reenviaria o registro a todos os
  -- aparelhos sem motivo. Achado rodando a migration duas vezes.
  and (t.nome is distinct from v.novo_nome or t.descricao = v.antiga_desc);

update public.condicao_trajeto as t
set condicao  = v.novo_nome,
    descricao = case when t.descricao = v.antiga_desc then v.nova_desc else t.descricao end
from (values
    ('Transferencia', 'Transferência',
     'Deslocamento entre bases sem carga faturada', 'Deslocamento entre bases sem carga faturada'),
    ('Coleta',        'Coleta',
     'Percurso curto ate o ponto de carregamento',  'Percurso curto até o ponto de carregamento')
) as v (antigo_nome, novo_nome, antiga_desc, nova_desc)
where t.condicao = v.antigo_nome
  -- Mesma protecao do tipo_carga: "Coleta" nao muda de nome.
  and (t.condicao is distinct from v.novo_nome or t.descricao = v.antiga_desc);
