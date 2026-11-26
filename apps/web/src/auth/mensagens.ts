/**
 * O GoTrue responde em ingles; estas sao as mensagens que o usuario ve de fato.
 *
 * O `code` vem primeiro porque e estavel entre versoes do GoTrue. O texto em
 * ingles muda de redacao de tempos em tempos, e fica so como reserva para
 * respostas antigas ou sem codigo.
 */
const POR_CODIGO: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_not_confirmed: 'Confirme seu e-mail antes de entrar. O link está na sua caixa de entrada.',
  user_already_exists: 'Já existe uma conta com este e-mail.',
  email_exists: 'Já existe uma conta com este e-mail.',
  weak_password: 'Senha fraca. Use pelo menos 8 caracteres.',
  same_password: 'A nova senha precisa ser diferente da atual.',
  over_email_send_rate_limit:
    'Já mandamos um e-mail há pouco. Espere um minuto antes de pedir outro.',
  over_request_rate_limit: 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
  email_address_invalid: 'Este endereço de e-mail não foi aceito. Confira se está certo.',
  // O servico de e-mail embutido do Supabase so entrega para a equipe do
  // projeto. Aparece se o SMTP proprio for desligado no painel.
  email_address_not_authorized:
    'Não foi possível enviar o e-mail agora. Tente mais tarde ou fale com o suporte.',
  session_not_found: 'Sua sessão expirou. Peça um novo link na tela de entrada.',
  session_expired: 'Sua sessão expirou. Peça um novo link na tela de entrada.',
};

const POR_TEXTO: Record<string, string> = {
  'Invalid login credentials': POR_CODIGO.invalid_credentials!,
  'Email not confirmed': POR_CODIGO.email_not_confirmed!,
  'User already registered': POR_CODIGO.user_already_exists!,
  'Password should be at least 6 characters': 'A senha precisa de pelo menos 6 caracteres.',
  'New password should be different from the old password.': POR_CODIGO.same_password!,
  'Auth session missing!': POR_CODIGO.session_not_found!,
};

export function traduzirErroAuth(erro: { message: string; code?: string }): string {
  return (erro.code && POR_CODIGO[erro.code]) || POR_TEXTO[erro.message] || erro.message;
}
