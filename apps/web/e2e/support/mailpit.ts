// Mailpit's HTTP API (docker/compose.yml). Every email carries at most one
// distinct link, so "the link in the email" is unambiguous. Plain functions,
// not fixtures: specs and fixtures.ts both use them.

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
 * The ids already in `toAddress`'s inbox, as `waitForEmailLink`'s
 * `excludeIds`: take it before triggering a second email to an address, or
 * the earlier one matches before the queued one arrives.
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
 * Polls until a new email reaches `toAddress` and returns its link (see
 * `existingMessageIds` for `excludeIds`).
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

/** The `?key=` token of an activate / confirm-email-change link. */
export function keyFromLink(link: string): string {
  const key = new URL(link).searchParams.get('key');
  if (!key) {
    throw new Error(`Link has no ?key= param: ${link}`);
  }
  return key;
}
