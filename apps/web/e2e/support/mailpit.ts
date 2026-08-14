interface MailpitSummary {
  messages: { ID: string; To: { Address: string }[] }[];
}

interface MailpitMessage {
  HTML: string;
  Text: string;
}

function mailpitUrl(): string {
  const base = process.env.E2E_MAILPIT_HTTP_URL;
  if (!base)
    throw new Error("E2E_MAILPIT_HTTP_URL is not set — run via the e2e Playwright config.");
  return base;
}

/** Polls mailpit for the latest message sent to `to`, up to `timeoutMs`. */
async function latestMessageTo(to: string, timeoutMs = 10_000): Promise<MailpitMessage> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await fetch(
      `${mailpitUrl()}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
    );
    const summary = (await res.json()) as MailpitSummary;
    if (summary.messages.length > 0) {
      const [latest] = summary.messages;
      const messageRes = await fetch(`${mailpitUrl()}/api/v1/message/${latest.ID}`);
      return (await messageRes.json()) as MailpitMessage;
    }
    if (Date.now() > deadline) {
      throw new Error(`No email received for ${to} within ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

/** Extracts the first http(s) link from an email body sent to `to`. */
export async function latestEmailLink(to: string): Promise<string> {
  const message = await latestMessageTo(to);
  const match = message.HTML.match(/href="([^"]+)"/) ?? message.Text.match(/(https?:\/\/\S+)/);
  if (!match) throw new Error(`No link found in the email sent to ${to}`);
  return match[1];
}
