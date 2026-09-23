export const EMAIL_QUEUE_NAME = 'email';
export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
export const EMAIL_QUEUE = Symbol('EMAIL_QUEUE');
export const BULLMQ_CONNECTION = Symbol('BULLMQ_CONNECTION');
export const WORKER_BULLMQ_CONNECTION = Symbol('WORKER_BULLMQ_CONNECTION');

// Job names on the email queue: `send` carries a ready EmailMessage;
// `signup-request` carries a SignupRequest the worker still has to resolve
// into one (see SignupRequestService).
export const SEND_EMAIL_JOB = 'send';
export const SIGNUP_REQUEST_JOB = 'signup-request';
