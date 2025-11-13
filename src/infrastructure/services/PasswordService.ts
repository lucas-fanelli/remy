import bcrypt from 'bcryptjs';
import { IPasswordService } from '@/domain/services/IPasswordService';

// Single Responsibility Principle: Only handles password operations
export class PasswordService implements IPasswordService {
  private readonly saltRounds = 10;
  private readonly minLength = 8;
  private readonly maxLength = 128;

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async compare(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  validate(password: string): boolean {
    if (!password || password.length < this.minLength || password.length > this.maxLength) {
      return false;
    }

    // Password must contain at least:
    // - One uppercase letter
    // - One lowercase letter
    // - One number
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);

    return hasUpperCase && hasLowerCase && hasNumber;
  }
}
