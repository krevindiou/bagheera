import { errorMessage } from '../common/error-message';

/**
 * Why simplewebauthn rejected a response, safe to log: its challenge
 * mismatch errors quote both challenges, so those values are masked.
 */
export function verificationFailureReason(err: unknown): string {
  const message = errorMessage(err);
  return /challenge/i.test(message) ? message.replace(/"[^"]*"/g, '"[redacted]"') : message;
}
