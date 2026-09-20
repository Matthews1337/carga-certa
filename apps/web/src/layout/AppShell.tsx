import {
  Building2,
  Construction,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Route,
  Truck,
  Wallet,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Navegacao do app.
 *
 * O web espelha o mobile, entao a lista ja contempla todas as secoes. As que
 * ainda nao existem levam para a tela "em breve" em vez de sumirem do menu: o
 * mapa completo do produto fica visivel desde o comeco.
 */
const SECOES = [
  { para: '/painel', rotulo: 'Painel', icone: LayoutDashboard },
  { para: '/despesas', rotulo: 'Despesas', icone: Receipt },
  { para: '/viagens', rotulo: 'Viagens', icone: Route },
  { para: '/fretes', rotulo: 'Fretes', icone: Wallet },
  { para: '/veiculos', rotulo: 'Veiculos', icone: Truck },
  { para: '/contratantes', rotulo: 'Contratantes', icone: Building2 },
  { para: '/documentos', rotulo: 'Documentos', icone: FileText },
] as const;

export function AppShell() {
  const { user, sair } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      {/* Barra superior: so aparece no estreito, onde a lateral vira gaveta */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2 font-semibold">
          <Truck className="size-5 text-accent" aria-hidden />
          Carga Certa
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMenuAberto((v) => !v)}
          aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuAberto}
        >
          {menuAberto ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </header>

      <aside
        className={cn(
          'shrink-0 border-border bg-card',
          'lg:sticky lg:top-0 lg:flex lg:h-svh lg:w-60 lg:flex-col lg:border-r',
          menuAberto ? 'block border-b' : 'hidden lg:flex',
        )}
      >
        <div className="hidden items-center gap-2 px-5 py-5 text-lg font-semibold lg:flex">
          <Truck className="size-5 text-accent" aria-hidden />
          Carga Certa
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          {SECOES.map(({ para, rotulo, icone: Icone }) => (
            <NavLink
              key={para}
              to={para}
              onClick={() => setMenuAberto(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                )
              }
            >
              <Icone className="size-4 shrink-0" aria-hidden />
              {rotulo}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <p className="truncate px-3 pb-2 text-xs text-muted-foreground" title={user?.email ?? ''}>
            {user?.email}
          </p>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => void sair()}>
            <LogOut className="size-4" aria-hidden />
            Sair
          </Button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}

export function EmBreve({ titulo }: { titulo: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
      <Construction className="size-8 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-semibold">{titulo}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Esta secao ainda nao foi construida. A fatia de Despesas esta completa e serve de modelo
        para as demais.
      </p>
    </div>
  );
}
