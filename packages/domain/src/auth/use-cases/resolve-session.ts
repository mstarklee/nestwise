import type { Clock } from '../../shared';
import { NotSignedInError } from '../errors';
import type { ResolveSessionCommand, SessionUser } from '../models';
import type { SessionGateway, UserGateway } from '../ports';

export class ResolveSessionUseCase {
  constructor(
    private readonly users: UserGateway,
    private readonly sessions: SessionGateway,
    private readonly clock: Clock,
  ) {}

  async execute(command: ResolveSessionCommand): Promise<SessionUser> {
    if (!command.token) throw new NotSignedInError('Not signed in');
    const userId = await this.sessions.findUserId(command.token, this.clock.now());
    const user = userId ? await this.users.findById(userId) : undefined;
    if (!user) throw new NotSignedInError('Not signed in');
    return { userId: user.id, email: user.email };
  }
}
