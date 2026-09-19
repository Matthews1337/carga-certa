/**
 * Caminhos dos buckets do Storage.
 *
 * A policy de `storage.objects` compara o primeiro segmento da pasta com
 * `auth.uid()` (ver supabase/migrations/20260919120200_storage.sql). Um caminho
 * montado a mao com a ordem trocada e rejeitado pelo servidor no upload, que e
 * tarde demais quando o motorista esta sem sinal e a foto so vai subir depois.
 * Montar sempre por estas funcoes evita descobrir o erro na fila de retry.
 *
 * O banco guarda o caminho, nunca a URL: a URL assinada e gerada na exibicao e
 * expira.
 */

export const BUCKET_COMPROVANTES = 'comprovantes';
export const BUCKET_DOCUMENTOS = 'documentos';

export type ExtensaoArquivo = 'jpg' | 'jpeg' | 'png' | 'webp' | 'pdf';

function montar(pilotoId: string, id: string, extensao: ExtensaoArquivo): string {
  return `${pilotoId}/${id}.${extensao}`;
}

/** comprovantes/{piloto_id}/{despesa_id}.jpg */
export function caminhoComprovante(
  pilotoId: string,
  despesaId: string,
  extensao: ExtensaoArquivo = 'jpg',
): string {
  return montar(pilotoId, despesaId, extensao);
}

/** documentos/{piloto_id}/{documento_id}.pdf */
export function caminhoDocumento(
  pilotoId: string,
  documentoId: string,
  extensao: ExtensaoArquivo = 'pdf',
): string {
  return montar(pilotoId, documentoId, extensao);
}

/** Confere se o caminho pertence ao usuario - a mesma regra que a policy aplica. */
export function caminhoPertenceAoPiloto(caminho: string, pilotoId: string): boolean {
  return caminho.split('/')[0] === pilotoId;
}
