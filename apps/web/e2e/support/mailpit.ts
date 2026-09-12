// Thin wrapper over Mailpit's HTTP API (see docker/compose.yml's `mailpit`
// service and the `playwright` service's `E2E_MAILPIT_HTTP_URL`). Every
// email this app sends carries at most one actionable link, built server
// -side as a plain `<a href="...">...</a>` — see
// apps/api/src/email/i18n/en.ts — so "the link in the email" is
// unambiguous.
//
// Deliberately not a fixture: it's used both from spec files (clicking a
// real link is part of what's under test) and from fixtures.ts's fast-path
// setup helpers, so a plain importable function is the simpler shape.

const MAILPIT_URL = process.env.E2E_MAILPIT_HTTP_URL ?? 'http://localhost:8025';

interface MailpitMessageSummary {
  ID: string;
  Created: string;
  To: { Address: string }[];
}

interface MailpitMessagesResponse {
  messages: MailpitMessageSummary[];
}

interface MailpitMessageDetail {
  HTML: string;
}

async function messagesTo(toAddress: string): Promise<MailpitMessageSummary[]> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=200`);
  if (!res.ok) {
    throw new Error(`Mailpit list request failed: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as MailpitMessagesResponse;
  return body.messages.filter((message) =>
    message.To.some((to) => to.Address.toLowerCase() === toAddress.toLowerCase()),
  );
}

/**
 * Snapshots the message ids already sitting in `toAddress`'s inbox. Pass
 * the result as `waitForEmailLink`'s `excludeIds` when a test sends a
 * *second* email to an address that's already received one (e.g.
 * password-reset.spec.ts's forgot-password request, sent after
 * registerAndActivate's own activation email, or a resent activation email)
 * — without it, that earlier, already-read email is a false-positive match,
 * returned before the real (asynchronously-queued, BullMQ) one has even
 * arrived. Call this *before* triggering whatever action queues the new
 * email. Unnecessary (but harmless) for a fresh, never-before-emailed
 * address, since there's nothing yet to exclude.
 */
export async function existingMessageIds(toAddress: string): Promise<Set<string>> {
  return new Set((await messagesTo(toAddress)).map((message) => message.ID));
}

async function findMessageId(toAddress: string, excludeIds: Set<string>): Promise<string | null> {
  const matches = (await messagesTo(toAddress)).filter((message) => !excludeIds.has(message.ID));
  // Newest first, in case more than one new match ever exists at once.
  matches.sort((a, b) => Date.parse(b.Created) - Date.parse(a.Created));
  return matches[0]?.ID ?? null;
}

/**
 * Polls Mailpit until an email has arrived for `toAddress`, then returns the
 * single link found in its HTML body. Pass `excludeIds` (from
 * `existingMessageIds`, captured before the triggering action) whenever
 * this isn't the first email ever sent to `toAddress` — see its doc comment
 * for why.
 */
export async function waitForEmailLink(
  toAddress: string,
  {
    excludeIds = new Set(),
    timeoutMs = 15_000,
  }: { excludeIds?: Set<string>; timeoutMs?: number } = {},
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let id: string | null = null;
  while (Date.now() < deadline) {
    id = await findMessageId(toAddress, excludeIds);
    if (id) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (!id) {
    throw new Error(`No new email arrived for ${toAddress} within ${timeoutMs}ms`);
  }

  const res = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
  if (!res.ok) {
    throw new Error(`Mailpit message fetch failed: ${res.status} ${res.statusText}`);
  }
  const detail = (await res.json()) as MailpitMessageDetail;
  const match = /href="([^"]+)"/.exec(detail.HTML);
  if (!match) {
    throw new Error(`No link found in the email sent to ${toAddress}`);
  }
  return match[1].replace(/&amp;/g, '&');
}

/** Every emailed link here (activate / password-recovery/reset /
 * confirm-email-change) is a single-use `?key=` token — see the matching
 * onMounted() in each page under apps/web/src/pages/auth/. */
export function keyFromLink(link: string): string {
  const key = new URL(link).searchParams.get('key');
  if (!key) {
    throw new Error(`Link has no ?key= param: ${link}`);
  }
  return key;
}
