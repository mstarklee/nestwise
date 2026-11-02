import type { NewSession, SessionGateway } from '../../src/auth';

export class InMemorySessionGateway implements SessionGateway {
  private sessions = new Map<string, NewSession>();

  async create(session: NewSession): Promise<void> {
    this.sessions.set(session.token, session);
  }

  async findUserId(token: string, now: Date): Promise<string | undefined> {
    const session = this.sessions.get(token);
    return session && session.expiresAt > now ? session.userId : undefined;
  }

  async delete(token: string): Promise<void> {
    this.sessions.delete(token);
  }

  all(): readonly NewSession[] {
    return [...this.sessions.values()];
  }
}
