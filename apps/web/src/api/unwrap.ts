import { errorMessage } from './errorMessage';

// openapi-fetch resolves a non-2xx with `error` set rather than throwing;
// this throws, so a failed query reaches TanStack's `isError` and retry
// instead of reading as "no data".
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
