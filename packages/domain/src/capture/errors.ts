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
