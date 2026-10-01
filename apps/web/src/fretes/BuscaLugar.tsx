import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { Spinner } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import type { LugarDoFrete } from '@/fretes/esquema';
import { buscarLugares, type Coordenada } from '@/lib/rotas';
import { cn } from '@/lib/utils';

/**
 * Campo de lugar com sugestoes, como no Google Maps: digita, escolhe da lista.
 *
 * Cada busca gasta a cota do OpenRouteService, entao: so a partir de 3 letras,
 * so depois de 400 ms sem digitar, e a mesma busca nao se repete na sessao
 * (cache do TanStack Query).
 *
 * Padrao de combobox da WAI-ARIA: setas percorrem a lista, Enter escolhe, Esc
 * fecha, e o leitor de tela anuncia a opcao ativa.
 */
export function BuscaLugar({
  rotulo,
  valor,
  aoEscolher,
  perto,
  cor,
  erro,
}: {
  rotulo: string;
  valor: LugarDoFrete | null;
  aoEscolher: (lugar: LugarDoFrete | null) => void;
  /** Centro do mapa: puxa para cima o que esta perto dali. */
  perto?: Coordenada;
  /** Cor do pino correspondente no mapa. */
  cor: string;
  erro?: string;
}) {
  const id = useId();
  const [texto, setTexto] = useState(valor?.nome ?? '');
  const [termo, setTermo] = useState('');
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);

  // Lugar vindo de fora (clique no mapa, pino arrastado): mostra o nome novo.
  // So quando ha lugar: ao digitar, o valor vira null de proposito, e limpar o
  // texto aqui apagaria o que a pessoa esta escrevendo. O formulario remonta
  // o campo (key) a cada abertura, entao nao sobra texto de antes.
  useEffect(() => {
    if (valor) setTexto(valor.nome);
  }, [valor]);

  // 400 ms sem digitar para buscar.
  useEffect(() => {
    const t = setTimeout(() => setTermo(texto.trim()), 400);
    return () => clearTimeout(t);
  }, [texto]);

  // Arredondado para a chave de cache: mexer o mapa um pouco nao refaz a busca.
  const pertoArredondado = perto
    ? { lat: Math.round(perto.lat * 10) / 10, lng: Math.round(perto.lng * 10) / 10 }
    : undefined;
  const busca = useQuery({
    queryKey: ['rotas', 'buscar', termo, pertoArredondado?.lat, pertoArredondado?.lng],
    queryFn: () => buscarLugares(termo, pertoArredondado),
    enabled: aberto && termo.length >= 3 && termo !== valor?.nome,
    staleTime: 30 * 60_000,
    retry: false,
  });
  const lugares = busca.data ?? [];

  const escolher = (lugar: LugarDoFrete) => {
    aoEscolher(lugar);
    setTexto(lugar.nome);
    setAberto(false);
    setAtivo(-1);
  };

  const idLista = `${id}-lista`;
  const mostrarLista = aberto && termo.length >= 3 && termo !== valor?.nome;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium leading-none">
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: cor }} aria-hidden />
        {rotulo}
      </label>
      <div className="relative">
        <Input
          id={id}
          role="combobox"
          aria-expanded={mostrarLista}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={ativo >= 0 ? `${id}-op-${ativo}` : undefined}
          aria-invalid={!!erro}
          autoComplete="off"
          placeholder="Busque uma cidade, empresa ou endereço"
          value={texto}
          className="pr-9"
          onChange={(e) => {
            setTexto(e.target.value);
            setAberto(true);
            setAtivo(-1);
            // Mudou o texto: o lugar escolhido antes deixa de valer.
            if (valor) aoEscolher(null);
          }}
          onFocus={() => setAberto(true)}
          onBlur={() => setAberto(false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && lugares.length > 0) {
              e.preventDefault();
              setAberto(true);
              setAtivo((a) => (a + 1) % lugares.length);
            } else if (e.key === 'ArrowUp' && lugares.length > 0) {
              e.preventDefault();
              setAtivo((a) => (a <= 0 ? lugares.length - 1 : a - 1));
            } else if (e.key === 'Enter' && mostrarLista && lugares[ativo]) {
              // Sem isto, o Enter enviaria o formulario inteiro.
              e.preventDefault();
              escolher(lugares[ativo]);
            } else if (e.key === 'Escape' && mostrarLista) {
              // So fecha a lista; o Esc seguinte fecha o dialogo.
              e.stopPropagation();
              setAberto(false);
            }
          }}
        />
        <div className="absolute inset-y-0 right-2 flex items-center">
          {busca.isFetching ? (
            <Spinner className="text-muted-foreground" />
          ) : texto ? (
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label={`Limpar ${rotulo.toLowerCase()}`}
              onClick={() => {
                setTexto('');
                aoEscolher(null);
              }}
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {mostrarLista ? (
          <ul
            id={idLista}
            role="listbox"
            aria-label={`Sugestões para ${rotulo.toLowerCase()}`}
            className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover py-1 text-sm shadow-lg"
          >
            {busca.isError ? (
              <li className="px-3 py-2 text-destructive">{(busca.error as Error).message}</li>
            ) : lugares.length === 0 ? (
              <li className="px-3 py-2 text-muted-foreground">
                {busca.isFetching ? 'Buscando...' : 'Nada encontrado. Tente outro nome, ou marque no mapa.'}
              </li>
            ) : (
              lugares.map((lugar, i) => (
                <li
                  key={`${lugar.lat},${lugar.lng},${i}`}
                  id={`${id}-op-${i}`}
                  role="option"
                  aria-selected={i === ativo}
                  className={cn('cursor-pointer px-3 py-2', i === ativo ? 'bg-secondary' : 'hover:bg-secondary')}
                  // mousedown, e nao click: o click chega depois do blur do
                  // campo, que ja teria fechado a lista.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    escolher(lugar);
                  }}
                >
                  {lugar.nome}
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
    </div>
  );
}
