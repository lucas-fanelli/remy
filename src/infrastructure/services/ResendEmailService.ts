import { EmailMessage, IEmailService } from '@/domain/services/IEmailService';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Remy <noreply@remy-recipes.com>';
const REQUEST_TIMEOUT_MS = 10_000;

// Single Responsibility Principle: Only handles outbound email delivery
// Talks to the Resend REST API directly with fetch, so no SDK dependency is needed.
export class ResendEmailService implements IEmailService {
  private readonly apiKey: string;
  private readonly from: string;

  constructor(apiKey?: string, from?: string) {
    this.apiKey = apiKey ?? process.env.RESEND_API_KEY ?? '';
    this.from = from || process.env.EMAIL_FROM || DEFAULT_FROM;
  }

  async send(message: EmailMessage): Promise<boolean> {
    if (!this.apiKey) {
      return this.handleMissingKey(message);
    }

    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        // Status only: the provider's error body can echo the request, and the
        // message body carries a single-use secret (the reset link).
        console.error(`[EMAIL] Resend rejected "${message.subject}" with HTTP ${response.status}`);
        return false;
      }

      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'UnknownError';
      console.error(`[EMAIL] Could not reach Resend for "${message.subject}" (${reason})`);
      return false;
    }
  }

  private handleMissingKey(message: EmailMessage): boolean {
    if (process.env.NODE_ENV === 'development') {
      // Local development has no provider: print the message so flows that
      // depend on an emailed link can be exercised from the server console.
      console.info(
        `[EMAIL] RESEND_API_KEY is not set; email not sent. Development preview:\n` +
          `To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`
      );
      // The console is the inbox here: report it as delivered, or the caller
      // would withdraw the link that was just printed
      return true;
    }

    // Never log the body outside development: it contains the reset link.
    console.error(`[EMAIL] RESEND_API_KEY is not set; "${message.subject}" was not sent`);
    return false;
  }
}
