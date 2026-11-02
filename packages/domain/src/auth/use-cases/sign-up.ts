import type { Clock, IdGenerator } from '../../shared';
import { EmailAlreadyRegisteredError } from '../errors';
import { assertPasswordAcceptable, normaliseEmail, type SignedIn, type SignUpCommand } from '../models';
import type { PasswordHasher, SessionGateway, TokenGenerator, UserGateway } from '../ports';
import { SessionStarter } from './session-starter';

export class SignUpUseCase {
  private readonly starter: SessionStarter;

  constructor(
    private readonly users: UserGateway,
    sessions: SessionGateway,
    private readonly hasher: PasswordHasher,
    private readonly ids: IdGenerator,
    tokens: TokenGenerator,
    private readonly clock: Clock,
  ) {
    this.starter = new SessionStarter(sessions, tokens, clock);
  }

  async execute(command: SignUpCommand): Promise<SignedIn> {
    const email = normaliseEmail(command.email);
    assertPasswordAcceptable(command.password);
    if (await this.users.findByEmail(email)) {
      throw new EmailAlreadyRegisteredError('An account with this email already exists');
    }
    const user = await this.users.save({
      id: this.ids.next(),
      email,
      passwordHash: await this.hasher.hash(command.password),
      createdAt: this.clock.now(),
    });
    return this.starter.start(user);
  }
}
