import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailMessage, EmailProvider } from './email-message';

/**
 * Mail carries sign-up and email-change links, so production never sends in
 * clear. On `smtp://`, nodemailer only upgrades via STARTTLS if offered,
 * which an attacker can strip; `requireTLS` makes that a send failure.
 * `smtps://` is TLS already, and dev's Mailpit speaks no TLS.
 */
export function smtpTransportOptions(
  smtpUrl: string,
  isProduction: boolean,
): { url: string; requireTLS?: boolean } {
  return isProduction && /^smtp:/i.test(smtpUrl)
    ? { url: smtpUrl, requireTLS: true }
    : { url: smtpUrl };
}

/**
 * SMTP provider (`EMAIL_SMTP_URL`, `EMAIL_FROM`). A failed send rejects, so
 * the email queue retries it and alerts on the last attempt.
 */
@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private readonly transport: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const smtpUrl = this.config.getOrThrow<string>('EMAIL_SMTP_URL');
    this.transport = nodemailer.createTransport(
      smtpTransportOptions(smtpUrl, process.env.NODE_ENV === 'production'),
    );
    this.from = this.config.getOrThrow<string>('EMAIL_FROM');
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.transport.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
      });
    } catch (err) {
      // Only the code, not the original error: SMTP servers echo the
      // recipient in their messages, and this one reaches logs, Sentry and
      // the failed job kept in Valkey.
      const { code } = err as { code?: unknown };
      // eslint-disable-next-line preserve-caught-error -- a `cause` would carry the recipient into Sentry
      throw new Error(`SMTP send failed: ${typeof code === 'string' ? code : 'unknown'}`);
    }
  }
}
