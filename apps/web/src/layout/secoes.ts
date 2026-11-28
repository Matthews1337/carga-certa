import {
  Building2,
  FileText,
  LayoutDashboard,
  Receipt,
  Route,
  Truck,
  Wallet,
} from 'lucide-react';

/**
 * Secoes do menu.
 *
 * As que ainda nao existem levam para a tela "em breve" em vez de sumirem do
 * menu: o mapa completo do produto fica visivel desde o comeco.
 *
 * Fretes e Viagens: o card do frete ja traz a viagem dele; Viagens lista as
 * viagens SEM frete (deslocamento vazio, retorno, oficina). Saiu do menu em
 * 2026-09-28 e voltou em 2026-10-15, a pedido do usuario.
 *
 * `tour` e o data-tour do link, que o tutorial de boas-vindas destaca. Fica
 * aqui, num arquivo sem React, para o teste do tutorial conferir que nenhuma
 * secao ficou sem explicacao.
 */
export const SECOES = [
  { para: '/painel', rotulo: 'Painel', icone: LayoutDashboard, tour: 'menu-painel' },
  { para: '/despesas', rotulo: 'Despesas', icone: Receipt, tour: 'menu-despesas' },
  { para: '/fretes', rotulo: 'Fretes', icone: Wallet, tour: 'menu-fretes' },
  { para: '/viagens', rotulo: 'Viagens', icone: Route, tour: 'menu-viagens' },
  { para: '/veiculos', rotulo: 'Veículos', icone: Truck, tour: 'menu-veiculos' },
  { para: '/contratantes', rotulo: 'Contratantes', icone: Building2, tour: 'menu-contratantes' },
  { para: '/documentos', rotulo: 'Documentos', icone: FileText, tour: 'menu-documentos' },
] as const;
