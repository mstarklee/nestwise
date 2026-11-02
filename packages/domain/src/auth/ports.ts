import type { NewSession, User } from './models';

export interface UserGateway {
  findByEmail(email: string): Promise<User | undefined>;
  findById(id: string): Promise<User | undefined>;
  /** Throws EmailAlreadyRegisteredError if the email is taken (the database's unique index is the real guard). */
  save(user: User): Promise<User>;
}

export interface SessionGateway {
  create(session: NewSession): Promise<void>;
  /** The user of a session that has not expired at `now`. */
  findUserId(token: string, now: Date): Promise<string | undefined>;
  delete(token: string): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  /** Compares in constant time; with no hash it still does the work, so timing does not reveal unknown emails. */
  verify(password: string, hash: string | undefined): Promise<boolean>;
}

/** Unguessable session tokens. */
export interface TokenGenerator {
  next(): string;
}
