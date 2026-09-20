export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

// Interface Segregation Principle: Separate interface for outbound email
export interface IEmailService {
  /**
   * Deliver a transactional email. Resolves true when the message reached its
   * reader (the provider accepted it, or the development console preview was
   * printed) and false otherwise. Never rejects: delivery problems are logged by the
   * implementation so they cannot change the caller's HTTP response.
   */
  send(message: EmailMessage): Promise<boolean>;
}
