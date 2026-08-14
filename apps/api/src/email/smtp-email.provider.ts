import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailMessage, EmailProvider } from './email-message';

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
    this.transport = nodemailer.createTransport(
      this.config.getOrThrow<string>('EMAIL_SMTP_URL'),
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
      this.logger.error(
        `Failed to send email to ${message.to}: ${(err as Error).message}`,
      );
    }
  }
}
