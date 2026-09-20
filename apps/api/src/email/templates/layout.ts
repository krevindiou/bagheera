import type { Locale } from '../../common/locale';
import { safeHtml } from '../../common/escape-html';

/**
 * Shared HTML shell for every outbound email — mirrors the app's
 * "FinTech-Noir" theme (see apps/web/src/styles/theme.css) so transactional
 * mail reads as the same product. Table-based markup + inline styles only:
 * email clients strip <style> blocks, ignore CSS custom properties, and
 * often block remote fonts/images — so every color below is a literal
 * copied from theme.css (no shared import) and the "B" logo mark is drawn
 * with CSS instead of an image. No <link>/<img>/@font-face pointing off-host
 * anywhere in this file — keep it that way.
 */

const COLOR = {
  ink: '#0e0b13',
  panel: '#171220',
  hair: 'rgba(242, 239, 233, 0.1)',
  paper: '#f2efe9',
  paperDim: 'rgba(242, 239, 233, 0.75)',
  paperFaint: 'rgba(242, 239, 233, 0.45)',
  violet: '#7c4fd1',
  violetBright: '#9a72e8',
} as const;

// System font stack (no @font-face) — theme.css uses 'Archivo'/'Space
// Grotesk' via Google Fonts, but those are remote and most mail clients
// strip @font-face anyway, so this falls back to each platform's default
// sans-serif rather than trying to embed/self-host font files in the email.
const FONT = 'Helvetica, Arial, sans-serif';

export interface EmailLayoutOptions {
  locale: Locale;
  /** Hidden preview text shown next to the subject in most inboxes. */
  preheader: string;
  heading: string;
  /** Pre-built HTML — interpolate any non-static value with `safeHtml` before passing it in. */
  bodyHtml: string;
}

export function renderEmailLayout({
  locale,
  preheader,
  heading,
  bodyHtml,
}: EmailLayoutOptions): string {
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>Bagheera</title>
</head>
<body style="margin:0; padding:0; background-color:${COLOR.ink};">
<div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLOR.ink};">
<tr>
<td align="center" style="padding:40px 16px;">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px; max-width:100%; background-color:${COLOR.panel}; border:1px solid ${COLOR.hair}; border-radius:8px;">
<tr>
<td style="padding:32px 36px 0;">
<table role="presentation" cellpadding="0" cellspacing="0">
<tr>
<td style="width:32px; height:32px; border-radius:4px; background-color:${COLOR.violet}; text-align:center; font-family:${FONT}; font-weight:bold; font-size:15px; color:#ffffff; line-height:32px;">B</td>
<td style="padding-left:10px; font-family:${FONT}; font-weight:bold; font-size:17px; color:${COLOR.paper};">Bagheera</td>
</tr>
</table>
<div style="width:32px; height:2px; background-color:${COLOR.violetBright}; margin:24px 0 16px;"></div>
<h1 style="margin:0 0 16px; font-family:${FONT}; font-size:21px; font-weight:700; color:${COLOR.paper};">${heading}</h1>
</td>
</tr>
<tr>
<td style="padding:0 36px 32px; font-family:${FONT}; font-size:15px; line-height:1.6; color:${COLOR.paperDim};">
${bodyHtml}
</td>
</tr>
<tr>
<td style="padding:20px 36px; border-top:1px solid ${COLOR.hair}; font-family:${FONT}; font-size:12px; color:${COLOR.paperFaint};">
Bagheera — personal finance manager
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

/**
 * Bulletproof (table-based) CTA button plus a plain-text copy of the link
 * underneath, for clients that strip button styling or images. `label` and
 * `url` are run through `safeHtml` here, so callers can pass either through
 * unescaped.
 */
export function emailButton(label: string, url: string): string {
  const button = safeHtml`<a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-block; padding:12px 24px; font-family:${FONT}; font-size:14px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:6px;">${label}</a>`;
  const plainLink = safeHtml`<a href="${url}" style="color:${COLOR.violetBright};">${url}</a>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;">
<tr><td style="border-radius:6px; background-color:${COLOR.violet};">${button}</td></tr>
</table>
<p style="margin:0; font-size:13px; color:${COLOR.paperFaint}; word-break:break-all;">Or copy this link: ${plainLink}</p>`;
}
