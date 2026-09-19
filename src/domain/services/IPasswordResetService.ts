// Interface Segregation Principle: Separate interface for account recovery
export interface IPasswordResetService {
  /**
   * Start a password reset for the account matching an email or username.
   * Resolves the same way whether or not the account exists, was throttled or
   * the email could not be delivered, so callers cannot leak which one happened.
   */
  requestReset(emailOrUsername: string): Promise<void>;

  /**
   * Redeem a reset token and set a new password.
   * @throws {InvalidResetTokenError} when the token is unknown, used or expired
   * @throws {ValidationError} when the new password does not meet the password rules
   */
  resetPassword(token: string, newPassword: string): Promise<void>;
}
