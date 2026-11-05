import { DomainError } from '../shared';

export abstract class CaptureError extends DomainError {}

/**
 * Nothing usable came back: the speech service failed, the parse failed, or the recording held no expenses. The
 * message never carries the audio or the transcript (design §9).
 */
export class CaptureNotUnderstoodError extends CaptureError {
  readonly category = 'invalid' as const;
}

/** The family has used its monthly voice allowance. Typing still works (design §9). */
export class CaptureCapReachedError extends CaptureError {
  readonly category = 'conflict' as const;
}

/** Only the person who spoke a batch may confirm it — there is no admin override (design §8). */
export class NotYourBatchError extends CaptureError {
  readonly category = 'not_allowed' as const;
}

export class CaptureBatchNotFoundError extends CaptureError {
  readonly category = 'not_found' as const;
}

/** Everything owed on the bill has already been paid; paying again would count it twice (design §6). */
export class BillAlreadyPaidError extends CaptureError {
  readonly category = 'conflict' as const;
}

/** The bill is closed, cancelled, from another year's plan, or was not named at all. */
export class BillNotPayableError extends CaptureError {
  readonly category = 'invalid' as const;
}

/** The review screen sent a row that was not part of the note it is confirming. */
export class UnknownCaptureEntryError extends CaptureError {
  readonly category = 'invalid' as const;
}
