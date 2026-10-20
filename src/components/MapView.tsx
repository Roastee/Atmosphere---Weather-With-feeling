import { useEffect, useRef, useState } from 'react'
import { Cloud, Droplets, Gauge, Layers3, Wind } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useAirQuality, useLiveWeather } from '../hooks/useLiveWeather'
import { getEnabledWeatherLayers, getMapTileUrlTemplate, getWeatherLayerConfig, WEATHER_LAYER_CONFIG } from '../lib/mapLayers'
import { formatValue, reading } from './dashboard/weatherData'
import { ErrorBoundary } from './shared/ErrorBoundary'
import type { Location } from '../types/api'
import type { WeatherLayerId } from '../types/map'

type OverlayStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable'

const OVERLAY_LOAD_TIMEOUT_MS = 10_000

function markerIcon() {
  return L.divIcon({
    className: 'selected-location-marker',
    html: '<span aria-hidden="true"></span>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

function PointReadings({ location }: { location: Location }) {
  const weather = useLiveWeather(location, 1)
  const air = useAirQuality(location)
  const forecastUnits = weather.forecast?.units.current
  const aqi = reading(air.data?.current, 'us_aqi')
  return <section className="map-point-readings panel" aria-labelledby="map-point-readings-title">
    <div className="section-header"><div><h2 id="map-point-readings-title">Selected point readings</h2><span>Open-Meteo values at {location.name}; no interpolation</span></div></div>
    <div className="map-reading-grid">
      <div><span><Gauge size={14} /> Temperature</span><strong>{formatValue(reading(weather.forecast?.current, 'temperature_2m'), ` ${forecastUnits?.temperature_2m || '°C'}`, 1)}</strong></div>
      <div><span><Droplets size={14} /> Precipitation</span><strong>{formatValue(reading(weather.forecast?.current, 'precipitation'), ` ${forecastUnits?.precipitation || 'mm'}`, 1)}</strong></div>
      <div><span><Wind size={14} /> Wind</span><strong>{formatValue(reading(weather.forecast?.current, 'wind_speed_10m'), ` ${forecastUnits?.wind_speed_10m || 'km/h'}`, 1)}</strong></div>
      <div><span><Cloud size={14} /> Cloud cover</span><strong>{formatValue(reading(weather.forecast?.current, 'cloud_cover'), '%')}</strong></div>
      <div><span><Layers3 size={14} /> Air quality</span><strong>{formatValue(aqi, ' US AQI')}</strong></div>
    </div>
    {(weather.loading || air.loading) && <p className="map-data-status" role="status">Loading selected point data…</p>}
    {(weather.forecast?.meta.stale || air.data?.meta.stale) && <p className="map-data-status warning" role="status">Showing cached provider readings for this point.</p>}
    {(weather.error || air.error) && <p className="map-data-status warning" role="status">Some point readings are unavailable. Missing values are shown as —.</p>}
  </section>
}

function detachOverlay(map: L.Map | null, overlay: L.TileLayer | null) {
  if (!overlay) return
  try { overlay.off() } catch { /* Leaflet may already be disposing the layer. */ }
  try {
    if (map?.hasLayer(overlay)) map.removeLayer(overlay)
  } catch { /* A failed optional layer must not affect the map route. */ }
}

function MapPanel({ location }: { location: Location }) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const overlayRef = useRef<L.TileLayer | null>(null)
  // Do not spend tile bandwidth until the user explicitly chooses an overlay.
  const [activeLayer, setActiveLayer] = useState<WeatherLayerId | null>(null)
  const [tileError, setTileError] = useState(false)
  const [overlayStatus, setOverlayStatus] = useState<OverlayStatus>('idle')
  const selectedLayer = activeLayer ? getWeatherLayerConfig(activeLayer) : undefined
  const enabledLayerCount = getEnabledWeatherLayers().length
  const unavailableLayerCount = WEATHER_LAYER_CONFIG.length - enabledLayerCount

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return
    const map = L.map(mapContainer.current, {
      center: [location.latitude, location.longitude],
      zoom: 10,
      minZoom: 2,
      maxZoom: 19,
      zoomControl: false,
      keyboard: true,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
    })
    L.control.zoom({ position: 'topright' }).addTo(map)
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noreferrer">OpenStreetMap contributors</a>',
      crossOrigin: true,
    })
    const handleBaseTileError = () => setTileError(true)
    const handleBaseTileLoad = () => setTileError(false)
    tiles.on('tileerror', handleBaseTileError)
    tiles.on('load', handleBaseTileLoad)
    tiles.addTo(map)
    const marker = L.marker([location.latitude, location.longitude], { icon: markerIcon(), title: location.name, alt: `${location.name} selected location` }).addTo(map)
    marker.bindTooltip(location.name, { direction: 'top', offset: [0, -12] })
    mapRef.current = map
    markerRef.current = marker
    const resize = () => map.invalidateSize()
    window.addEventListener('resize', resize)
    const animationFrame = requestAnimationFrame(resize)
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationFrame)
      try { tiles.off('tileerror', handleBaseTileError) } catch { /* Base layer cleanup is best effort. */ }
      try { tiles.off('load', handleBaseTileLoad) } catch { /* Base layer cleanup is best effort. */ }
      const overlay = overlayRef.current
      detachOverlay(map, overlay)
      overlayRef.current = null
      try { marker.remove() } catch { /* Leaflet may already be disposing the map. */ }
      try { map.remove() } catch { /* A failed optional layer must not affect the route. */ }
      mapRef.current = null
      markerRef.current = null
    }
    // The map instance is intentionally created once; location updates are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = activeLayer ? getWeatherLayerConfig(activeLayer) : undefined
    const previousOverlay = overlayRef.current

    detachOverlay(map, previousOverlay)
    overlayRef.current = null

    if (!map) return

    let urlTemplate: string | null
    try {
      urlTemplate = getMapTileUrlTemplate(layer)
    } catch {
      setOverlayStatus('error')
      return
    }

    if (!layer || !urlTemplate) {
      setOverlayStatus(layer ? 'unavailable' : 'idle')
      return
    }

    let disposed = false
    let hadTileError = false
    let overlay: L.TileLayer | null = null
    let timeout: ReturnType<typeof setTimeout> | undefined
    const handleOverlayLoading = () => {
      if (!disposed) setOverlayStatus('loading')
    }
    const handleOverlayLoad = () => {
      if (!disposed && !hadTileError) {
        if (timeout !== undefined) clearTimeout(timeout)
        setOverlayStatus('ready')
      }
    }
    const handleOverlayTileError = () => {
      hadTileError = true
      if (timeout !== undefined) clearTimeout(timeout)
      if (!disposed) setOverlayStatus('error')
    }

    try {
      overlay = L.tileLayer(urlTemplate, {
        maxZoom: 19,
        opacity: 0.64,
        zIndex: 2,
        crossOrigin: true,
      })
      overlay.on('loading', handleOverlayLoading)
      overlay.on('load', handleOverlayLoad)
      overlay.on('tileerror', handleOverlayTileError)
      overlayRef.current = overlay
      setOverlayStatus('loading')
      timeout = setTimeout(() => {
        if (disposed) return
        setOverlayStatus('error')
        if (overlayRef.current === overlay) overlayRef.current = null
        detachOverlay(map, overlay)
      }, OVERLAY_LOAD_TIMEOUT_MS)
      overlay.addTo(map)
    } catch {
      if (!disposed) setOverlayStatus('error')
      if (overlayRef.current === overlay) overlayRef.current = null
      detachOverlay(map, overlay)
    }

    return () => {
      disposed = true
      if (timeout !== undefined) clearTimeout(timeout)
      if (overlay) {
        try { overlay.off('loading', handleOverlayLoading) } catch { /* Layer cleanup is best effort. */ }
        try { overlay.off('load', handleOverlayLoad) } catch { /* Layer cleanup is best effort. */ }
        try { overlay.off('tileerror', handleOverlayTileError) } catch { /* Layer cleanup is best effort. */ }
      }
      if (overlayRef.current === overlay) overlayRef.current = null
      detachOverlay(map, overlay)
    }
  }, [activeLayer])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) return
    const point: L.LatLngExpression = [location.latitude, location.longitude]
    marker.setLatLng(point).setTooltipContent(location.name).openTooltip()
    map.setView(point, map.getZoom(), { animate: false })
  }, [location.latitude, location.longitude, location.name])

  const overlayStatusCopy = selectedLayer
    ? overlayStatus === 'loading'
      ? { title: `Loading ${selectedLayer.label} overlay…`, detail: 'Requesting provider tiles through the browser map route.' }
      : overlayStatus === 'ready'
        ? { title: `${selectedLayer.label} overlay active`, detail: 'The selected provider raster is displayed above the OpenStreetMap base.' }
        : overlayStatus === 'error'
          ? { title: `${selectedLayer.label} overlay unavailable`, detail: 'The provider tile route did not return usable tiles. Point readings remain available below.' }
          : overlayStatus === 'unavailable'
            ? { title: `${selectedLayer.label} overlay unavailable`, detail: selectedLayer.unavailableReason || 'This layer has no enabled provider raster configuration.' }
            : { title: `${selectedLayer.label} overlay ready`, detail: 'Select an enabled layer to request its provider raster tiles.' }
    : enabledLayerCount > 0
      ? { title: 'No overlay selected', detail: 'Select a weather layer to request its provider raster tiles. The OpenStreetMap base and point readings remain available.' }
      : { title: 'Weather overlays unavailable', detail: 'No enabled provider raster layers are configured. The OpenStreetMap base and point readings remain available.' }

  return <section className="map-card panel" aria-labelledby="map-title">
      <div className="map-toolbar"><div><span className="overline">Selected location · OpenStreetMap</span><h2 id="map-title">Explore {location.name}</h2><p className="map-coordinates">{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)} · Touch or scroll to zoom · drag to pan</p></div><div className="map-source-badge">OSM base map</div></div>
      <div className="map-canvas leaflet-shell">
        <div ref={mapContainer} className="leaflet-map" aria-label={`Map centered on ${location.name}`} />
        {tileError && <div className="map-fallback" role="status"><strong>Map tiles are unavailable</strong><span>The selected point is still available. Check your connection or try again later.</span></div>}
      </div>
      <div className="map-layers panel" aria-label="Weather map layers">
        <div className="map-layers-heading"><div><span className="overline">Layers</span><h3>Atmospheric overlays</h3></div><span className="map-layer-note">{enabledLayerCount} enabled · {unavailableLayerCount} unavailable</span></div>
        <div className="map-layer-buttons" role="group" aria-label="Select weather layer">{WEATHER_LAYER_CONFIG.map(layer => {
          const available = layer.enabled && Boolean(layer.providerLayer)
          return <button key={layer.id} type="button" className={activeLayer === layer.id ? 'selected' : ''} aria-pressed={activeLayer === layer.id} disabled={!available} title={available ? `Show ${layer.label} overlay` : layer.unavailableReason || `${layer.label} overlay unavailable`} onClick={() => available && setActiveLayer(layer.id)}>{layer.label}</button>
        })}</div>
        <div className={`map-legend ${overlayStatus}`} role="status" aria-live="polite"><strong>{overlayStatusCopy.title}</strong><span>{overlayStatusCopy.detail}</span></div>
      </div>
      <p className="map-attribution-note">Base map tiles are requested from OpenStreetMap only and include the required attribution. Weather and air quality values below come from the selected Open-Meteo point.</p>
  </section>
}

function MapRouteFallback({ onRetry }: { onRetry: () => void }) {
  return <section className="map-card panel route-fallback" role="status" aria-labelledby="map-route-fallback-title">
    <span className="overline">Map route</span>
    <strong id="map-route-fallback-title">The weather map is unavailable</strong>
    <span>The optional map layer could not be initialized. Selected point readings and the rest of the workspace remain available.</span>
    <button className="primary-button" type="button" onClick={onRetry}>Retry map</button>
  </section>
}

export function MapView({ location }: { location: Location }) {
  const [mapAttempt, setMapAttempt] = useState(0)
  const locationKey = `${location.latitude}:${location.longitude}:${location.timezone}`
  return <div className="map-view">
    <ErrorBoundary key={`${locationKey}:${mapAttempt}`} fallback={<MapRouteFallback onRetry={() => setMapAttempt(attempt => attempt + 1)} />}>
      <MapPanel location={location} />
    </ErrorBoundary>
    <PointReadings location={location} />
  </div>
}
