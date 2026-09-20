import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
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
});
