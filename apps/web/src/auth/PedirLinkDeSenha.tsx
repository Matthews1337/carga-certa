import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { esquemaRecuperar, type CamposRecuperar } from '@/auth/esquema';
import { traduzirErroAuth } from '@/auth/mensagens';
import { MensagemDeAviso, MensagemDeErro } from '@/auth/MolduraDeEntrada';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { Spinner } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';

/** Caminho para onde o link do e-mail leva. Precisa estar liberado no painel. */
export const CAMINHO_NOVA_SENHA = '/nova-senha';

export function PedirLinkDeSenha({
  emailInicial,
  onVoltar,
}: {
  emailInicial: string;
  onVoltar: (email: string) => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);

  const form = useForm<CamposRecuperar>({
    resolver: zodResolver(esquemaRecuperar),
    defaultValues: { email: emailInicial },
  });

  const enviar = form.handleSubmit(async ({ email }) => {
    setErro(null);
    // A origem da propria pagina, e nao uma URL fixa: o mesmo codigo manda o
    // link de volta para o dev local ou para a Netlify. Se ela nao estiver na
    // lista de Redirect URLs do painel, o Supabase cai no Site URL - e o
    // DesvioDaRecuperacao ainda traz a pessoa para a tela da senha nova.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${CAMINHO_NOVA_SENHA}`,
    });
    if (error) {
      setErro(traduzirErroAuth(error));
      return;
    }
    // O Supabase responde igual com ou sem conta para o endereco, de proposito:
    // senao a tela serviria para descobrir quem tem cadastro. O texto segue.
    setEnviadoPara(email);
  });

  if (enviadoPara) {
    return (
      <div className="flex flex-col gap-4">
        <MensagemDeAviso>
          Se houver uma conta com {enviadoPara}, mandamos para lá um link para criar uma senha
          nova.
        </MensagemDeAviso>
        <p className="text-sm text-muted-foreground">
          Use o link logo: ele vence e só funciona uma vez. Se não chegar em alguns minutos,
          confira a caixa de spam.
        </p>
        <Button type="button" variant="outline" onClick={() => onVoltar(enviadoPara)}>
          Voltar para entrar
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <Campo rotulo="E-mail da conta" erro={form.formState.errors.email?.message}>
        <Input
          {...form.register('email')}
          type="email"
          autoComplete="email"
          placeholder="nome@exemplo.com"
          autoFocus
          aria-invalid={!!form.formState.errors.email}
        />
      </Campo>

      {erro ? <MensagemDeErro>{erro}</MensagemDeErro> : null}

      <Button type="submit" variant="accent" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Spinner /> : null}
        Enviar link
      </Button>

      <Button
        type="button"
        variant="ghost"
        onClick={() => onVoltar(form.getValues('email'))}
      >
        Voltar para entrar
      </Button>
    </form>
  );
}
