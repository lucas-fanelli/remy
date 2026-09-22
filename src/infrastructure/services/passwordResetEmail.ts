import { BRANDING } from '@/config/branding';
import { EmailMessage } from '@/domain/services/IEmailService';

export type PasswordResetEmailData = {
  to: string;
  username: string;
  resetUrl: string;
  expiresInMinutes: number;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Password reset email. Bilingual — Spanish first (most readers speak it),
 * then English (the UI language). The raw token appears only inside resetUrl.
 */
export function buildPasswordResetEmail(data: PasswordResetEmailData): EmailMessage {
  const { to, username, resetUrl, expiresInMinutes } = data;
  const app = BRANDING.name;

  const text = [
    `Hola ${username}:`,
    '',
    `Recibimos un pedido para restablecer la contraseña de tu cuenta de ${app}. Abrí este enlace para elegir una nueva:`,
    '',
    resetUrl,
    '',
    `El enlace vence en ${expiresInMinutes} minutos y se puede usar una sola vez. Si no fuiste vos, ignorá este correo: tu contraseña no cambia.`,
    '',
    '----------------------------------------',
    '',
    `Hi ${username},`,
    '',
    `We received a request to reset the password for your ${app} account. Open this link to choose a new one:`,
    '',
    resetUrl,
    '',
    `The link expires in ${expiresInMinutes} minutes and can be used only once. If this wasn't you, you can ignore this email: your password stays the same.`,
    '',
    app,
  ].join('\n');

  const safeUser = escapeHtml(username);
  const safeUrl = escapeHtml(resetUrl);
  const safeApp = escapeHtml(app);
  const button = (label: string) =>
    `<p><a href="${safeUrl}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:${BRANDING.colors.primary};color:#ffffff;text-decoration:none;font-weight:600">${label}</a></p>`;

  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222222;max-width:520px">',
    `<div lang="es">`,
    `<p>Hola ${safeUser}:</p>`,
    `<p>Recibimos un pedido para restablecer la contraseña de tu cuenta de ${safeApp}.</p>`,
    button('Elegir una contraseña nueva'),
    `<p>El enlace vence en ${expiresInMinutes} minutos y se puede usar una sola vez. Si no fuiste vos, ignorá este correo: tu contraseña no cambia.</p>`,
    '</div>',
    '<hr style="border:none;border-top:1px solid #dddddd;margin:24px 0">',
    `<div lang="en">`,
    `<p>Hi ${safeUser},</p>`,
    `<p>We received a request to reset the password for your ${safeApp} account.</p>`,
    button('Choose a new password'),
    `<p>The link expires in ${expiresInMinutes} minutes and can be used only once. If this wasn&#39;t you, you can ignore this email: your password stays the same.</p>`,
    '</div>',
    `<p style="font-size:12px;color:#666666;word-break:break-all">${safeUrl}</p>`,
    '</div>',
  ].join('');

  return {
    to,
    subject: `Restablecé tu contraseña / Reset your password — ${app}`,
    text,
    html,
  };
}
