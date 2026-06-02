// Resend transactional email wrapper. No SDK — a single fetch keeps deps minimal.
// In dev (RESEND_API_KEY empty) we log the code to the server console instead.

import { env, RESEND_ENABLED } from '../config/env.js';

const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Renders the password-reset email in both HTML and plain text.
 * Identidade visual Inspirare: header verde escuro com nome em Playfair Display,
 * card branco centralizado, código em caixa mono com letter-spacing.
 *
 * @param {{ code: string, ttlMinutes: number }} params
 * @returns {{ subject: string, html: string, text: string }}
 */
export function renderResetCodeEmail({ code, ttlMinutes }) {
  const subject = 'Seu código de recuperação - Inspirare';

  const text =
    `Olá!\n\n` +
    `Recebemos uma solicitação para redefinir a senha da sua conta no Inspirare.\n\n` +
    `Seu código de validação é:\n\n` +
    `    ${code}\n\n` +
    `Esse código expira em ${ttlMinutes} minutos. Se você não fez essa solicitação, ` +
    `pode ignorar esta mensagem com segurança — sua senha continua a mesma.\n\n` +
    `Estamos aqui se precisar de qualquer coisa.\n\n` +
    `Com carinho,\n` +
    `Equipe Inspirare\n`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#f9fbf9; font-family: 'Poppins', Helvetica, Arial, sans-serif; color:#3A503D;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f9fbf9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="480" style="max-width:480px; width:100%;">

          <!-- Header verde escuro -->
          <tr>
            <td style="background: linear-gradient(135deg, #3A503D 0%, #4a6450 100%); padding: 36px 30px; border-radius: 16px 16px 0 0; text-align:center;">
              <h1 style="margin:0; font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; font-size: 36px; color:#ffffff; font-weight: 700; letter-spacing: 0.5px;">Inspirare</h1>
              <p style="margin: 8px 0 0 0; font-size: 13px; color:#C4D4C5; font-weight: 300; letter-spacing: 1.5px; text-transform: uppercase;">Seu espaço de acolhimento</p>
            </td>
          </tr>

          <!-- Card branco com conteúdo -->
          <tr>
            <td style="background-color:#ffffff; padding: 40px 36px; border-radius: 0 0 16px 16px; box-shadow: 0 15px 35px rgba(58, 80, 61, 0.08);">

              <p style="margin: 0 0 18px 0; font-size: 16px; line-height: 1.6; color:#3A503D;">
                Olá! 💚
              </p>

              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color:#3A503D;">
                Recebemos uma solicitação para redefinir a senha da sua conta. Para manter tudo seguro, confirmamos esse pedido com um código de validação:
              </p>

              <!-- Caixa do código -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 8px 0 28px 0;">
                <tr>
                  <td align="center" style="background-color:#eef3ee; border: 1.5px dashed #91A697; border-radius: 14px; padding: 26px 16px;">
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 700; color:#3A503D; letter-spacing: 12px; padding-left: 12px; line-height: 1;">${code}</div>
                    <div style="margin-top: 14px; font-size: 11px; color:#91A697; letter-spacing: 2px; text-transform: uppercase;">Válido por ${ttlMinutes} minutos</div>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.7; color:#3A503D;">
                Cole este código na tela de recuperação para escolher uma nova senha. Se você <strong>não</strong> fez essa solicitação, pode ignorar esta mensagem com tranquilidade — sua senha continua a mesma e nenhuma alteração foi feita na sua conta.
              </p>

              <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 1.7; color:#3A503D;">
                Estamos por aqui sempre que você precisar. 💚
              </p>

              <p style="margin: 28px 0 0 0; font-size: 14px; color:#3A503D;">
                Com carinho,<br>
                <strong>Equipe Inspirare</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 16px; text-align:center;">
              <p style="margin: 0; font-size: 12px; color:#91A697; line-height: 1.6;">
                © ${new Date().getFullYear()} Inspirare. Todos os direitos reservados.<br>
                Você recebeu este e-mail porque há uma conta cadastrada com este endereço.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * Sends a transactional email. If Resend is not configured, logs the message
 * to the server console so devs can read the 6-digit code without leaving the terminal.
 *
 * @param {{ to: string, subject: string, html?: string, text?: string }} msg
 * @returns {Promise<{ id?: string, devLogged: boolean }>}
 */
export async function sendEmail(msg) {
  const { to, subject, html, text } = msg;
  if (!to || !subject) {
    throw new Error('sendEmail: `to` and `subject` are required');
  }
  if (!html && !text) {
    throw new Error('sendEmail: must provide `html` or `text`');
  }

  if (!RESEND_ENABLED) {
    console.log(`[resend] RESEND_API_KEY not set; logging email to console instead.`);
    console.log(`[resend] To: ${to}`);
    console.log(`[resend] Subject: ${subject}`);
    if (text) console.log(`[resend] Body:\n${text}`);
    return { devLogged: true };
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [to],
      subject,
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[resend] send failed: ${res.status} ${res.statusText} body=${body}`);
    throw new Error(`Resend send failed (${res.status})`);
  }

  const data = await res.json().catch(() => ({}));
  return { id: data.id, devLogged: false };
}
