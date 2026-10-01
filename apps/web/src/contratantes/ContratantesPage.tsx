import { ehCelular, formatarCnpj, formatarTelefone, limparCnpj } from '@carga-certa/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Pencil, Phone, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmarExclusao } from '@/components/ui/confirmar-exclusao';
import { Carregando, ErroConsulta, Vazio } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import {
  chavesContratantes,
  excluirContratante,
  listarContratantes,
  type Contratante,
} from '@/contratantes/api';
import { ContratanteFormDialog } from '@/contratantes/ContratanteFormDialog';

export function ContratantesPage() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Contratante | undefined>();
  const [excluindo, setExcluindo] = useState<Contratante | null>(null);

  const contratantes = useQuery({
    queryKey: chavesContratantes.lista,
    queryFn: listarContratantes,
  });

  // Filtro no navegador: a lista inteira ja veio, e um motorista tem dezenas de
  // contratantes, nao milhares.
  const filtrados = useMemo(
    () => (contratantes.data ?? []).filter((c) => combina(c, busca)),
    [contratantes.data, busca],
  );

  const novo = () => {
    setEditando(undefined);
    setFormAberto(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contratantes</h1>
          <p className="text-sm text-muted-foreground">
            Empresas e pessoas que contratam seus fretes.
          </p>
        </div>
        <Button variant="accent" onClick={novo}>
          <Plus className="size-4" aria-hidden />
          Novo contratante
        </Button>
      </header>

      {contratantes.isPending ? (
        <Carregando />
      ) : contratantes.isError ? (
        <ErroConsulta erro={contratantes.error} />
      ) : contratantes.data.length === 0 ? (
        <Vazio
          titulo="Nenhum contratante cadastrado"
          descricao="Cadastre quem contrata seus fretes para escolher da lista na hora de lançar o frete."
          acao={
            <Button variant="accent" onClick={novo}>
              <Plus className="size-4" aria-hidden />
              Novo contratante
            </Button>
          }
        />
      ) : (
        <>
          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, CNPJ ou contato"
              aria-label="Buscar contratante"
              className="pl-9"
            />
          </div>

          {filtrados.length === 0 ? (
            <Vazio
              titulo="Nenhum contratante encontrado"
              descricao={`Nada combina com "${busca.trim()}".`}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtrados.map((c) => (
                <CartaoContratante
                  key={c.id}
                  contratante={c}
                  aoEditar={() => {
                    setEditando(c);
                    setFormAberto(true);
                  }}
                  aoExcluir={() => setExcluindo(c)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <ContratanteFormDialog
        aberto={formAberto}
        aoFechar={() => setFormAberto(false)}
        contratante={editando}
      />

      <ConfirmarExclusao
        aberto={excluindo !== null}
        titulo="Excluir contratante"
        descricao={
          excluindo
            ? `${excluindo.nome} sai da lista e não aparece mais para fretes novos. ` +
              'Os fretes já lançados continuam ligados a ele.'
            : ''
        }
        aoConfirmar={async () => {
          if (!excluindo) return;
          await excluirContratante(excluindo.id);
          await queryClient.invalidateQueries({ queryKey: chavesContratantes.todos });
        }}
        aoFechar={() => setExcluindo(null)}
      />
    </div>
  );
}

function CartaoContratante({
  contratante: c,
  aoEditar,
  aoExcluir,
}: {
  contratante: Contratante;
  aoEditar: () => void;
  aoExcluir: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="break-words font-semibold leading-snug">{c.nome}</p>
            <p className="tabular text-sm text-muted-foreground">
              {c.cnpj ? formatarCnpj(c.cnpj) : 'Sem CNPJ'}
            </p>
          </div>
          <div className="-mr-2 -mt-1 flex shrink-0 items-center">
            <Button variant="ghost" size="sm" aria-label={`Editar ${c.nome}`} onClick={aoEditar}>
              <Pencil className="size-4" aria-hidden />
            </Button>
            <Button variant="ghost" size="sm" aria-label={`Excluir ${c.nome}`} onClick={aoExcluir}>
              <Trash2 className="size-4 text-destructive" aria-hidden />
            </Button>
          </div>
        </div>

        {c.contato || c.telefone ? (
          <div className="flex flex-col gap-1.5 text-sm">
            {c.contato ? (
              <p className="flex items-center gap-2">
                <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 truncate">{c.contato}</span>
              </p>
            ) : null}
            {c.telefone ? <Telefone numero={c.telefone} /> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * O numero ja e um link de ligacao: no celular, um toque liga. Celular ganha
 * tambem o atalho do WhatsApp, que e por onde a maioria dos fretes e combinada.
 */
function Telefone({ numero }: { numero: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <a
        href={`tel:+55${numero}`}
        className="tabular flex items-center gap-2 underline-offset-4 hover:underline"
      >
        <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {formatarTelefone(numero)}
      </a>
      {ehCelular(numero) ? (
        <a
          href={`https://wa.me/55${numero}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-success underline-offset-4 hover:underline"
        >
          <MessageCircle className="size-4 shrink-0" aria-hidden />
          WhatsApp
        </a>
      ) : null}
    </div>
  );
}

/** Sem acento e sem caixa: "sao" acha "São Paulo". CNPJ compara sem mascara. */
function combina(c: Contratante, busca: string): boolean {
  const termo = normalizar(busca);
  if (termo === '') return true;
  if ([c.nome, c.contato ?? ''].some((texto) => normalizar(texto).includes(termo))) return true;
  const cnpj = limparCnpj(busca);
  return cnpj !== '' && (c.cnpj ?? '').includes(cnpj);
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}
