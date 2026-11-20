import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  evaluate,
  hubRepository,
  MIN_AGE_DAYS,
  parsePinnedImages,
  summarize,
} from './image-age.mjs';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-20T18:00:00Z');
const OLD = `sha256:${'a'.repeat(64)}`;
const NEW = `sha256:${'b'.repeat(64)}`;
const caddy = { image: 'caddy', tag: '2-alpine', digest: NEW };
const pushedAgo = (ms) => new Date(NOW - ms).toISOString();

describe('parsePinnedImages', () => {
  it('reads only added lines, from FROM, image: and syntax directives', () => {
    const diff = [
      '--- a/docker/Dockerfile.caddy',
      '+++ b/docker/Dockerfile.caddy',
      `-FROM caddy:2-alpine@${OLD}`,
      `+FROM caddy:2-alpine@${NEW}`,
      `+    image: valkey/valkey:9-alpine@${NEW}`,
      `+# syntax=docker/dockerfile:1@${NEW}`,
      `+    image: \${IMAGE_NAMESPACE:?}/bagheera-web:\${TAG:?set TAG}`,
    ].join('\n');

    assert.deepEqual(parsePinnedImages(diff), [
      { image: 'caddy', tag: '2-alpine', digest: NEW },
      { image: 'valkey/valkey', tag: '9-alpine', digest: NEW },
      { image: 'docker/dockerfile', tag: '1', digest: NEW },
    ]);
  });

  it('lists an image once when several files pin the same digest', () => {
    const line = `+    image: postgres:18-alpine@${NEW}`;
    assert.equal(parsePinnedImages(`${line}\n${line}`).length, 1);
  });

  it('finds nothing in a diff that pins no image digest', () => {
    assert.deepEqual(parsePinnedImages('+    "connect-redis": "10.0.0",'), []);
  });
});

describe('hubRepository', () => {
  it('puts official images under library/', () => {
    assert.deepEqual(hubRepository('caddy'), ['library', 'caddy']);
    assert.deepEqual(hubRepository('docker.io/postgres'), ['library', 'postgres']);
  });

  it('keeps a user/repository pair', () => {
    assert.deepEqual(hubRepository('valkey/valkey'), ['valkey', 'valkey']);
  });

  it('rejects other registries', () => {
    assert.equal(hubRepository('ghcr.io/owner/image'), null);
    assert.equal(hubRepository('mcr.microsoft.com/playwright'), null);
    assert.equal(hubRepository('localhost/image'), null);
  });
});

describe('evaluate', () => {
  it('passes a digest that has sat on its tag long enough', () => {
    const hubTag = { digest: NEW, tag_last_pushed: pushedAgo(MIN_AGE_DAYS * DAY + 1) };
    assert.deepEqual(evaluate(caddy, hubTag, NOW), {
      state: 'success',
      text: 'caddy:2-alpine: pushed 3d ago',
    });
  });

  it('holds a digest pushed too recently and says how long is left', () => {
    const hubTag = { digest: NEW, tag_last_pushed: pushedAgo(DAY + 3_600_000) };
    assert.deepEqual(evaluate(caddy, hubTag, NOW), {
      state: 'pending',
      text: 'caddy:2-alpine: pushed 1d ago, 2d left',
    });
  });

  it('counts hours for a digest pushed less than a day ago', () => {
    const hubTag = { digest: NEW, tag_last_pushed: pushedAgo(5 * 3_600_000) };
    assert.equal(evaluate(caddy, hubTag, NOW).text, 'caddy:2-alpine: pushed 5h ago, 3d left');
  });

  it("matches a single-arch tag through its image's digest", () => {
    const hubTag = {
      digest: OLD,
      images: [{ digest: NEW }],
      tag_last_pushed: pushedAgo(10 * DAY),
    };
    assert.equal(evaluate(caddy, hubTag, NOW).state, 'success');
  });

  it('holds a digest the tag has moved past, whatever its date', () => {
    const hubTag = { digest: OLD, tag_last_pushed: pushedAgo(30 * DAY) };
    assert.equal(evaluate(caddy, hubTag, NOW).state, 'pending');
  });

  it('errors on a missing tag or push date', () => {
    assert.equal(evaluate(caddy, null, NOW).state, 'error');
    assert.equal(evaluate(caddy, { digest: NEW, tag_last_pushed: null }, NOW).state, 'error');
  });
});

describe('summarize', () => {
  it('reports the worst state, listing the worst images first', () => {
    const { state, description } = summarize([
      { state: 'success', text: 'a: pushed 9d ago' },
      { state: 'pending', text: 'b: pushed 1d ago, 2d left' },
    ]);
    assert.equal(state, 'pending');
    assert.equal(description, 'b: pushed 1d ago, 2d left; a: pushed 9d ago');
  });

  it('ranks error above pending', () => {
    const results = [
      { state: 'pending', text: 'a' },
      { state: 'error', text: 'b' },
    ];
    assert.equal(summarize(results).state, 'error');
  });

  it("truncates to GitHub's 140-character status limit", () => {
    const { description } = summarize([{ state: 'success', text: 'x'.repeat(200) }]);
    assert.equal(description.length, 140);
    assert.ok(description.endsWith('…'));
  });
});
