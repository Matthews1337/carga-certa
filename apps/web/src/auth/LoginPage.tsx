import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import {
  esquemaEntrada,
  validarNome,
  type CamposEntrada,
  type Modo,
} from '@/auth/esquema';
import { traduzirErroAuth } from '@/auth/mensagens';
import { MensagemDeAviso, MensagemDeErro, MolduraDeEntrada } from '@/auth/MolduraDeEntrada';
import { PedirLinkDeSenha } from '@/auth/PedirLinkDeSenha';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { Spinner } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';

export function LoginPage() {
  const { session } = useAuth();
  const local = useLocation();
  const [modo, setModo] = useState<Modo>('entrar');
  const [recuperando, setRecuperando] = useState(false);
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

  if (recuperando) {
    return (
      <MolduraDeEntrada descricao="Informe seu e-mail e mandamos um link para criar uma senha nova">
        <PedirLinkDeSenha
          emailInicial={form.getValues('email')}
          onVoltar={(email) => {
            form.setValue('email', email);
            setRecuperando(false);
          }}
        />
      </MolduraDeEntrada>
    );
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
        if (error) setErro(traduzirErroAuth(error));
        return;
      }

      // `nome` vai em raw_user_meta_data: a trigger on_auth_user_created le
      // esse campo para preencher public.piloto no instante do cadastro.
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: { nome },
          // O link de confirmacao volta para onde o cadastro foi feito (dev
          // local ou Netlify), e nao para o Site URL do painel.
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        setErro(traduzirErroAuth(error));
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
      setErro(primeira ? String(primeira) : 'Confira os campos do formulário.');
    },
  );

  const criando = modo === 'criar';

  return (
    <MolduraDeEntrada
      descricao={
        criando
          ? 'Crie sua conta para começar a registrar os gastos'
          : 'Entre para acompanhar seus fretes e gastos'
      }
    >
      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        {criando ? (
          <Campo rotulo="Nome" erro={form.formState.errors.nome?.message}>
            <Input
              {...form.register('nome')}
              autoComplete="name"
              placeholder="João da Silva"
              aria-invalid={!!form.formState.errors.nome}
            />
          </Campo>
        ) : null}

        <Campo rotulo="E-mail" erro={form.formState.errors.email?.message}>
          <Input
            {...form.register('email')}
            type="email"
            autoComplete="email"
            placeholder="nome@exemplo.com"
            aria-invalid={!!form.formState.errors.email}
          />
        </Campo>

        <div className="flex flex-col gap-1">
          <Campo rotulo="Senha" erro={form.formState.errors.senha?.message}>
            <Input
              {...form.register('senha')}
              type="password"
              autoComplete={criando ? 'new-password' : 'current-password'}
              aria-invalid={!!form.formState.errors.senha}
            />
          </Campo>
          {criando ? null : (
            <button
              type="button"
              className="self-end py-1 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              onClick={() => {
                setErro(null);
                setAviso(null);
                setRecuperando(true);
              }}
            >
              Esqueci minha senha
            </button>
          )}
        </div>

        {erro ? <MensagemDeErro>{erro}</MensagemDeErro> : null}
        {aviso ? <MensagemDeAviso>{aviso}</MensagemDeAviso> : null}

        <Button type="submit" variant="accent" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null}
          {criando ? 'Criar conta' : 'Entrar'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {criando ? 'Já tem conta?' : 'Ainda não tem conta?'}{' '}
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
    </MolduraDeEntrada>
  );
}
