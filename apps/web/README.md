# web

Bagheera front end: Vue 3 + TypeScript, built with Vite.

Everything runs in Docker — see the repo root `CLAUDE.md` ("Docker only —
no local runtime"). Don't run these `package.json` scripts directly from
the host; run them inside the `web` container instead, e.g.:

```bash
make shell-web                     # or, from the repo root:
make exec-web CMD="pnpm <script>"
```

## Scripts

- `pnpm dev` — start the dev server (`make up` already runs this, hot-reloading).
- `pnpm build` — type-check and build for production.
- `pnpm preview` — preview the production build locally.
- `pnpm test` — run the Vitest suite (or `make test-unit` from the repo root).
