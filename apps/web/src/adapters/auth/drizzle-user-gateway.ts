import 'server-only';
import { type DbOrTx, users } from '@nestwise/db';
import { EmailAlreadyRegisteredError, GoogleAccountConflictError, type User, type UserGateway } from '@nestwise/domain/auth';
import { eq } from 'drizzle-orm';
import { isUniqueViolation } from '../shared/postgres-errors';

type UserRow = typeof users.$inferSelect;

const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  passwordHash: row.passwordHash,
  emailVerifiedAt: row.emailVerifiedAt,
  googleSubject: row.googleSubject,
  createdAt: row.createdAt,
});

/** The database's unique indexes are the real guards; their answers become the domain's conflict errors. */
function translate(error: unknown): never {
  if (isUniqueViolation(error, 'users_email_unique')) {
    throw new EmailAlreadyRegisteredError('An account with this email already exists', { cause: error });
  }
  if (isUniqueViolation(error, 'users_googleSubject_unique')) {
    throw new GoogleAccountConflictError('This Google account is already joined to another account', { cause: error });
  }
  throw error;
}

export class DrizzleUserGateway implements UserGateway {
  constructor(private readonly db: DbOrTx) {}

  async findByEmail(email: string): Promise<User | undefined> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return row ? toUser(row) : undefined;
  }

  async findById(id: string): Promise<User | undefined> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ? toUser(row) : undefined;
  }

  async findByGoogleSubject(subject: string): Promise<User | undefined> {
    const [row] = await this.db.select().from(users).where(eq(users.googleSubject, subject)).limit(1);
    return row ? toUser(row) : undefined;
  }

  async save(user: User): Promise<User> {
    try {
      await this.db.insert(users).values(user);
      return user;
    } catch (error) {
      translate(error);
    }
  }

  async update(user: User): Promise<User> {
    try {
      await this.db
        .update(users)
        .set({ passwordHash: user.passwordHash, emailVerifiedAt: user.emailVerifiedAt, googleSubject: user.googleSubject })
        .where(eq(users.id, user.id));
      return user;
    } catch (error) {
      translate(error);
    }
  }
}
