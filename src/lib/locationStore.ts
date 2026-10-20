import type { Location } from '../types/api'

export interface SavedLocation {
  location: Location
  label?: string
  order: number
  isDefault: boolean
}

export interface LocationStoreSnapshot {
  saved: SavedLocation[]
  recent: Location[]
}

export interface LocationStore {
  getSnapshot: () => LocationStoreSnapshot
  subscribe: (listener: () => void) => () => void
  saveLocation: (location: Location, label?: string) => SavedLocation
  removeLocation: (location: Location | string) => void
  renameLocation: (location: Location | string, label: string) => void
  reorderLocations: (orderedKeys: string[]) => void
  setDefaultLocation: (location: Location | string) => void
  addRecentSearch: (location: Location) => void
  clearRecentSearches: () => void
}

const STORAGE_KEY = 'atmosphere-location-store-v1'
const MAX_RECENT = 8
const emptySnapshot: LocationStoreSnapshot = Object.freeze({ saved: [], recent: [] })
const sanitizeLabel = (label: string) => label.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80)

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

export function locationKey(location: Location): string {
  return `${location.id}:${location.latitude.toFixed(5)}:${location.longitude.toFixed(5)}`
}

function validLocation(value: unknown): value is Location {
  if (!isRecord(value)) return false
  return typeof value.id === 'number' && Number.isFinite(value.id) && typeof value.name === 'string' && value.name.trim().length > 0 &&
    typeof value.country === 'string' && typeof value.country_code === 'string' &&
    typeof value.latitude === 'number' && Number.isFinite(value.latitude) && value.latitude >= -90 && value.latitude <= 90 &&
    typeof value.longitude === 'number' && Number.isFinite(value.longitude) && value.longitude >= -180 && value.longitude <= 180 &&
    typeof value.timezone === 'string' && value.timezone.length > 0 &&
    (value.admin1 === undefined || typeof value.admin1 === 'string')
}

function validSaved(value: unknown): value is SavedLocation {
  if (!isRecord(value) || !validLocation(value.location) || typeof value.order !== 'number' || !Number.isFinite(value.order) || typeof value.isDefault !== 'boolean') return false
  return value.label === undefined || (typeof value.label === 'string' && sanitizeLabel(value.label) === value.label.trim() && value.label.length <= 80)
}

function validPersisted(value: unknown): value is { version?: number; saved?: unknown[]; recent?: unknown[] } {
  return isRecord(value) && (value.version === undefined || value.version === 1) && (value.saved === undefined || Array.isArray(value.saved)) && (value.recent === undefined || Array.isArray(value.recent))
}

function normalizeSaved(values: SavedLocation[]): SavedLocation[] {
  const unique = new Map<string, SavedLocation>()
  values
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach(item => {
      const key = locationKey(item.location)
       if (!unique.has(key)) unique.set(key, { ...item, location: { ...item.location }, label: item.label ? sanitizeLabel(item.label) || undefined : undefined })
    })
  const result = Array.from(unique.values())
  let defaultSeen = false
  return result.map((item, order) => {
    const isDefault = item.isDefault && !defaultSeen ? (defaultSeen = true, true) : false
    return { ...item, order, isDefault }
  }).map((item, index, all) => index === 0 && !all.some(entry => entry.isDefault) ? { ...item, isDefault: true } : item)
}

function normalizeRecent(values: Location[]): Location[] {
  const unique = new Map<string, Location>()
  values.forEach(item => { if (!unique.has(locationKey(item))) unique.set(locationKey(item), { ...item }) })
  return Array.from(unique.values()).slice(0, MAX_RECENT)
}

function readStorage(storage: Storage | null): LocationStoreSnapshot {
  if (!storage) return emptySnapshot
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return emptySnapshot
    const parsed: unknown = JSON.parse(raw)
    if (!validPersisted(parsed)) return emptySnapshot
    const saved = (parsed.saved ?? []).filter(validSaved)
    const recent = (parsed.recent ?? []).filter(validLocation)
    return { saved: normalizeSaved(saved), recent: normalizeRecent(recent) }
  } catch {
    return emptySnapshot
  }
}

function storageForBrowser(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

export function createLocationStore(storage: Storage | null = storageForBrowser()): LocationStore {
  let snapshot = readStorage(storage)
  const listeners = new Set<() => void>()

  const persist = () => {
    try { storage?.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...snapshot })) } catch { /* Browser storage can be disabled or full; memory state remains usable. */ }
    listeners.forEach(listener => listener())
  }
  const resolveKey = (value: Location | string) => typeof value === 'string' ? value : locationKey(value)
  const update = (next: LocationStoreSnapshot) => { snapshot = { saved: normalizeSaved(next.saved), recent: normalizeRecent(next.recent) }; persist() }

  const store: LocationStore = {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    saveLocation: (location, label) => {
      const key = locationKey(location)
      const existing = snapshot.saved.find(item => locationKey(item.location) === key)
      const saved: SavedLocation = existing
         ? { ...existing, location: { ...location }, label: label === undefined ? existing.label : sanitizeLabel(label) || undefined }
         : { location: { ...location }, label: label ? sanitizeLabel(label) || undefined : undefined, order: snapshot.saved.length, isDefault: snapshot.saved.length === 0 }
      update({ saved: existing ? snapshot.saved.map(item => locationKey(item.location) === key ? saved : item) : [...snapshot.saved, saved], recent: snapshot.recent })
      return store.getSnapshot().saved.find(item => locationKey(item.location) === key) || saved
    },
    removeLocation: value => {
      const key = resolveKey(value)
      update({ saved: snapshot.saved.filter(item => locationKey(item.location) !== key), recent: snapshot.recent })
    },
    renameLocation: (value, label) => {
      const key = resolveKey(value)
       update({ saved: snapshot.saved.map(item => locationKey(item.location) === key ? { ...item, label: sanitizeLabel(label) || undefined } : item), recent: snapshot.recent })
    },
    reorderLocations: orderedKeys => {
      const rank = new Map(orderedKeys.map((key, index) => [key, index]))
      const ordered = snapshot.saved.slice().sort((a, b) => (rank.get(locationKey(a.location)) ?? orderedKeys.length + a.order) - (rank.get(locationKey(b.location)) ?? orderedKeys.length + b.order)).map((item, order) => ({ ...item, order }))
      update({ saved: ordered, recent: snapshot.recent })
    },
    setDefaultLocation: value => {
      const key = resolveKey(value)
      update({ saved: snapshot.saved.map(item => ({ ...item, isDefault: locationKey(item.location) === key })), recent: snapshot.recent })
    },
    addRecentSearch: location => update({ saved: snapshot.saved, recent: normalizeRecent([location, ...snapshot.recent]) }),
    clearRecentSearches: () => update({ saved: snapshot.saved, recent: [] }),
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', event => {
      if (event.key !== STORAGE_KEY) return
      snapshot = readStorage(storage)
      listeners.forEach(listener => listener())
    })
  }
  return store
}

export const locationStore = createLocationStore()
