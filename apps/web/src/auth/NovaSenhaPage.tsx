import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { esquemaNovaSenha, type CamposNovaSenha } from '@/auth/esquema';
import { traduzirErroAuth } from '@/auth/mensagens';
import { MensagemDeErro, MolduraDeEntrada } from '@/auth/MolduraDeEntrada';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { Carregando, Spinner } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';

/**
 * Destino do link de redefinicao de senha.
 *
 * O link chega com a sessao no fragmento da URL, e o supabase-js a grava
 * sozinho (detectSessionInUrl). Por isso a tela fica fora do RequireAuth mas
 * so mostra o formulario com sessao: sem ela, o link venceu, ja foi usado ou a
 * pagina foi aberta direto - nos tres casos, o caminho e pedir outro.
 */
export function NovaSenhaPage() {
  const { session, carregando } = useAuth();
  const navegar = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const [gravada, setGravada] = useState(false);

  const form = useForm<CamposNovaSenha>({
    resolver: zodResolver(esquemaNovaSenha),
    defaultValues: { senha: '', repetir: '' },
  });

  if (carregando) return <Carregando texto="Conferindo o link..." />;

  if (gravada) {
    return (
      <MolduraDeEntrada descricao="Senha nova salva">
        <div className="flex flex-col gap-4">
          <p role="status" className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            Pronto. Da próxima vez, entre com a senha nova.
          </p>
          <Button variant="accent" onClick={() => navegar('/despesas', { replace: true })}>
            Continuar
          </Button>
        </div>
      </MolduraDeEntrada>
    );
  }

  if (!session) {
    return (
      <MolduraDeEntrada descricao="Este link não vale mais">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            O link para criar a senha nova vence depois de um tempo e só funciona uma vez. Peça
            outro na tela de entrada, em "Esqueci minha senha".
          </p>
          <Button asChild variant="accent">
            <Link to="/entrar" replace>
              Ir para a tela de entrada
            </Link>
          </Button>
        </div>
      </MolduraDeEntrada>
    );
  }

  const enviar = form.handleSubmit(async ({ senha }) => {
    setErro(null);
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) {
      setErro(traduzirErroAuth(error));
      return;
    }
    setGravada(true);
  });

  return (
    <MolduraDeEntrada descricao={`Crie uma senha nova para ${session.user.email ?? 'sua conta'}`}>
      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        {/*
          Campo de usuario escondido: e por ele que o gerenciador de senhas do
          navegador sabe de qual conta e a senha nova que vai guardar.
        */}
        <input
          type="email"
          name="email"
          autoComplete="username"
          value={session.user.email ?? ''}
          readOnly
          hidden
        />

        <Campo
          rotulo="Senha nova"
          erro={form.formState.errors.senha?.message}
          dica="Pelo menos 8 caracteres"
        >
          <Input
            {...form.register('senha')}
            type="password"
            autoComplete="new-password"
            autoFocus
            aria-invalid={!!form.formState.errors.senha}
          />
        </Campo>

        <Campo rotulo="Repita a senha nova" erro={form.formState.errors.repetir?.message}>
          <Input
            {...form.register('repetir')}
            type="password"
            autoComplete="new-password"
            aria-invalid={!!form.formState.errors.repetir}
          />
        </Campo>

        {erro ? <MensagemDeErro>{erro}</MensagemDeErro> : null}

        <Button type="submit" variant="accent" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null}
          Salvar senha nova
        </Button>
      </form>
    </MolduraDeEntrada>
  );
}
