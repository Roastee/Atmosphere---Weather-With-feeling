import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Bell, ChevronRight, LocateFixed, Menu, Moon, RefreshCw, Sun, X } from 'lucide-react'
import { Dashboard, ForecastView } from './components/LiveWeather'
import { SearchLocation } from './components/SearchLocation'
import type { Location } from './types/api'
import { useGeolocation } from './hooks/useGeolocation'
import { WeatherUnitsContext, type UnitPreference } from './hooks/useLiveWeather'
import openMeteoProvider from './lib/api'
import { locationStore } from './lib/locationStore'
import { BottomNavigation, Navigation, type View } from './app/Navigation'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useToast } from './components/shared/Feedback'

const AirQualityView = lazy(() => import('./components/AirQualityView'))
const MapsView = lazy(() => import('./components/MapsView'))
const SavedLocationsView = lazy(() => import('./components/LegacyViews').then(module => ({ default: module.SavedLocationsView })))
const SettingsView = lazy(() => import('./components/LegacyViews').then(module => ({ default: module.SettingsView })))

function RouteFallback() {
  return <div className="panel route-fallback" role="status"><span className="overline">Workspace view</span><strong>Loading view…</strong></div>
}

const defaultLocation: Location = { id: 1277333, name: 'Bengaluru', admin1: 'Karnataka', country: 'India', country_code: 'IN', latitude: 12.9716, longitude: 77.5946, timezone: 'Asia/Kolkata' }
const pref = (key: string, fallback: boolean) => { try { const v = localStorage.getItem(key); return v === null ? fallback : v === 'true' } catch { return fallback } }
const readLocation = (): Location => {
  try {
    const value = JSON.parse(localStorage.getItem('atmosphere-location') || 'null')
    if (!value || !Number.isFinite(value.id) || typeof value.name !== 'string' || !value.name.trim() || typeof value.country !== 'string' || typeof value.country_code !== 'string' || (value.admin1 !== undefined && typeof value.admin1 !== 'string') || !Number.isFinite(value.latitude) || Math.abs(value.latitude) > 90 || !Number.isFinite(value.longitude) || Math.abs(value.longitude) > 180 || typeof value.timezone !== 'string') return defaultLocation
    new Intl.DateTimeFormat(undefined, { timeZone: value.timezone })
    return value as Location
  } catch { return defaultLocation }
}
const readUnits = (): UnitPreference => { try { const value = JSON.parse(localStorage.getItem('atmosphere-units') || 'null'); if ((value?.temperature === 'celsius' || value?.temperature === 'fahrenheit') && (value?.wind === 'kmh' || value?.wind === 'mph')) return value } catch { /* Browser storage is optional. */ } return { temperature: 'celsius', wind: 'kmh' } }

