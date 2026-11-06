import 'server-only';
import { type AccountEmailGateway, RESET_PASSWORD_MINUTES, VERIFY_EMAIL_HOURS } from '@nestwise/domain/auth';
import type { EmailGateway } from '@nestwise/domain/reminders';
import { createTranslator } from 'next-intl';
import messages from '../../../messages/en.json';

const t = createTranslator({ locale: 'en', messages, namespace: 'accountEmails' });

/**
 * The verify and reset emails, in the words from messages/en.json, sent through the app's EmailGateway (Gmail SMTP).
 * `origin` is the app's address (APP_URL), so links always point at NestWise itself.
 *
 * It never throws: a failure is logged without the link, and the person can ask again. Outside production with no
 * SMTP settings, the link is written to the server log instead so local work still runs.
 */
export class AccountEmailSender implements AccountEmailGateway {
  constructor(
    private readonly email: EmailGateway,
    private readonly origin: string,
    private readonly production: boolean = process.env.NODE_ENV === 'production',
  ) {}

  async sendVerifyEmail(to: string, token: string, returnTo?: string): Promise<void> {
    const query = new URLSearchParams({ token, ...(returnTo ? { next: returnTo } : {}) });
    const link = `${this.origin}/verify-email/confirm?${query.toString()}`;
    await this.deliver(to, t('verify.subject'), t('verify.body', { link, hours: VERIFY_EMAIL_HOURS }), link);
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const link = `${this.origin}/reset-password?${new URLSearchParams({ token }).toString()}`;
    await this.deliver(to, t('reset.subject'), t('reset.body', { link, minutes: RESET_PASSWORD_MINUTES }), link);
  }

  private async deliver(to: string, subject: string, text: string, link: string): Promise<void> {
    const sent = await this.email.send(to, subject, text).catch((error: unknown) => {
      console.error('Account email failed', error instanceof Error ? error.message : 'unknown error');
      return null;
    });
    if (sent === false && !this.production) console.info(`[dev] Email is not set up. ${subject} for ${to}: ${link}`);
  }
}
