import {
  CARROCERIA_VEICULO,
  isPlacaValida,
  limparPlaca,
  type CarroceriaVeiculo,
  type NaturezaVeiculo,
} from '@carga-certa/shared';
import { z } from 'zod';

/**
 * Regras do formulario de veiculo.
 *
 * Os campos numericos chegam como texto e so viram numero no envio, como no
 * formulario de despesa: um <input> vazio precisa poder ser "nao informado",
 * e zod com number() transformaria vazio em zero.
 *
 * As regras repetem os CHECKs do banco (placa, ano, odometro) de proposito: o
 * banco rejeita de novo, porque cliente mente, mas aqui a mensagem aparece no
 * campo certo e em portugues, em vez de um erro de constraint.
 */

/** Tira ponto, espaco e tudo que nao for digito: "27.000" vira 27000. */
export function parseInteiro(texto: string | undefined): number | null {
  const digitos = (texto ?? '').replace(/\D/g, '');
  return digitos === '' ? null : Number(digitos);
}

export const ANO_MINIMO = 1950;
// O banco aceita ate o ano que vem: modelo 2027 e vendido em 2026.
export const ANO_MAXIMO = new Date().getFullYear() + 1;

const vazioOu = (teste: (v: string) => boolean) => (v: string) => v === '' || teste(v);

export const esquemaVeiculo = z.object({
  tipoVeiculoId: z.string().uuid('Escolha o tipo de veículo'),
  placa: z
    .string()
    .trim()
    .min(1, 'Informe a placa')
    .refine(isPlacaValida, 'Placa inválida. Use o formato ABC1D23 (Mercosul) ou ABC-1234.'),
  renavam: z
    .string()
    .trim()
    .refine(
      vazioOu((v) => /^\d{11}$/.test(v.replace(/\D/g, ''))),
      'O RENAVAM tem 11 dígitos.',
    ),
  marca: z.string().trim().max(60, 'No máximo 60 caracteres'),
  modelo: z.string().trim().max(60, 'No máximo 60 caracteres'),
  ano: z
    .string()
    .trim()
    .refine(
      vazioOu((v) => {
        const n = Number(v);
        return Number.isInteger(n) && n >= ANO_MINIMO && n <= ANO_MAXIMO;
      }),
      `Informe um ano entre ${ANO_MINIMO} e ${ANO_MAXIMO}.`,
    ),
  cor: z.string().trim().max(30, 'No máximo 30 caracteres'),
  carroceria: z.enum(CARROCERIA_VEICULO),
  capacidadeKg: z.string().trim(),
  qtdEixos: z
    .string()
    .trim()
    .refine(
      vazioOu((v) => {
        const n = parseInteiro(v);
        return n !== null && n >= 1 && n <= 12;
      }),
      'Entre 1 e 12 eixos.',
    ),
  odometroAtual: z.string().trim(),
  ativo: z.boolean(),
});

export type CamposVeiculo = z.infer<typeof esquemaVeiculo>;

/**
 * Documento do veiculo. Datas chegam do <input type="date"> como 'AAAA-MM-DD',
 * o mesmo formato da coluna `date` do banco - e texto nesse formato compara
 * certo em ordem alfabetica, entao a regra abaixo nao precisa converter nada.
 */
export const esquemaDocumento = z
  .object({
    tipoDocumentoId: z.string().uuid('Escolha o documento'),
    numero: z.string().trim().max(60, 'No máximo 60 caracteres'),
    emissao: z.string(),
    validade: z.string(),
  })
  .refine((d) => d.emissao === '' || d.validade === '' || d.validade >= d.emissao, {
    // Mesma regra do ck_documento_datas, mas com a mensagem no campo certo.
    path: ['validade'],
    message: 'A validade não pode ser antes da emissão.',
  });

export type CamposDocumento = z.infer<typeof esquemaDocumento>;

/** Linha pronta para gravar. piloto_id fica de fora: o banco preenche. */
export interface RegistroVeiculo {
  tipo_veiculo_id: string;
  natureza: NaturezaVeiculo;
  carroceria: CarroceriaVeiculo;
  placa: string;
  renavam: string | null;
  marca: string | null;
  modelo: string | null;
  ano: number | null;
  cor: string | null;
  capacidade_kg: number | null;
  qtd_eixos: number | null;
  odometro_atual: number;
  ativo: boolean;
}

/**
 * Converte o formulario na linha do banco.
 *
 * `natureza` vem do tipo escolhido, nunca do usuario: o banco tem uma FK
 * composta (tipo_veiculo_id, natureza) que recusa um "Cavalo trucado" gravado
 * como reboque. Reboque nao tem motor, entao o odometro dele e sempre zero.
 */
export function paraRegistro(campos: CamposVeiculo, natureza: NaturezaVeiculo): RegistroVeiculo {
  const texto = (v: string) => (v.trim() === '' ? null : v.trim());
  return {
    tipo_veiculo_id: campos.tipoVeiculoId,
    natureza,
    carroceria: campos.carroceria,
    placa: limparPlaca(campos.placa),
    renavam: texto(campos.renavam.replace(/\D/g, '')),
    marca: texto(campos.marca),
    modelo: texto(campos.modelo),
    ano: campos.ano === '' ? null : Number(campos.ano),
    cor: texto(campos.cor),
    capacidade_kg: parseInteiro(campos.capacidadeKg),
    qtd_eixos: parseInteiro(campos.qtdEixos),
    odometro_atual: natureza === 'TRACAO' ? (parseInteiro(campos.odometroAtual) ?? 0) : 0,
    ativo: campos.ativo,
  };
}
