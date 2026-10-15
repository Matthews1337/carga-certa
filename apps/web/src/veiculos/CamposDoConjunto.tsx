import { formatarPlaca } from '@carga-certa/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { Campo } from '@/components/ui/campo';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { chavesVeiculos, listarVeiculos, type VeiculoDaLista } from '@/veiculos/api';
import { SEM_VINCULO } from '@/viagens/esquema';

/**
 * O conjunto da viagem: caminhao ou cavalo (obrigatorio) e carreta (opcional).
 * Usado nos formularios de frete e de viagem.
 */
export function CamposDoConjunto({
  tracao,
  reboque,
  aoMudarTracao,
  aoMudarReboque,
  erroTracao,
}: {
  tracao: string;
  /** SEM_VINCULO quando nao tem carreta. */
  reboque: string;
  aoMudarTracao: (id: string) => void;
  aoMudarReboque: (id: string) => void;
  erroTracao?: string;
}) {
  const veiculos = useQuery({ queryKey: chavesVeiculos.lista, queryFn: listarVeiculos });

  // Veiculo inativo que ja esta na viagem continua na lista, para a edicao nao
  // trocar o caminhao por baixo do usuario.
  const tracoes = (veiculos.data ?? []).filter((v) => v.natureza === 'TRACAO' && (v.ativo || v.id === tracao));
  const reboques = (veiculos.data ?? []).filter(
    (v) => v.natureza === 'REBOQUE' && (v.ativo || v.id === reboque),
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Caminhão ou cavalo" erro={erroTracao}>
          <Select value={tracao} onValueChange={aoMudarTracao}>
            <SelectTrigger aria-invalid={!!erroTracao}>
              <SelectValue placeholder={veiculos.isPending ? 'Carregando...' : 'Escolha'} />
            </SelectTrigger>
            <SelectContent>
              {tracoes.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {descreverVeiculo(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo rotulo="Carreta">
          <Select value={reboque} onValueChange={aoMudarReboque}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_VINCULO}>Sem carreta</SelectItem>
              {reboques.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {descreverVeiculo(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
      </div>
      {veiculos.isSuccess && tracoes.length === 0 ? (
        <p className="-mt-2 text-sm text-muted-foreground">
          Nenhum caminhão ou cavalo cadastrado.{' '}
          <Link to="/veiculos" className="font-medium text-foreground underline underline-offset-4">
            Cadastrar em Veículos
          </Link>
        </p>
      ) : null}
    </>
  );
}

/** "RTA1B23 · Cavalo trucado · Scania R450". */
function descreverVeiculo(v: VeiculoDaLista): string {
  return [formatarPlaca(v.placa), v.tipo?.nome, [v.marca, v.modelo].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(' · ');
}
