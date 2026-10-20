# Architecture

Atmosphere keeps the browser experience simple while putting validation and provider-specific authentication behind explicit boundaries.

```mermaid
flowchart LR
  User[Browser user] --> UI[React workspace]
  UI --> Cache[Validated client cache]
  Cache --> Forecast[Open-Meteo forecast]
  Cache --> Air[Open-Meteo air quality]
  UI --> Search[Open-Meteo geocoder]
  UI --> OSM[OpenStreetMap tiles]
  UI --> TileRoute[/api/map-tile]
  TileRoute --> Proxy[Validated tile proxy]
  Proxy --> OWM[OpenWeatherMap raster tiles]
```

## Boundaries

- `src/lib/api/` owns provider requests, schema validation, retries, timeouts, caching, and stale-result behavior.
- `src/components/` renders typed data and exposes loading, stale, missing, and error states instead of making provider assumptions.
- `src/lib/mapLayers.ts` is the browser-safe layer registry. The browser sends an application layer name, not a provider URL or credential.
- `src/server/tileProxy.ts` validates layer names and XYZ coordinates, builds a fixed upstream URL, handles cancellation and timeout, and forwards only safe cache headers.
- `src/server/openWeatherTile.ts` maps application layers to OpenWeatherMap tile names and resolves `OPENWEATHER_API_KEY` at request time.
- `api/map-tile.ts` is the thin Vercel Web Standard Function adapter.

## Reliability model

1. A provider response is validated before it can reach the UI.
2. Retries are bounded and requests have timeouts.
3. Recent valid data can be shown as stale when a refresh fails.
4. Optional map overlays are isolated from point readings and navigation.
5. A failed overlay becomes a visible unavailable state rather than a route-level crash.

## Privacy model

Saved locations, labels, units, theme, reduced-motion preference, and recent searches stay in browser storage. The current-location flow requires an explicit confirmation and performs a one-time coordinate lookup; the app does not continuously watch the device location.

Server-only map credentials are never placed in `VITE_*` variables or returned to the browser. See [`SECURITY.md`](../SECURITY.md) before configuring a provider key.
