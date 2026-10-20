import { describe, expect, it } from 'vitest'
import {
  buildMapTilePath,
  getEnabledWeatherLayers,
  getMapTileUrlTemplate,
  getWeatherLayerConfig,
  WEATHER_LAYER_CONFIG,
} from './mapLayers'

describe('weather map layer configuration', () => {
  it('exposes only configured enabled layers as requestable overlays', () => {
    expect(getEnabledWeatherLayers().map(layer => layer.id)).toEqual(['temperature', 'precipitation', 'wind', 'cloud'])
    expect(getWeatherLayerConfig('air')).toMatchObject({ enabled: false })
    expect(getMapTileUrlTemplate(getWeatherLayerConfig('air'))).toBeNull()
  })

  it('builds a Leaflet-compatible same-origin tile template', () => {
    expect(getMapTileUrlTemplate(getWeatherLayerConfig('temperature'))).toBe('/api/map-tile?layer=temperature&z={z}&x={x}&y={y}')
  })

  it('encodes provider layer names and concrete tile coordinates', () => {
    expect(buildMapTilePath('rain & snow', { z: 5, x: 10, y: 12 })).toBe('/api/map-tile?layer=rain%20%26%20snow&z=5&x=10&y=12')
    expect(WEATHER_LAYER_CONFIG).toHaveLength(5)
  })
})
