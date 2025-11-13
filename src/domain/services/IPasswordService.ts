// Interface Segregation Principle: Separate interface for password operations
export interface IPasswordService {
  hash(password: string): Promise<string>;
  compare(password: string, hashedPassword: string): Promise<boolean>;
  validate(password: string): boolean;
}
