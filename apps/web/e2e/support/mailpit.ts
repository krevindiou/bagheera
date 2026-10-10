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

async function newestMessageId(toAddress: string): Promise<string | null> {
  const matches = await messagesTo(toAddress);
  matches.sort((a, b) => Date.parse(b.Created) - Date.parse(a.Created));
  return matches[0]?.ID ?? null;
}

/** Polls until an email reaches `toAddress` and returns its link. */
export async function waitForEmailLink(
  toAddress: string,
  { timeoutMs = 15_000 }: { timeoutMs?: number } = {},
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let id: string | null = null;
  while (Date.now() < deadline) {
    id = await newestMessageId(toAddress);
    if (id) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (!id) {
    throw new Error(`No email arrived for ${toAddress} within ${timeoutMs}ms`);
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
