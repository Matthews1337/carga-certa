/**
 * Se o tutorial de boas-vindas ainda deve aparecer.
 *
 * A marca principal fica nos metadados do usuario no Supabase Auth
 * (`user_metadata.tutorial`): vale em qualquer aparelho, sem migration e sem
 * tabela nova. A copia no navegador cobre a gravacao que falhou por falta de
 * sinal - sem ela, o tour voltaria a cada F5 ate a rede voltar.
 */

export type FimDoTutorial = 'concluido' | 'pulado';

type UsuarioComMetadados = {
  id: string;
  user_metadata?: Record<string, unknown> | null;
};

type LeitorDeArmazenamento = Pick<Storage, 'getItem'>;

export function chaveLocalDoTutorial(usuarioId: string): string {
  return `carga-certa:tutorial:${usuarioId}`;
}

export function fimRegistradoNoServidor(usuario: UsuarioComMetadados): FimDoTutorial | null {
  const valor = usuario.user_metadata?.tutorial;
  return valor === 'concluido' || valor === 'pulado' ? valor : null;
}

export function fimRegistradoNoAparelho(
  usuarioId: string,
  armazenamento: LeitorDeArmazenamento | null,
): FimDoTutorial | null {
  try {
    const valor = armazenamento?.getItem(chaveLocalDoTutorial(usuarioId));
    return valor === 'concluido' || valor === 'pulado' ? valor : null;
  } catch {
    // Navegacao privada em alguns navegadores lanca ao ler o localStorage.
    return null;
  }
}

export function tutorialPendente(
  usuario: UsuarioComMetadados,
  armazenamento: LeitorDeArmazenamento | null,
): boolean {
  return (
    fimRegistradoNoServidor(usuario) === null &&
    fimRegistradoNoAparelho(usuario.id, armazenamento) === null
  );
}
