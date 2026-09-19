import { buildPasswordResetEmail } from '../../passwordResetEmail';

const TOKEN = 'abc123_-TOKEN';
const resetUrl = `https://remy-recipes.com/auth/reset-password?token=${TOKEN}`;

const build = (overrides = {}) =>
  buildPasswordResetEmail({
    to: 'chef@example.com',
    username: 'chef',
    resetUrl,
    expiresInMinutes: 60,
    ...overrides,
  });

describe('buildPasswordResetEmail', () => {
  it('should address the email to the account owner', () => {
    expect(build().to).toBe('chef@example.com');
  });

  it('should contain the reset link in the plain text body', () => {
    expect(build().text).toContain(resetUrl);
  });

  it('should contain the reset link in the HTML body', () => {
    expect(build().html).toContain(`href="${resetUrl}"`);
  });

  it('should be bilingual with Spanish before English', () => {
    const { text, html, subject } = build();

    expect(text.indexOf('Hola chef')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('Hola chef')).toBeLessThan(text.indexOf('Hi chef'));
    expect(html.indexOf('lang="es"')).toBeLessThan(html.indexOf('lang="en"'));
    expect(subject.indexOf('contraseña')).toBeLessThan(subject.indexOf('password'));
  });

  it('should say in both languages that the link expires in 60 minutes', () => {
    const { text } = build();

    expect(text).toContain('vence en 60 minutos');
    expect(text).toContain('expires in 60 minutes');
  });

  it('should say in both languages that the request can be ignored', () => {
    const { text } = build();

    expect(text).toContain('ignorá este correo');
    expect(text).toContain('you can ignore this email');
  });

  it('should keep the raw token out of everything except the link', () => {
    const { subject, text, html } = build();

    expect(subject).not.toContain(TOKEN);
    expect(text.split(resetUrl).join('')).not.toContain(TOKEN);
    expect(html.split(resetUrl).join('')).not.toContain(TOKEN);
  });

  it('should escape HTML in user-controlled values', () => {
    const { html } = build({ username: '<img src=x onerror=alert(1)>' });

    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('should escape quotes and ampersands in the link', () => {
    const { html } = build({ resetUrl: 'https://remy-recipes.com/?a=1&b="2"&c=\'3\'' });

    expect(html).toContain(
      'href="https://remy-recipes.com/?a=1&amp;b=&quot;2&quot;&amp;c=&#39;3&#39;"'
    );
  });
});
