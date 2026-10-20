import { useState, useSyncExternalStore } from 'react'
import { Check, ChevronDown, ChevronUp, Pencil, Plus, ShieldCheck, Star, Trash2, X } from 'lucide-react'
import { useAirQuality, useLiveWeather } from '../hooks/useLiveWeather'
import { locationKey, locationStore, type SavedLocation } from '../lib/locationStore'
import { getWeatherCodeInfo } from '../lib/weatherCodes'
import { formatValue, reading } from './dashboard/weatherData'
import type { Location } from '../types/api'

function SavedLocationCard({ item, index, count, selected, onSelect }: { item: SavedLocation; index: number; count: number; selected: boolean; onSelect: (location: Location) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.label || '')
  const { forecast, loading, error } = useLiveWeather(item.location, 1)
  const name = item.label || item.location.name
  const temperature = reading(forecast?.current, 'temperature_2m')
  const unit = forecast?.units.current.temperature_2m || '°C'
  const condition = getWeatherCodeInfo(reading(forecast?.current, 'weather_code'), reading(forecast?.current, 'is_day') !== 0)
  const saveLabel = () => { locationStore.renameLocation(item.location, draft); setEditing(false) }
  return <article className={`location-card panel ${selected ? 'selected' : ''}`} aria-current={selected ? 'location' : undefined}>
    <div className="location-card-top"><div><span className="country">{item.location.country_code || 'LOCAL'}{item.isDefault ? ' · DEFAULT' : ''}</span>{editing ? <form className="location-rename" onSubmit={event => { event.preventDefault(); saveLabel() }}><input autoFocus value={draft} maxLength={80} onChange={event => setDraft(event.target.value)} aria-label={`Rename ${item.location.name}`} /><button type="submit" aria-label="Save location label"><Check size={14} /></button><button type="button" onClick={() => { setDraft(item.label || ''); setEditing(false) }} aria-label="Cancel rename"><X size={14} /></button></form> : <h3>{name}</h3>}<span className="location-card-meta">{item.location.admin1 || item.location.country}</span></div><div className="location-card-actions"><button className={`icon-button default-location ${item.isDefault ? 'is-default' : ''}`} aria-pressed={item.isDefault} aria-label={item.isDefault ? `${name} is the default location` : `Make ${name} the default location`} onClick={() => locationStore.setDefaultLocation(item.location)}><Star size={15} fill={item.isDefault ? 'currentColor' : 'none'} /></button><button className="icon-button" aria-label={`Remove ${name}`} onClick={() => locationStore.removeLocation(item.location)}><Trash2 size={15} /></button></div></div>
    <div className="location-card-bottom"><strong>{loading && !forecast ? '…' : formatValue(temperature, ` ${unit}`, 1)}</strong><span>{forecast ? `${condition.description}${forecast.meta.stale ? ' · stale cache' : ''}` : error ? 'Weather unavailable' : 'Loading live weather…'}</span><small>{item.location.latitude.toFixed(2)}, {item.location.longitude.toFixed(2)}</small></div>
    <div className="location-card-footer"><button className="text-button" onClick={() => onSelect(item.location)}>View live weather →</button><div className="location-order-actions"><button className="icon-button" disabled={index === 0} aria-label={`Move ${name} up`} onClick={() => locationStore.reorderLocations([locationKey(item.location), ...locationStore.getSnapshot().saved.filter(entry => locationKey(entry.location) !== locationKey(item.location)).map(entry => locationKey(entry.location))])}><ChevronUp size={14} /></button><button className="icon-button" disabled={index === count - 1} aria-label={`Move ${name} down`} onClick={() => { const keys = locationStore.getSnapshot().saved.map(entry => locationKey(entry.location)); [keys[index], keys[index + 1]] = [keys[index + 1], keys[index]]; locationStore.reorderLocations(keys) }}><ChevronDown size={14} /></button><button className="icon-button" aria-label={`Rename ${name}`} onClick={() => setEditing(true)}><Pencil size={14} /></button></div></div>
  </article>
}

function ComparisonRow({ item }: { item: SavedLocation }) {
  const weather = useLiveWeather(item.location, 1)
  const air = useAirQuality(item.location)
  const c = weather.forecast?.current
  const unit = weather.forecast?.units.current
  const name = item.label || item.location.name
  const condition = getWeatherCodeInfo(reading(c, 'weather_code'), reading(c, 'is_day') !== 0)
  return <tr><th scope="row"><strong>{name}</strong><span>{item.location.country_code || item.location.country}</span></th><td>{weather.loading && !weather.forecast ? 'Loading…' : formatValue(reading(c, 'temperature_2m'), ` ${unit?.temperature_2m || '°C'}`, 1)}</td><td>{c ? condition.description : '—'}</td><td>{formatValue(reading(c, 'wind_speed_10m'), ` ${unit?.wind_speed_10m || 'km/h'}`, 1)}</td><td>{air.loading && !air.data ? 'Loading…' : formatValue(reading(air.data?.current, 'us_aqi'), ' AQI')}</td></tr>
}

