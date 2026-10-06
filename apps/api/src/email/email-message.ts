import type { Locale } from '../common/locale';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

/** A registration, queued for the worker to turn into one email — see SignupRequestService. */
export interface SignupRequest {
  email: string;
  country: string;
  locale: Locale;
  /** The browser's IANA time zone, when it sent one. */
  timeZone?: string;
  /** For the audit row, recorded once the worker knows what it sent. */
  sourceAddress: string;
}

/** Provider abstraction: swap the concrete transport without touching call sites or tests. */
export interface EmailProvider {
  /** `jobId` identifies the queue job in logs — never log the recipient instead. */
  send(message: EmailMessage, jobId?: string): Promise<void>;
}
