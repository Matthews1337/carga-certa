import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

import { problemasDoAmbiente } from './src/lib/env';

const raiz = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ command, mode }) => {
  /*
    Recusa o build quando as variaveis do Supabase estao erradas.

    O Vite grava esses valores dentro do bundle, entao um erro aqui so
    apareceria no navegador do usuario - como 404 com codigo do PostgREST, ou
    "Invalid supabaseUrl" num arquivo minificado. Falhar no build faz o erro
    aparecer no log da Netlify, com o valor correto escrito na mensagem, e o
    deploy quebrado nunca chega a ser publicado.

    So no build: no dev server, a mesma checagem roda na inicializacao do app
    (src/lib/supabase.ts), e o Vitest carrega este arquivo sem precisar de
    Supabase nenhum.
  */
  if (command === 'build') {
    const problema = problemasDoAmbiente(loadEnv(mode, raiz, 'VITE_'));
    if (problema) throw new Error(`\n\n${problema}\n`);
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      // @carga-certa/shared e um link do workspace publicado como TypeScript.
      // Sem a exclusao, o pre-bundler tenta empacotar o .ts como se fosse um
      // pacote compilado e a edicao no shared para de refletir no dev server.
      exclude: ['@carga-certa/shared'],
    },
    server: {
      port: 5173,
    },

    build: {
      /*
        O aviso padrao dispara em 500 kB e aqui seria ruido: o chunk de
        dependencias e grande DE PROPOSITO, para ser cacheado inteiro. Elevar
        para 800 kB nao e varrer para baixo do tapete - e mover o alarme para
        onde ele volta a significar alguma coisa. Se o vendor passar disso,
        alguem instalou algo pesado e vale olhar.
      */
      chunkSizeWarningLimit: 800,

      rollupOptions: {
        output: {
          /*
            Um unico chunk para todas as dependencias, separado do codigo do app.

            O ganho nao e na primeira visita - o total baixado e o mesmo. E nas
            seguintes: sem a divisao, cada deploy troca o hash do arquivo unico e
            o motorista rebaixa 236 kB mesmo que so um texto tenha mudado. Com
            ela, o pedaco pesado fica no cache e volta so o codigo do app.
            Importa mais aqui do que na media: uso diario, conexao ruim.

            POR QUE UM SO, e nao um por biblioteca: separar o React do que depende
            dele quebra a pagina com "Cannot read properties of undefined
            (reading 'useLayoutEffect')". A ordem de avaliacao entre chunks nao
            garante que o React esteja pronto quando um pacote que o consome no
            topo do modulo e executado. O erro nao aparece no build - so no
            navegador, em tela branca. Mantenha tudo junto.
          */
          manualChunks(id) {
            return id.includes('node_modules') ? 'vendor' : undefined;
          },
        },
      },
    },
  };
});
