// Every mutating endpoint that can fail validation returns its error body
// as `{ message: string | string[] }` — a single string for one failure, an
// array when class-validator collects more than one for the same field.
// Callers show only the first message; the fallback for no `message` at all
// (a raw 4xx/5xx with no body, or an unexpected shape) is the caller's job,
// via `errorMessage(error) ?? t("...genericError")`.
export function errorMessage(error: unknown): string | undefined {
  if (error && typeof error === "object" && "message" in error) {
    const { message } = error as { message: string | string[] };
    return Array.isArray(message) ? message[0] : message;
  }
  return undefined;
}