function ComparisonTable({ saved }: { saved: SavedLocation[] }) {
  return <section className="panel comparison-section" aria-labelledby="comparison-title"><div className="section-header"><div><h2 id="comparison-title">Compare locations</h2><span>Current provider values where returned · missing values shown as —</span></div></div><div className="comparison-scroll"><table className="comparison-table"><caption className="sr-only">Current weather and air quality comparison</caption><thead><tr><th scope="col">Location</th><th scope="col">Temperature</th><th scope="col">Weather</th><th scope="col">Wind</th><th scope="col">Air quality</th></tr></thead><tbody>{saved.map(item => <ComparisonRow key={locationKey(item.location)} item={item} />)}</tbody></table></div><p className="comparison-note">Values come from separate live Open-Meteo forecast and air-quality requests. A loading or unavailable cell is never filled with an estimate.</p></section>
}

export function SavedLocationsView({ location, onSelect }: { location: Location; onSelect: (location: Location) => void }) {
  const snapshot = useSyncExternalStore(locationStore.subscribe, locationStore.getSnapshot, locationStore.getSnapshot)
  const [notice, setNotice] = useState('')
  const saved = snapshot.saved
  const selectedKey = locationKey(location)
  const saveCurrent = () => { locationStore.saveLocation(location); setNotice(`${location.name} is saved on this device.`) }
  return <div className="single-view saved-locations-view">
    <section className="panel settings-section saved-header"><div className="section-header"><div><h2>Saved locations</h2><span>Stored locally on this device · reorder your workspace</span></div></div><button className="primary-button" disabled={saved.some(item => locationKey(item.location) === selectedKey)} onClick={saveCurrent}><Plus size={16} />{saved.some(item => locationKey(item.location) === selectedKey) ? 'Selected location saved' : 'Save selected location'}</button>{notice && <div className="saved-notice" role="status">{notice}<button className="icon-button" aria-label="Dismiss" onClick={() => setNotice('')}><X size={14} /></button></div>}</section>
    {saved.length ? <div className="locations-grid">{saved.map((item, index) => <SavedLocationCard key={locationKey(item.location)} item={item} index={index} count={saved.length} selected={locationKey(item.location) === selectedKey} onSelect={onSelect} />)}</div> : <section className="panel empty-locations"><strong>No saved locations yet.</strong><span>Save the selected location above or choose a city from Search to build your local workspace.</span></section>}
    {snapshot.recent.length > 0 && <section className="panel recent-section"><div className="section-header"><div><h2>Recent searches</h2><span>Up to 8 recent geocoding results, stored locally</span></div><button className="text-button" onClick={() => locationStore.clearRecentSearches()}>Clear recents</button></div><div className="recent-list">{snapshot.recent.map(item => <button key={locationKey(item)} className="recent-location" onClick={() => onSelect(item)}><span><strong>{item.name}</strong><small>{[item.admin1, item.country].filter(Boolean).join(', ')}</small></span><span className="recent-arrow">→</span></button>)}</div></section>}
    {saved.length >= 2 && <ComparisonTable saved={saved} />}
  </div>
}

export function SettingsView({ dark, setDark, reducedMotion, setReducedMotion }: { dark: boolean; setDark: (value: boolean) => void; reducedMotion: boolean; setReducedMotion: (value: boolean) => void }) {
  return <div className="single-view settings-view"><section className="panel settings-section"><div className="section-header"><div><h2>Appearance</h2><span>Make Atmosphere feel like yours</span></div></div><div className="setting-row"><strong>Theme</strong><div className="segmented"><button className={dark ? 'selected' : ''} onClick={() => setDark(true)}>Dark</button><button className={!dark ? 'selected' : ''} onClick={() => setDark(false)}>Light</button></div></div><div className="setting-row"><strong>Reduced motion</strong><button role="switch" aria-checked={reducedMotion} className={`switch ${reducedMotion ? 'on' : ''}`} onClick={() => setReducedMotion(!reducedMotion)}><i /></button></div></section><section className="panel privacy-section" aria-labelledby="privacy-title"><div className="privacy-icon"><ShieldCheck size={17} /></div><div><h2 id="privacy-title">Privacy and data sources</h2><p>Saved locations, labels, ordering and recent searches stay in this browser’s local storage. Search terms go only to Open-Meteo geocoding; selected coordinates go only to the Open-Meteo forecast and air-quality endpoints for live readings. Maps request base tiles from OpenStreetMap with attribution.</p><span className="privacy-local"><Check size={13} /> Local-only location storage</span></div></section></div>
}
