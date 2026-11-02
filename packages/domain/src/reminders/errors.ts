import { DomainError } from '../shared';

export abstract class RemindersError extends DomainError {}

export class InvalidPushSubscriptionError extends RemindersError {
  readonly category = 'invalid' as const;
}
