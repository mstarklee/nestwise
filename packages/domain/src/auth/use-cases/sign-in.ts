import type { Clock } from '../../shared';
import { InvalidCredentialsError } from '../errors';
import { normaliseEmail, type SignedIn, type SignInCommand } from '../models';
import type { PasswordHasher, SessionGateway, TokenGenerator, UserGateway } from '../ports';
import { SessionStarter } from './session-starter';

export class SignInUseCase {
  private readonly starter: SessionStarter;

  constructor(
    private readonly users: UserGateway,
    sessions: SessionGateway,
    private readonly hasher: PasswordHasher,
    tokens: TokenGenerator,
    clock: Clock,
  ) {
    this.starter = new SessionStarter(sessions, tokens, clock);
  }

  async execute(command: SignInCommand): Promise<SignedIn> {
    const email = normaliseEmail(command.email);
    const user = await this.users.findByEmail(email);
    // A Google-only account has no password hash; verify still does the work, so the answer takes the same time.
    const matches = await this.hasher.verify(command.password, user?.passwordHash ?? undefined);
    if (!user || !matches) throw new InvalidCredentialsError('Wrong email or password');
    return this.starter.start(user);
  }
}
