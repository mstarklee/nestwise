import { DomainError } from '../shared';

export abstract class DuplicatesError extends DomainError {}

export class DuplicateMatchNotFoundError extends DuplicatesError {
  readonly category = 'not_found' as const;
}

/** The question was already answered (perhaps by the other person). */
export class DuplicateAlreadyResolvedError extends DuplicatesError {
  readonly category = 'conflict' as const;
}

export class InvalidDuplicateAnswerError extends DuplicatesError {
  readonly category = 'invalid' as const;
}
