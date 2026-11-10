export class SessionSummaryDto {
  /** Opaque handle: never the session id itself, which is the cookie's secret. */
  id!: string;
  /** The session making this request. */
  current!: boolean;
  browser!: string | null;
  os!: string | null;
  /** Source address at sign-in; null for a session signed in before it was recorded. */
  ipAddress!: string | null;
  signedInAt!: Date;
  lastActiveAt!: Date;
}
