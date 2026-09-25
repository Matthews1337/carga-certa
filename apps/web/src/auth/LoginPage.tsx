import { zodResolver } from '@hookform/resolvers/zod';
import { Truck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import {
  esquemaEntrada,
  validarNome,
  type CamposEntrada,
  type Modo,
} from '@/auth/esquema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { BotaoTema } from '@/tema/BotaoTema';

export function LoginPage() {
  const { session } = useAuth();
  const local = useLocation();
  const [modo, setModo] = useState<Modo>('entrar');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const form = useForm<CamposEntrada>({
    resolver: zodResolver(esquemaEntrada),
    defaultValues: { nome: '', email: '', senha: '' },
  });

  if (session) {
    const destino = (local.state as { de?: string } | null)?.de ?? '/despesas';
    return <Navigate to={destino} replace />;
  }

  const enviar = form.handleSubmit(
    async ({ nome, email, senha }) => {
      setErro(null);
      setAviso(null);

      const erroNome = validarNome(modo, nome);
      if (erroNome) {
        form.setError('nome', { message: erroNome });
        return;
      }

      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) setErro(traduzir(error.message));
        return;
      }

      // `nome` vai em raw_user_meta_data: a trigger on_auth_user_created le
      // esse campo para preencher public.piloto no instante do cadastro.
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { nome } },
      });

      if (error) {
        setErro(traduzir(error.message));
        return;
      }

      // Com confirmacao de e-mail ligada, o signUp devolve usuario sem sessao.
      if (!data.session) {
        setAviso('Confira seu e-mail para confirmar o cadastro e depois entre.');
        setModo('entrar');
      }
    },
    // Rede de seguranca: sem este ramo, uma reprovacao de validacao num campo
    // que nao esta na tela deixa o botao sem reacao nenhuma - exatamente o que
    // acontecia quando o schema exigia tamanho minimo do nome durante o login.
    (erros) => {
      const primeira = Object.values(erros).find((e) => e?.message)?.message;
      setErro(primeira ? String(primeira) : 'Confira os campos do formulario.');
    },
  );

  const criando = modo === 'criar';

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-secondary/40 p-4">
      <div className="absolute right-3 top-3">
        <BotaoTema />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Truck className="size-6" aria-hidden />
          </div>
          <CardTitle className="text-2xl">Carga Certa</CardTitle>
          <CardDescription>
            {criando
              ? 'Crie sua conta para comecar a registrar os gastos'
              : 'Entre para acompanhar seus fretes e gastos'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
            {criando ? (
              <Campo rotulo="Nome" erro={form.formState.errors.nome?.message}>
                <Input
                  {...form.register('nome')}
                  autoComplete="name"
                  placeholder="Joao da Silva"
                  aria-invalid={!!form.formState.errors.nome}
                />
              </Campo>
            ) : null}

            <Campo rotulo="E-mail" erro={form.formState.errors.email?.message}>
              <Input
                {...form.register('email')}
                type="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                aria-invalid={!!form.formState.errors.email}
              />
            </Campo>

            <Campo rotulo="Senha" erro={form.formState.errors.senha?.message}>
              <Input
                {...form.register('senha')}
                type="password"
                autoComplete={criando ? 'new-password' : 'current-password'}
                aria-invalid={!!form.formState.errors.senha}
              />
            </Campo>

            {erro ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {erro}
              </p>
            ) : null}
            {aviso ? (
              <p role="status" className="text-sm font-medium text-success">
                {aviso}
              </p>
            ) : null}

            <Button type="submit" variant="accent" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Spinner /> : null}
              {criando ? 'Criar conta' : 'Entrar'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {criando ? 'Ja tem conta?' : 'Ainda nao tem conta?'}{' '}
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-4"
              onClick={() => {
                setModo(criando ? 'entrar' : 'criar');
                setErro(null);
                setAviso(null);
              }}
            >
              {criando ? 'Entrar' : 'Criar agora'}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Campo({
  rotulo,
  erro,
  children,
}: {
  rotulo: string;
  erro?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{rotulo}</Label>
      {children}
      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
    </div>
  );
}

/** O GoTrue responde em ingles; estas sao as mensagens que o usuario ve de fato. */
function traduzir(mensagem: string): string {
  const mapa: Record<string, string> = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
    'User already registered': 'Ja existe uma conta com este e-mail.',
    'Password should be at least 6 characters':
      'A senha precisa de pelo menos 6 caracteres.',
  };
  return mapa[mensagem] ?? mensagem;
}
