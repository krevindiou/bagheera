export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

/** Provider abstraction: swap the concrete transport without touching call sites or tests. */
export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}
