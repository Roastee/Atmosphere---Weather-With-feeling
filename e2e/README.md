# Browser test notes

The Playwright suite checks the user-visible workspace rather than implementation details. It covers:

- dashboard loading, city search, units, theme, reduced motion, and forecast navigation;
- daily forecast expansion and the extended-horizon reveal;
- air-quality provenance and informational guidance;
- saved locations, local labels, recent-search persistence, and refresh feedback;
- forecast-provider failure and retry guidance;
- current-location confirmation with a deterministic browser geolocation grant;
- loaded-data retention and offline-mode messaging;
- map-layer selection, mocked weather tiles, and graceful overlay failure;
- keyboard and mobile navigation; and
- the security headers served by the configured local server.

## Deterministic provider boundary

Tests intercept the Open-Meteo geocoding, forecast, and air-quality endpoints with fixtures. The fixture contains stable-shaped current, hourly, daily, and pollutant data and can return a forecast HTTP error. Assertions use accessible roles, visible status copy, and user outcomes instead of live temperatures or timing-sensitive network events.

The Maps screen is covered with deterministic image routes: OpenStreetMap base tiles and the same-origin `/api/map-tile` overlay route are fulfilled with a tiny PNG. The suite verifies that no overlay is requested until a user selects one, layer changes replace the active overlay, disabled layers remain disabled, and a failed overlay leaves the map and selected-point readings usable. Live provider tiles still require a manual smoke test after the deployment adapter and provider secret are configured.

## Running the suite

`npm run test:e2e` runs Vite's production bundler and starts the resulting bundle with Vite preview on `http://127.0.0.1:4173`:

```bash
npm run test:e2e
```

The preview server is deliberately not reused, so a test run cannot accidentally attach to an old development process. To use the Vite development server during iterative work:

```bash
E2E_SERVER=dev npm run test:e2e
```

On PowerShell:

```powershell
$env:E2E_SERVER = 'dev'; npm run test:e2e
```

If port `4173` is already in use, set `E2E_PORT` to a free local port; the Playwright base URL and Vite server use the same value:

```bash
E2E_PORT=4180 npm run test:e2e
```

For focused debugging, Playwright's normal filters remain available, for example `npx playwright test e2e/app.spec.ts --grep "air-quality"` or `npx playwright test --headed`.
