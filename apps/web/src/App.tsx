import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { LoginPage } from '@/auth/LoginPage';
import { RequireAuth } from '@/auth/RequireAuth';
import { Carregando } from '@/components/ui/feedback';
import { AppShell, EmBreve } from '@/layout/AppShell';

/*
  Cada secao de dominio vira um arquivo separado, baixado so quando a rota e
  visitada.

  Existem Despesas, Painel, Fretes, Veiculos e Contratantes; falta Documentos.
  Num arquivo unico, cada uma delas engordaria o
  download de TODO mundo, inclusive de quem nunca abre aquela tela.

  LoginPage fica fora de proposito: e a primeira tela de quem nao tem sessao,
  e adiar o carregamento dela so acrescentaria uma espera antes do login.
*/
const DespesasPage = lazy(() =>
  import('@/despesas/DespesasPage').then((m) => ({ default: m.DespesasPage })),
);
const PainelPage = lazy(() =>
  import('@/painel/PainelPage').then((m) => ({ default: m.PainelPage })),
);
const VeiculosPage = lazy(() =>
  import('@/veiculos/VeiculosPage').then((m) => ({ default: m.VeiculosPage })),
);
const ContratantesPage = lazy(() =>
  import('@/contratantes/ContratantesPage').then((m) => ({ default: m.ContratantesPage })),
);
const FretesPage = lazy(() =>
  import('@/fretes/FretesPage').then((m) => ({ default: m.FretesPage })),
);

export function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/despesas" replace />} />
          <Route
            path="/despesas"
            element={
              // O fallback aparece so enquanto o pedaco da rota baixa. Numa
              // conexao boa isso e imperceptivel; numa ruim, e a diferenca
              // entre uma tela vazia e um aviso de que algo esta vindo.
              <Suspense fallback={<Carregando />}>
                <DespesasPage />
              </Suspense>
            }
          />
          <Route
            path="/painel"
            element={
              <Suspense fallback={<Carregando />}>
                <PainelPage />
              </Suspense>
            }
          />
          {/* Viagens saiu do web (2026-09-28): a viagem aparece dentro do card
              do frete, e viagem sem frete e coisa do celular. Quem tinha o
              endereco salvo cai nos fretes. */}
          <Route path="/viagens" element={<Navigate to="/fretes" replace />} />
          <Route
            path="/fretes"
            element={
              <Suspense fallback={<Carregando />}>
                <FretesPage />
              </Suspense>
            }
          />
          <Route
            path="/veiculos"
            element={
              <Suspense fallback={<Carregando />}>
                <VeiculosPage />
              </Suspense>
            }
          />
          <Route
            path="/contratantes"
            element={
              <Suspense fallback={<Carregando />}>
                <ContratantesPage />
              </Suspense>
            }
          />
          <Route path="/documentos" element={<EmBreve titulo="Documentos" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/despesas" replace />} />
    </Routes>
  );
}
