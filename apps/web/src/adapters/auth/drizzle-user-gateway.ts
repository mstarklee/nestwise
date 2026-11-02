import 'server-only';
import { type DbOrTx, users } from '@nestwise/db';
import { EmailAlreadyRegisteredError, type User, type UserGateway } from '@nestwise/domain/auth';
import { eq } from 'drizzle-orm';
import { isUniqueViolation } from '../shared/postgres-errors';

type UserRow = typeof users.$inferSelect;

const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  passwordHash: row.passwordHash,
  createdAt: row.createdAt,
});

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

  async save(user: User): Promise<User> {
    try {
      await this.db.insert(users).values(user);
      return user;
    } catch (error) {
      if (isUniqueViolation(error, 'users_email_unique')) {
        throw new EmailAlreadyRegisteredError('An account with this email already exists', { cause: error });
      }
      throw error;
    }
  }
}
