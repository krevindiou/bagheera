#!/usr/bin/env node
// Posts an `image-age` commit status on each open Renovate PR that bumps a
// pinned Docker Hub image digest: pending until the digest has sat on its tag
// for MIN_AGE_DAYS, success after. Renovate can't do this itself: it finds no
// release timestamp for a digest bump and holds it forever.
import { pathToFileURL } from 'node:url';

export const MIN_AGE_DAYS = 3;
const DAY_MS = 86_400_000;
const CONTEXT = 'image-age';
const DESCRIPTION_MAX = 140;

// `name:tag@sha256:<hex>`, as written in a Dockerfile FROM or a compose image.
const PINNED_IMAGE = /([a-z0-9][a-z0-9._/-]*):([A-Za-z0-9_][A-Za-z0-9._-]*)@(sha256:[a-f0-9]{64})/g;

export function parsePinnedImages(diff) {
  const found = new Map();
  for (const line of diff.split('\n')) {
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    for (const [, image, tag, digest] of line.matchAll(PINNED_IMAGE)) {
      found.set(`${image}:${tag}@${digest}`, { image, tag, digest });
    }
  }
  return [...found.values()];
}

// [namespace, repository] on Docker Hub, null for any other registry.
export function hubRepository(image) {
  const parts = image.replace(/^(index\.)?docker\.io\//, '').split('/');
  if (parts.length === 1) return ['library', parts[0]];
  if (parts.length === 2 && !/[.:]/.test(parts[0]) && parts[0] !== 'localhost') return parts;
  return null;
}

function formatDuration(ms) {
  const days = Math.floor(ms / DAY_MS);
  return days >= 1 ? `${days}d` : `${Math.floor(ms / 3_600_000)}h`;
}

// `hubTag` is Docker Hub's tag record, or null when the tag doesn't exist.
export function evaluate({ image, tag, digest }, hubTag, now) {
  const ref = `${image}:${tag}`;
  if (!hubTag) return { state: 'error', text: `${ref}: tag not found on Docker Hub` };

  const current = hubTag.digest === digest || hubTag.images?.some((i) => i.digest === digest);
  if (!current) return { state: 'pending', text: `${ref}: tag has moved past this digest` };

  const pushed = Date.parse(hubTag.tag_last_pushed);
  if (Number.isNaN(pushed)) return { state: 'error', text: `${ref}: no push date` };

  const age = now - pushed;
  if (age >= MIN_AGE_DAYS * DAY_MS) {
    return { state: 'success', text: `${ref}: pushed ${formatDuration(age)} ago` };
  }
  const daysLeft = Math.ceil((MIN_AGE_DAYS * DAY_MS - age) / DAY_MS);
  return {
    state: 'pending',
    text: `${ref}: pushed ${formatDuration(age)} ago, ${daysLeft}d left`,
  };
}

const SEVERITY = ['success', 'pending', 'error'];

export function summarize(results) {
  const state = results.reduce(
    (worst, r) => (SEVERITY.indexOf(r.state) > SEVERITY.indexOf(worst) ? r.state : worst),
    'success',
  );
  const sorted = [...results].sort((a, b) => SEVERITY.indexOf(b.state) - SEVERITY.indexOf(a.state));
  const text = sorted.map((r) => r.text).join('; ');
  const description =
    text.length > DESCRIPTION_MAX ? `${text.slice(0, DESCRIPTION_MAX - 1)}…` : text;
  return { state, description };
}

async function fetchHubTag([namespace, repository], tag) {
  const url = `https://hub.docker.com/v2/repositories/${namespace}/${repository}/tags/${encodeURIComponent(tag)}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Docker Hub answered ${res.status} for ${url}`);
  return res.json();
}

async function main() {
  const { GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) {
    throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY are required');
  }

  const github = async (path, { accept = 'application/vnd.github+json', ...init } = {}) => {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${GITHUB_TOKEN}`, accept },
    });
    if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${path}`);
    return res;
  };

  const pulls = await (await github('/pulls?state=open&per_page=100')).json();
  const renovatePulls = pulls.filter(
    (pr) => pr.head.ref.startsWith('renovate/') && pr.head.repo?.full_name === GITHUB_REPOSITORY,
  );

  for (const pr of renovatePulls) {
    const diff = await (
      await github(`/pulls/${pr.number}`, { accept: 'application/vnd.github.diff' })
    ).text();

    const results = [];
    for (const pinned of parsePinnedImages(diff)) {
      const repository = hubRepository(pinned.image);
      if (!repository) continue;
      try {
        results.push(evaluate(pinned, await fetchHubTag(repository, pinned.tag), Date.now()));
      } catch (error) {
        results.push({ state: 'error', text: `${pinned.image}:${pinned.tag}: ${error.message}` });
      }
    }
    if (results.length === 0) continue;

    const { state, description } = summarize(results);
    await github(`/statuses/${pr.head.sha}`, {
      method: 'POST',
      body: JSON.stringify({
        state,
        context: CONTEXT,
        description,
        target_url: `https://github.com/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`,
      }),
    });
    console.log(`#${pr.number} ${state}: ${description}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
