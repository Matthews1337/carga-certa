# @carga-certa/web

React 19 + Vite + Tailwind 4, falando direto com o Supabase pelo PostgREST. Sem
backend proprio no meio: quem decide o que cada usuario enxerga e a RLS.

```powershell
cp .env.example .env.local
corepack pnpm dev          # http://localhost:5173
```

## Estrutura

```
src/
  auth/         sessao, rota protegida e tela de entrada
  components/ui componentes no estilo shadcn, versionados aqui e nao em node_modules
  despesas/     a fatia vertical completa: consulta, formulario, exclusao, comprovante
  layout/       shell com a navegacao de todas as secoes
  lib/          cliente do Supabase e utilitarios
```

`despesas/` e o modelo para as demais secoes. A separacao que vale copiar e
`api.ts` conter todo acesso ao Supabase, e nenhum componente montar consulta.

## O que a camada de dados exige

**`piloto_id` nunca e enviado.** A coluna tem `DEFAULT auth.uid()` e a policy
rejeita qualquer outro valor. Mandar o campo so abre espaco para erro.

**`.is('deleted_at', null)` em toda leitura.** Nenhuma policy esconde registro
excluido - se escondesse, a propria exclusao logica seria impossivel no Postgres.
Esquecer o filtro faz despesa apagada reaparecer.

**Exclusao e logica.** `update({ deleted_at })`, nunca `delete()`. Um DELETE
fisico nao deixaria linha para o pull do mobile informar, e o registro apagado
aqui continuaria no celular.

**IDs saem do `uuidv7()` do pacote shared**, gerados antes do insert. E o que
permite montar o caminho do comprovante no Storage sem esperar o banco, e e o
mesmo esquema de id que o mobile usa offline.

**Comprovante guarda o caminho, nunca a URL.** O caminho comeca com o id do
usuario porque a policy do Storage compara o primeiro segmento da pasta com
`auth.uid()`. Monte sempre com `caminhoComprovante()`. A URL assinada e gerada
no clique e expira em uma hora.

## Componentes de UI

Sao do shadcn/ui em espirito - codigo dentro do projeto, sem dependencia de
biblioteca de componentes - mas escritos a mao sobre Radix, nao gerados pela CLI.
Duas diferencas em relacao ao padrao: a altura base dos controles e 44px, porque
o mesmo layout roda em tablet dentro da cabine, e nao ha classes `animate-in`,
que exigiriam o `tw-animate-css`.

## Pendencias

O bundle esta em 791 kB (235 kB com gzip), a maior parte `@supabase/supabase-js`.
Antes do primeiro deploy, vale dividir por rota com `React.lazy`.

Falta recuperacao de senha na tela de entrada.