export default function App() {
  const [view, setView] = useState<View>('Dashboard'); const [location, setLocation] = useState<Location>(readLocation)
  const [units, setUnits] = useState<UnitPreference>(readUnits); const [lastUpdated, setLastUpdated] = useState<number | null>(null); const [dark, setDark] = useState(() => pref('atmosphere-dark', true)); const [reducedMotion, setReducedMotion] = useState(() => pref('atmosphere-reduced-motion', false)); const [mobileNavOpen, setMobileNavOpen] = useState(false); const [query, setQuery] = useState(''); const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine); const [notice, setNotice] = useState(''); const [refreshing, setRefreshing] = useState(false); const [explainLocation, setExplainLocation] = useState(false); const geo = useGeolocation(); const refreshController = useRef<AbortController | null>(null); const compactNav = useMediaQuery('(max-width: 960px)'); const toast = useToast()
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full'; try { localStorage.setItem('atmosphere-dark', String(dark)); localStorage.setItem('atmosphere-reduced-motion', String(reducedMotion)) } catch { /* Browser storage is optional. */ } }, [dark, reducedMotion])
  useEffect(() => { const on = () => setOffline(false); const off = () => setOffline(true); addEventListener('online', on); addEventListener('offline', off); return () => { removeEventListener('online', on); removeEventListener('offline', off) } }, [])
  useEffect(() => { try { localStorage.setItem('atmosphere-location', JSON.stringify(location)) } catch { /* Browser storage is optional. */ } }, [location])
  useEffect(() => { if (geo.error) setNotice(geo.error) }, [geo.error])
  useEffect(() => {
    setLastUpdated(null)
    const onUpdated = (event: Event) => { const detail = (event as CustomEvent).detail; if (typeof detail?.key === 'string' && detail.key.includes(`:${location.latitude}:${location.longitude}:${location.timezone}`) && Number.isFinite(detail.meta?.updatedAt)) setLastUpdated(detail.meta.updatedAt) }
    addEventListener('atmosphere:data-updated', onUpdated)
    return () => { removeEventListener('atmosphere:data-updated', onUpdated); refreshController.current?.abort() }
  }, [location, units])
  useEffect(() => { if (!geo.coords) return; const next: Location = { id: 0, name: 'Current location', country: 'Your area', country_code: '', latitude: geo.coords.latitude, longitude: geo.coords.longitude, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }; setLocation(next); setQuery(''); setView('Dashboard'); setMobileNavOpen(false); setNotice('Showing provider weather for your current coordinates.') }, [geo.coords])
  const choose = (next: Location) => { locationStore.addRecentSearch(next); setLocation(next); setQuery(''); setView('Dashboard'); setMobileNavOpen(false); toast(`${next.name} selected. Loading its live atmosphere.`, 'success') }
  const requestCurrentLocation = () => setExplainLocation(true)
  const changeUnits = (next: UnitPreference) => { setUnits(next); try { localStorage.setItem('atmosphere-units', JSON.stringify(next)) } catch { /* Browser storage is optional. */ }; toast(`Display units updated to ${next.temperature === 'celsius' ? 'Celsius' : 'Fahrenheit'} and ${next.wind === 'kmh' ? 'km/h' : 'mph'}.`, 'info') }
  const refreshAll = async () => {
    refreshController.current?.abort()
    const controller = new AbortController(); refreshController.current = controller
    setRefreshing(true); setNotice('')
    try {
      const request = { latitude: location.latitude, longitude: location.longitude, timezone: location.timezone, signal: controller.signal, forceRefresh: true }
      const results = await Promise.allSettled([
        openMeteoProvider.getForecast({ ...request, forecastDays: view === 'Forecast' ? 16 : 7, temperatureUnit: units.temperature, windSpeedUnit: units.wind }),
        openMeteoProvider.getAirQuality(request),
      ])
      if (controller.signal.aborted) return
      const messages: string[] = []
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') { setLastUpdated(result.value.meta.updatedAt); if (result.value.meta.stale) messages.push(result.value.meta.warning || 'Showing the last cached provider response.') }
        else messages.push(`${index === 0 ? 'Forecast' : 'Air quality'} refresh failed. Existing readings are retained; try again.`)
      })
       const message = messages.join(' ') || 'Weather and air quality refreshed.'
       setNotice(message)
       toast(message, messages.length ? 'warning' : 'success')
      window.dispatchEvent(new Event('atmosphere:refresh'))
    } catch { if (!controller.signal.aborted) setNotice('Refresh could not complete. Please try again.') }
    finally { if (refreshController.current === controller) setRefreshing(false) }
  }
  return <WeatherUnitsContext.Provider value={units}><div className="app-shell" data-weather-theme="unknown"><Navigation compact={compactNav} open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} view={view} onNavigate={setView} />
      <main id="main-content" className="main-content"><header className="topbar"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(v => !v)}><Menu size={21} /></button><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{view}</strong></div><div className="topbar-actions"><button className="icon-button" data-tooltip="Use your current location" aria-label="Use current location" title="Explain and use your current location" onClick={requestCurrentLocation}><LocateFixed size={17} /></button><div className="unit-controls" aria-label="Display units"><button aria-pressed={units.temperature === 'celsius'} className={units.temperature === 'celsius' ? 'active' : ''} onClick={() => changeUnits({ ...units, temperature: 'celsius' })}>°C</button><button aria-pressed={units.temperature === 'fahrenheit'} className={units.temperature === 'fahrenheit' ? 'active' : ''} onClick={() => changeUnits({ ...units, temperature: 'fahrenheit' })}>°F</button><button aria-pressed={units.wind === 'kmh'} className={units.wind === 'kmh' ? 'active' : ''} onClick={() => changeUnits({ ...units, wind: 'kmh' })}>km/h</button><button aria-pressed={units.wind === 'mph'} className={units.wind === 'mph' ? 'active' : ''} onClick={() => changeUnits({ ...units, wind: 'mph' })}>mph</button></div><span className="last-updated" title={lastUpdated ? new Date(lastUpdated).toLocaleString() : 'No provider update yet'}>{lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Not updated'}</span><button className="icon-button" data-tooltip={refreshing ? 'Refreshing weather data' : 'Refresh weather and air quality'} aria-label="Refresh weather and air quality" title="Refresh weather and air quality" onClick={refreshAll} disabled={refreshing}><RefreshCw className={refreshing ? 'spin' : ''} size={17} /></button><button className="icon-button" data-tooltip="Notifications" aria-label="Notifications" onClick={() => setNotice('Live notifications are not connected.')}><Bell size={18} /></button><button className="theme-toggle" data-tooltip={dark ? 'Switch to light theme' : 'Switch to dark theme'} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setDark(v => !v)}>{dark ? <Sun size={16} /> : <Moon size={16} />}<span>{dark ? 'Light' : 'Dark'}</span></button></div></header>
        <div className="content-wrap"><section className="heading-row"><div><div className="eyebrow">{new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeZone: location.timezone }).format(new Date())} <span className="live-pill">Provider data</span></div><h1>{view === 'Dashboard' ? 'Good morning' : view}</h1><p className="muted">A live atmospheric read for {location.name}.</p></div><SearchLocation query={query} setQuery={setQuery} onSelect={choose} /></section>{offline && <div className="notice app-toast" role="status">You’re offline. Live requests may use a cached provider response.</div>}{notice && <div className="notice app-toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button></div>}
        {explainLocation && <section className="location-permission notice" aria-labelledby="location-permission-title"><div><strong id="location-permission-title">Weather where you are</strong><p>Your browser will ask for location permission. We send your coordinates to Open-Meteo to load local weather and air quality and save your selected location on this device. Location is checked once, never continuously.</p></div><button className="text-button" disabled={geo.requesting} onClick={() => { setExplainLocation(false); geo.requestLocation() }}>Continue</button><button className="text-button" onClick={() => setExplainLocation(false)}>Cancel</button></section>}{geo.requesting && <div className="notice" role="status">Finding your current location…</div>}
         <Suspense fallback={<RouteFallback />}>
           {view === 'Dashboard' && <Dashboard location={location} onNavigate={setView} />}{view === 'Forecast' && <ForecastView location={location} />}{view === 'Air Quality' && <AirQualityView location={location} />}{view === 'Maps' && <MapsView location={location} />}{view === 'Saved Locations' && <SavedLocationsView location={location} onSelect={choose} />}{view === 'Settings' && <SettingsView dark={dark} setDark={setDark} reducedMotion={reducedMotion} setReducedMotion={setReducedMotion} />}
         </Suspense></div>
     </main>{compactNav && <BottomNavigation view={view} onNavigate={setView} />}</div></WeatherUnitsContext.Provider>
}
