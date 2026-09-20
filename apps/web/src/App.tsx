import { Navigate, Route, Routes } from 'react-router-dom';

import { LoginPage } from '@/auth/LoginPage';
import { RequireAuth } from '@/auth/RequireAuth';
import { AppShell, EmBreve } from '@/layout/AppShell';
import { DespesasPage } from '@/despesas/DespesasPage';

export function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/despesas" replace />} />
          <Route path="/despesas" element={<DespesasPage />} />
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
