import { DomainError } from '../shared';

export abstract class FamilyError extends DomainError {}

export class InvalidFamilyCommandError extends FamilyError {
  readonly category = 'invalid' as const;
}

export class SignupClosedError extends FamilyError {
  readonly category = 'not_allowed' as const;
}

export class NotAMemberError extends FamilyError {
  readonly category = 'not_allowed' as const;
}

export class AlreadyInFamilyError extends FamilyError {
  readonly category = 'conflict' as const;
}

export class InviteNotFoundError extends FamilyError {
  readonly category = 'not_found' as const;
}

export class InviteNotUsableError extends FamilyError {
  readonly category = 'conflict' as const;
}
