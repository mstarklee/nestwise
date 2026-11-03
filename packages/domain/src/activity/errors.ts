import { DomainError } from '../shared';

export class InvalidActivityQueryError extends DomainError {
  readonly category = 'invalid' as const;
}
