import type { Locale } from '../../common/locale';
import { safeHtml } from '../../common/escape-html';

/**
 * HTML shell for every outbound email, mirroring the web theme
 * (apps/web/src/styles/theme.css). Tables and inline styles only: mail
 * clients strip <style>, ignore CSS variables and block remote assets, so
 * colors are literals copied from theme.css and the logo is drawn in CSS.
 * Keep off-host <link>/<img>/@font-face out of this file.
 */

const COLOR = {
  bg: '#f8f7f5',
  surface: '#ffffff',
  border: '#e9e6e1',
  text: '#1c1917',
  textMuted: '#57534e',
  textFaint: '#6f6862',
  accent: '#c2410c',
} as const;

// The web fonts are remote, and most mail clients strip @font-face anyway.
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
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>Bagheera</title>
</head>
<body style="margin:0; padding:0; background-color:${COLOR.bg};">
<div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLOR.bg};">
<tr>
<td align="center" style="padding:40px 16px;">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px; max-width:100%; background-color:${COLOR.surface}; border:1px solid ${COLOR.border}; border-radius:8px;">
<tr>
<td style="padding:32px 36px 0;">
<table role="presentation" cellpadding="0" cellspacing="0">
<tr>
<td style="width:30px; height:30px; border-radius:7px; background-color:${COLOR.accent}; text-align:center; font-family:${FONT}; font-weight:600; font-size:14px; color:#ffffff; line-height:30px;">B</td>
<td style="padding-left:10px; font-family:${FONT}; font-weight:600; font-size:16px; color:${COLOR.text};">Bagheera</td>
</tr>
</table>
<h1 style="margin:28px 0 16px; font-family:${FONT}; font-size:21px; font-weight:600; color:${COLOR.text};">${heading}</h1>
</td>
</tr>
<tr>
<td style="padding:0 36px 32px; font-family:${FONT}; font-size:15px; line-height:1.6; color:${COLOR.textMuted};">
${bodyHtml}
</td>
</tr>
<tr>
<td style="padding:20px 36px; border-top:1px solid ${COLOR.border}; font-family:${FONT}; font-size:12px; color:${COLOR.textFaint};">
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
 * Table-based CTA button plus the link spelled out after `copyLinkText`, for
 * clients that strip button styling. Escapes every argument itself.
 */
export function emailButton(label: string, url: string, copyLinkText: string): string {
  const button = safeHtml`<a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-block; padding:12px 24px; font-family:${FONT}; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">${label}</a>`;
  const copyLink = safeHtml`${copyLinkText} <a href="${url}" style="color:${COLOR.accent};">${url}</a>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;">
<tr><td style="border-radius:8px; background-color:${COLOR.accent};">${button}</td></tr>
</table>
<p style="margin:0; font-size:13px; color:${COLOR.textFaint}; word-break:break-all;">${copyLink}</p>`;
}
