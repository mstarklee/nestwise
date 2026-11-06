import { EmailAlreadyRegisteredError, type User, type UserGateway } from '../../src/auth';

export class InMemoryUserGateway implements UserGateway {
  private users = new Map<string, User>();

  async findByEmail(email: string): Promise<User | undefined> {
    return [...this.users.values()].find((u) => u.email === email);
  }

  async findById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async findByGoogleSubject(subject: string): Promise<User | undefined> {
    return [...this.users.values()].find((u) => u.googleSubject === subject);
  }

  async save(user: User): Promise<User> {
    if ([...this.users.values()].some((u) => u.email === user.email && u.id !== user.id)) {
      throw new EmailAlreadyRegisteredError('An account with this email already exists');
    }
    this.users.set(user.id, user);
    return user;
  }

  async update(user: User): Promise<User> {
    if (!this.users.has(user.id)) throw new Error(`No user ${user.id}`);
    this.users.set(user.id, user);
    return user;
  }

  all(): readonly User[] {
    return [...this.users.values()];
  }
}
