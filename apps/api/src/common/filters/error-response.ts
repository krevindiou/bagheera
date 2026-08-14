export type ErrorCategory =
  'validation_error' | 'access_denied' | 'not_found' | 'error';

export interface ErrorResponseBody {
  statusCode: number;
  category: ErrorCategory;
  message: string | string[];
  path: string;
  timestamp: string;
}

/**
 * Maps an HTTP status code to the error category the frontend/clients
 * branch on. 400 is "validation", 403 and 422 are both surfaced as
 * "access denied" (this app uses 422 for business-rule/ownership denials
 * that aren't plain validation), 404 is "not found", everything else is a
 * generic error.
 */
export function categorize(statusCode: number): ErrorCategory {
  switch (statusCode) {
    case 400:
      return 'validation_error';
    case 403:
    case 422:
      return 'access_denied';
    case 404:
      return 'not_found';
    default:
      return 'error';
  }
}
