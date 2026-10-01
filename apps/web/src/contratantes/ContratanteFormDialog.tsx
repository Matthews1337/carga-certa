import { zodResolver } from '@hookform/resolvers/zod';
import {
  formatarCnpj,
  formatarTelefone,
  isCnpjValido,
  isTelefoneValido,
  limparCnpj,
  limparTelefone,
} from '@carga-certa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FocusEvent } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import {
  chavesContratantes,
  listarContratantes,
  salvarContratante,
  type Contratante,
} from '@/contratantes/api';
import { esquemaContratante, paraRegistro, type CamposContratante } from '@/contratantes/esquema';

export function ContratanteFormDialog({
  aberto,
  aoFechar,
  contratante,
}: {
  aberto: boolean;
  aoFechar: () => void;
  /** Ausente = criando. */
  contratante?: Contratante;
}) {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);

  // A mesma consulta da pagina, ja em cache: serve para avisar CNPJ repetido.
  const contratantes = useQuery({
    queryKey: chavesContratantes.lista,
    queryFn: listarContratantes,
  });

  const form = useForm<CamposContratante>({
    resolver: zodResolver(esquemaContratante),
    defaultValues: valoresIniciais(contratante),
  });

  // O dialogo e reaproveitado entre "novo" e "editar"; sem o reset, mostraria
  // o contratante anterior.
  useEffect(() => {
    if (aberto) {
      form.reset(valoresIniciais(contratante));
      setErro(null);
    }
  }, [aberto, contratante, form]);

  const gravar = useMutation({
    mutationFn: (campos: CamposContratante) =>
      salvarContratante(paraRegistro(campos), contratante?.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chavesContratantes.todos });
      aoFechar();
    },
    onError: (e: unknown) => setErro(e instanceof Error ? e.message : String(e)),
  });

  // Aviso, e nao bloqueio: duas filiais tem CNPJs diferentes, mas o mesmo CNPJ
  // cadastrado duas vezes quase sempre e engano - so que pode ser de proposito
  // (dois contatos na mesma empresa), e quem decide e o usuario.
  const cnpjDigitado = limparCnpj(form.watch('cnpj') ?? '');
  const mesmoCnpj =
    cnpjDigitado.length === 14
      ? contratantes.data?.find((c) => c.cnpj === cnpjDigitado && c.id !== contratante?.id)
      : undefined;

  const erros = form.formState.errors;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{contratante ? 'Editar contratante' : 'Novo contratante'}</DialogTitle>
          <DialogDescription>Só o nome é obrigatório.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit((c) => gravar.mutate(c))}
          className="flex flex-col gap-4"
          noValidate
        >
          <Campo
            rotulo="Nome"
            erro={erros.nome?.message}
            dica="Razão social, ou o nome pelo qual você conhece a empresa"
          >
            <Input
              {...form.register('nome')}
              placeholder="Agro Cerrado Ltda"
              aria-invalid={!!erros.nome}
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              rotulo="CNPJ"
              erro={erros.cnpj?.message}
              dica={mesmoCnpj ? `Mesmo CNPJ de "${mesmoCnpj.nome}", já cadastrado.` : undefined}
            >
              <Input
                {...form.register('cnpj', {
                  // Ao sair do campo, mostra formatado. Continua sendo gravado limpo.
                  onBlur: (e: FocusEvent<HTMLInputElement>) => {
                    if (isCnpjValido(e.target.value)) {
                      form.setValue('cnpj', formatarCnpj(e.target.value));
                    }
                  },
                })}
                className="uppercase"
                placeholder="00.000.000/0000-00"
                autoComplete="off"
                aria-invalid={!!erros.cnpj}
              />
            </Campo>

            <Campo rotulo="Telefone" erro={erros.telefone?.message}>
              <Input
                {...form.register('telefone', {
                  onBlur: (e: FocusEvent<HTMLInputElement>) => {
                    if (isTelefoneValido(e.target.value)) {
                      form.setValue('telefone', formatarTelefone(limparTelefone(e.target.value)));
                    }
                  },
                })}
                type="tel"
                inputMode="tel"
                placeholder="(62) 99999-8888"
                aria-invalid={!!erros.telefone}
              />
            </Campo>
          </div>

          <Campo rotulo="Contato" erro={erros.contato?.message}>
            <Input
              {...form.register('contato')}
              placeholder="Marcos, da expedição"
              aria-invalid={!!erros.contato}
            />
          </Campo>

          {erro ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {erro}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" variant="accent" disabled={gravar.isPending}>
              {gravar.isPending ? <Spinner /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function valoresIniciais(contratante?: Contratante): CamposContratante {
  return {
    nome: contratante?.nome ?? '',
    cnpj: contratante?.cnpj ? formatarCnpj(contratante.cnpj) : '',
    contato: contratante?.contato ?? '',
    telefone: contratante?.telefone ? formatarTelefone(contratante.telefone) : '',
  };
}
