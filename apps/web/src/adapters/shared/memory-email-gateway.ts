import 'server-only';
import type { EmailGateway } from '@nestwise/domain/reminders';

export interface CapturedEmail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

const outbox: CapturedEmail[] = [];

/** Keeps emails in memory instead of sending them: used while tests run, so a test never mails anyone. */
export class MemoryEmailGateway implements EmailGateway {
  async send(to: string, subject: string, text: string): Promise<boolean> {
    outbox.push({ to, subject, text });
    return true;
  }
}

/** The emails "sent" so far in this test process (newest last). */
export const capturedEmails = (): readonly CapturedEmail[] => outbox;

export const clearCapturedEmails = (): void => {
  outbox.length = 0;
};

/** True inside Vitest. */
export const isTestRun = (env: Readonly<Record<string, string | undefined>> = process.env): boolean =>
  env.NODE_ENV === 'test' || env.VITEST === 'true';
