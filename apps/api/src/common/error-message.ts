/** A thrown value's message, for logs: `throw` accepts non-Errors too. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
