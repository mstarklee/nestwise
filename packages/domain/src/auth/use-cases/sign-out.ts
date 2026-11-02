import type { SignOutCommand } from '../models';
import type { SessionGateway } from '../ports';

export class SignOutUseCase {
  constructor(private readonly sessions: SessionGateway) {}

  async execute(command: SignOutCommand): Promise<void> {
    await this.sessions.delete(command.token);
  }
}
