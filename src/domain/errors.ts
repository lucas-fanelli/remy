export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Deliberately generic: unknown, used and expired reset tokens are
// indistinguishable to the caller.
export const INVALID_RESET_TOKEN_MESSAGE = 'This reset link is invalid or has expired';

export class InvalidResetTokenError extends Error {
  constructor(message: string = INVALID_RESET_TOKEN_MESSAGE) {
    super(message);
    this.name = 'InvalidResetTokenError';
  }
}
