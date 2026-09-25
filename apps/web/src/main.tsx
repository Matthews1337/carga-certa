import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from '@/App';
import { AuthProvider } from '@/auth/AuthProvider';
import { TemaProvider } from '@/tema/TemaProvider';

import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // O dado muda pouco dentro de uma sessao de trabalho e a conexao pode ser
      // ruim; refazer a consulta a cada foco de janela so gasta rede.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      // Erro de RLS ou de validacao nao melhora com insistencia. Uma repeticao
      // cobre a queda de rede momentanea, que e o caso que realmente acontece.
      retry: 1,
    },
  },
});

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Elemento #root nao encontrado no index.html');

createRoot(raiz).render(
  <StrictMode>
    <TemaProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </TemaProvider>
  </StrictMode>,
);
