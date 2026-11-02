import 'server-only';
import type { EmailGateway } from '@nestwise/domain/reminders';
import nodemailer, { type Transporter } from 'nodemailer';

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Email through Gmail SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM). Port 465 uses TLS from the
 * start. Without those settings email is simply off: send() returns false and nothing goes out.
 */
export class SmtpEmailGateway implements EmailGateway {
  private readonly transport: Transporter | null;
  private readonly from: string;

  constructor(env: Env = process.env) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM } = env;
    const port = Number(SMTP_PORT ?? 465);
    this.from = EMAIL_FROM || SMTP_USER || '';
    this.transport =
      SMTP_HOST && SMTP_USER && SMTP_PASSWORD
        ? nodemailer.createTransport({
            host: SMTP_HOST,
            port,
            secure: port === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
            connectionTimeout: 10_000,
            socketTimeout: 10_000,
          })
        : null;
  }

  async send(to: string, subject: string, text: string): Promise<boolean> {
    if (!this.transport) return false;
    await this.transport.sendMail({ from: this.from, to, subject, text });
    return true;
  }
}
