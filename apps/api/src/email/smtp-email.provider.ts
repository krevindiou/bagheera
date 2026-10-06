import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailMessage, EmailProvider } from './email-message';

/**
 * Mail carries sign-up and email-change links, so in production it must never
 * travel in clear. `smtps://` is TLS from the first byte; on `smtp://`
 * nodemailer only upgrades via STARTTLS *if the server offers it*, which a
 * network attacker can prevent by stripping the offer — `requireTLS` turns
 * that silent downgrade into a send failure. Outside production the
 * catch-all dev SMTP server (Mailpit) speaks no TLS at all.
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
 * SMTP-backed provider. Configured via `EMAIL_SMTP_URL` and
 * `EMAIL_FROM`; failures are logged and swallowed so a mail-server hiccup
 * never surfaces to the caller — email sending failures are logged
 * internally without changing the visible response.
 */
@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private readonly logger = new Logger('SmtpEmailProvider');
  private readonly transport: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const smtpUrl = this.config.getOrThrow<string>('EMAIL_SMTP_URL');
    this.transport = nodemailer.createTransport(
      smtpTransportOptions(smtpUrl, process.env.NODE_ENV === 'production'),
    );
    this.from = this.config.getOrThrow<string>('EMAIL_FROM');
  }

  async send(message: EmailMessage, jobId?: string): Promise<void> {
    try {
      await this.transport.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
      });
    } catch (err) {
      // Neither the recipient nor the error message: SMTP servers echo the
      // rejected address back in theirs. The job id leads to the queue entry.
      const { code } = err as { code?: unknown };
      const reason = typeof code === 'string' ? code : 'unknown';
      this.logger.error(`Failed to send email job ${jobId ?? 'unknown'}: ${reason}`);
    }
  }
}
