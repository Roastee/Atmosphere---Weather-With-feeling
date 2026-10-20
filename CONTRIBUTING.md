# Contributing to Atmosphere

Thanks for helping improve Atmosphere. Contributions should make the weather workspace more useful, understandable, accessible, and resilient.

## Before you start

- Check existing issues and pull requests before opening a new one.
- For a security concern, follow [`SECURITY.md`](SECURITY.md) instead of posting sensitive details publicly.
- Review [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) before participating.

## Development setup

The project requires Node.js `>=20.19.0` and npm `>=10.0.0`.

1. Create a branch for your change.
2. Install the locked dependencies:

   ```bash
   npm ci
   ```

3. Start the development server when you need an interactive browser session:

   ```bash
   npm run dev
   ```

The default application paths use public Open-Meteo endpoints and do not require an API key. Weather map overlays may require a server-only provider secret in a deployment environment; never put that secret in browser code, a `VITE_*` variable, an issue, or a pull request.

## Checks

Run the checks relevant to your change before opening a pull request:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

The Playwright suite uses deterministic provider and tile fixtures. If the Playwright browser is not installed locally, install Chromium with:

```bash
npx playwright install chromium
```

The end-to-end command uses a production build and Vite preview by default. See [`e2e/README.md`](e2e/README.md) for development-server mode and port overrides.

## Making changes

- Keep pull requests focused on one problem or outcome.
- Prefer the existing TypeScript, React, Vite, Vitest, Testing Library, and Playwright patterns.
- Add or update meaningful tests for changed behavior, especially provider failures, persistence, accessibility, and responsive interactions.
- Preserve accessible names, keyboard operation, status announcements, and reduced-motion behavior when changing the UI.
- Keep provider boundaries validated and avoid coupling components directly to network responses.
- Do not commit `.env` files, API keys, tokens, local build output, or personal data.

## Pull requests

Use the pull request template and include:

- the user problem and the scope of the change;
- relevant issue or discussion links;
- the checks you ran and any checks you could not run;
- screenshots or recordings for meaningful visual changes; and
- compatibility, migration, or rollout notes when applicable.

Use a short, imperative commit subject when practical, such as `Improve forecast error guidance`. Maintainers may ask for a branch to be rebased or for checks to be rerun before merging.

## Reporting issues

Use the bug and feature issue forms so reports include enough context to be actionable. Please redact credentials, tokens, personal data, and private provider responses from all public discussions.
