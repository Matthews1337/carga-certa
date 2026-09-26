import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { LoginPage } from '@/auth/LoginPage';
import { RequireAuth } from '@/auth/RequireAuth';
import { Carregando } from '@/components/ui/feedback';
import { AppShell, EmBreve } from '@/layout/AppShell';

/*
  Cada secao de dominio vira um arquivo separado, baixado so quando a rota e
  visitada.

  Hoje o ganho e modesto - so Despesas existe de fato. O motivo de fazer agora
  e outro: faltam seis secoes (painel, viagens, fretes, veiculos, contratantes,
  documentos). Num arquivo unico, cada uma delas engorda o download de TODO
  mundo, inclusive de quem nunca abre aquela tela. Montar a divisao depois
  custa o mesmo e significa ter servido lento no meio tempo.

  LoginPage fica fora de proposito: e a primeira tela de quem nao tem sessao,
  e adiar o carregamento dela so acrescentaria uma espera antes do login.
*/
const DespesasPage = lazy(() =>
  import('@/despesas/DespesasPage').then((m) => ({ default: m.DespesasPage })),
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
          <Route path="/painel" element={<EmBreve titulo="Painel" />} />
          <Route path="/viagens" element={<EmBreve titulo="Viagens" />} />
          <Route path="/fretes" element={<EmBreve titulo="Fretes" />} />
          <Route path="/veiculos" element={<EmBreve titulo="Veiculos" />} />
          <Route path="/contratantes" element={<EmBreve titulo="Contratantes" />} />
          <Route path="/documentos" element={<EmBreve titulo="Documentos" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/despesas" replace />} />
    </Routes>
  );
}
