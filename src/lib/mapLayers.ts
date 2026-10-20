import type { MapTileCoordinates, WeatherLayerConfig, WeatherLayerId } from '../types/map'

/**
 * The provider layer is an opaque route key. The browser never needs to know
 * which weather provider serves it; the same-origin tile route owns that
 * mapping on the other side of the request.
 */
export const WEATHER_LAYER_CONFIG = [
  { id: 'temperature', label: 'Temperature', enabled: true, providerLayer: 'temperature', unavailableReason: undefined },
  { id: 'precipitation', label: 'Precipitation', enabled: true, providerLayer: 'precipitation', unavailableReason: undefined },
  { id: 'wind', label: 'Wind', enabled: true, providerLayer: 'wind', unavailableReason: undefined },
  { id: 'cloud', label: 'Cloud', enabled: true, providerLayer: 'cloud', unavailableReason: undefined },
  {
    id: 'air',
    label: 'Air quality',
    enabled: false,
    unavailableReason: 'Air quality raster tiles are not enabled for this map.',
  },
] as const satisfies readonly WeatherLayerConfig[]

export function getWeatherLayerConfig(id: WeatherLayerId): WeatherLayerConfig | undefined {
  return WEATHER_LAYER_CONFIG.find(layer => layer.id === id)
}

export function getEnabledWeatherLayers(): readonly WeatherLayerConfig[] {
  return WEATHER_LAYER_CONFIG.filter(layer => layer.enabled && Boolean(layer.providerLayer))
}

/**
 * Build a concrete tile request path for tests, diagnostics, or non-Leaflet
 * consumers. Provider layer values are encoded so they cannot add query
 * parameters to the browser request.
 */
export function buildMapTilePath(providerLayer: string, coordinates: MapTileCoordinates): string {
  const layer = encodeURIComponent(providerLayer)
  const z = encodeURIComponent(String(coordinates.z))
  const x = encodeURIComponent(String(coordinates.x))
  const y = encodeURIComponent(String(coordinates.y))
  return `/api/map-tile?layer=${layer}&z=${z}&x=${x}&y=${y}`
}

/**
 * Leaflet expands its {z}, {x}, and {y} tokens after it receives this
 * same-origin browser path. Returning null keeps disabled layers from ever
 * creating a tile request.
 */
export function getMapTileUrlTemplate(layer: WeatherLayerConfig | undefined): string | null {
  if (!layer?.enabled || !layer.providerLayer) return null
  return `/api/map-tile?layer=${encodeURIComponent(layer.providerLayer)}&z={z}&x={x}&y={y}`
}
