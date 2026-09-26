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
  lib/          cliente do Supabase, validacao do ambiente e utilitarios
  tema/         claro / escuro / automatico
plugins/        plugins do Vite que rodam no build (cabecalhos de seguranca)
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

## Tema

Tres estados - claro, escuro e automatico (segue o sistema), nesta ordem no
botao que cicla. O padrao e automatico, e a escolha fica em `carga-certa:tema`
no localStorage.

A classe `.dark` vai no `<html>`: a variante do Tailwind e `&:is(.dark *)`,
entao precisa de um ancestral, e o `color-scheme` no `:root` e o que faz barra
de rolagem e campo nativo acompanharem.

Quem aplica a classe no carregamento e um script inline no
[index.html](index.html), antes do primeiro paint - o React so recupera a
decisao depois. Sem ele, quem usa o tema escuro leva um estouro de tela branca a
cada carregamento, o que de madrugada na estrada cega por alguns segundos. Esse
script repete a regra de [src/tema/tema.ts](src/tema/tema.ts) de proposito,
porque roda antes de existir modulo: mexeu em um, mexa no outro.

Toda a UI ja sai do token (`bg-card`, `text-muted-foreground`, ...), nunca de
cor literal - e o que permitiu o tema escuro nascer sem tocar em componente
nenhum. Manter assim.

## Seguranca

### Variaveis de ambiente

O build **recusa** rodar com `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY`
invalidas, e a mensagem de erro diz o valor certo. A checagem esta em
[src/lib/env.ts](src/lib/env.ts) e pega os tres erros que ja aconteceram de
verdade: so o project ref, `/rest/v1` grudado no fim, e - o pior, porque nao
quebra nada - a `service_role` no lugar da anon key.

### Cabecalhos HTTP e CSP

Todos os cabecalhos saem de [plugins/cabecalhos.ts](plugins/cabecalhos.ts), que
grava `dist/_headers` no build. **Nao declare cabecalho no `netlify.toml`**: a
Netlify nao documenta a precedencia entre os dois.

A CSP e gerada, nao escrita a mao, porque depende da URL do Supabase e do hash do
script inline do tema. Mexeu no script do tema? O hash se recalcula sozinho no
proximo build.

**Hoje ela esta em modo relatorio**: o navegador so avisa, nao bloqueia. Para ver
os avisos, abra o DevTools e, no filtro de niveis do Console, inclua
**Verbose/Info** - o Chrome registra violacao de Report-Only nesse nivel, e ela
fica invisivel com o filtro padrao.

Para passar a bloquear, troque `MODO_CSP` para `'bloqueio'` no
[vite.config.ts](vite.config.ts). Antes disso:

1. use o app por alguns dias sem aparecer aviso legitimo;
2. rode `pnpm build && pnpm preview` e percorra login, lista, dialogos e menus -
   o preview aplica exatamente a politica de producao.

Uma politica errada em bloqueio quebra a tela sem mensagem nenhuma para o
usuario, e so na parte afetada.

**Nunca resolva uma violacao de `script-src` com `'unsafe-inline'`.** E essa
diretiva que impede XSS; com ela aberta, a CSP inteira perde o sentido. O
`style-src` tem `'unsafe-inline'` por um motivo medido e documentado no plugin.

## Componentes de UI

Sao do shadcn/ui em espirito - codigo dentro do projeto, sem dependencia de
biblioteca de componentes - mas escritos a mao sobre Radix, nao gerados pela CLI.
Duas diferencas em relacao ao padrao: a altura base dos controles e 44px, porque
o mesmo layout roda em tablet dentro da cabine, e nao ha classes `animate-in`,
que exigiriam o `tw-animate-css`.

## Pendencias

Falta recuperacao de senha na tela de entrada - e ela depende de SMTP proprio,
que depende de dominio verificado. Ate la, a confirmacao de e-mail esta desligada.

A CSP esta em modo relatorio (ver Seguranca). Trocar para bloqueio e decisao
pendente, depois de um periodo de uso sem aviso.

O bundle de dependencias tem 224 kB com gzip. Realtime e Phoenix somam 18 kB que o
app nunca usa, mas remove-los exige compor os sub-pacotes do Supabase a mao e
refazer a ligacao do token de autenticacao - risco que nao compensa.
