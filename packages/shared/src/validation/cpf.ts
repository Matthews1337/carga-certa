/**
 * CPF - digito verificador.
 *
 * O banco so checa formato (`ck_piloto_cpf`: 11 digitos). O digito verificador e
 * regra de negocio e mora aqui, para web e mobile validarem igual.
 */

/** Deixa so os digitos. E nesta forma que o CPF vai para o banco. */
export function limparCpf(valor: string): string {
  return valor.replace(/\D/g, '');
}

export function isCpfValido(valor: string): boolean {
  const cpf = limparCpf(valor);
  if (cpf.length !== 11) return false;

  // 111.111.111-11 e os outros repetidos passam no calculo do DV mas nao existem.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  for (const [posicao, pesoInicial] of [
    [9, 10],
    [10, 11],
  ] as const) {
    let soma = 0;
    for (let i = 0; i < posicao; i += 1) {
      soma += Number(cpf[i]) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    const dv = resto === 10 ? 0 : resto;
    if (dv !== Number(cpf[posicao])) return false;
  }

  return true;
}

/** 000.000.000-00. Devolve a entrada intacta se nao tiver 11 digitos. */
export function formatarCpf(valor: string): string {
  const cpf = limparCpf(valor);
  if (cpf.length !== 11) return valor;
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}
