/**
 * Request/response fields pino-http never writes to the logs: credentials
 * (session cookie, authorization) and the CSRF token, which is a live
 * secret for as long as its session cookie is.
 */
export const LOG_REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
];
