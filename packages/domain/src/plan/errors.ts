import { DomainError } from '../shared';

export abstract class PlanError extends DomainError {}

export class InvalidPlanCommandError extends PlanError {
  readonly category = 'invalid' as const;
}

export class ItemNotFoundError extends PlanError {
  readonly category = 'not_found' as const;
}

export class GroupNotFoundError extends PlanError {
  readonly category = 'not_found' as const;
}

export class ItemArchivedError extends PlanError {
  readonly category = 'conflict' as const;
}

export class PlanAlreadyImportedError extends PlanError {
  readonly category = 'conflict' as const;
}
