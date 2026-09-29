import { errorMessage } from './errorMessage';

// openapi-fetch never throws on a non-2xx response — it resolves with
// `error` set instead. Every `queryFn` used to do `return data ?? <fallback>`,
// which reads a failed request as "no data" (an empty list, a null balance)
// rather than surfacing it, so TanStack Query's `isError`/retry never fire.
// Wrap the raw `{ data, error, response }` result in this so a failure
// throws instead, and callers render an error state off `isError`.
export function unwrap<T>({
  data,
  error,
  response,
}: {
  data?: T;
  error?: unknown;
  response: Response;
}): T {
  if (!response.ok) {
    throw new Error(errorMessage(error) ?? `Request failed with status ${response.status}`);
  }
  return data as T;
}
