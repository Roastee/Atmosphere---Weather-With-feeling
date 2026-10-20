import { describe, expect, it } from 'vitest'
import { createLocationStore, locationKey } from './locationStore'
import type { Location } from '../types/api'

class MemoryStorage {
  private values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
  clear() { this.values.clear() }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null }
  get length() { return this.values.size }
}

const location = (index: number): Location => ({ id: index, name: `City ${index}`, country: 'Testland', country_code: 'TS', latitude: index, longitude: index, timezone: 'UTC' })

describe('locationStore', () => {
  it('drops malformed records while reading the local schema', () => {
    const storage = new MemoryStorage()
    storage.setItem('atmosphere-location-store-v1', JSON.stringify({
      version: 1,
      saved: [{ location: { id: 1, name: 'Broken', country: 'Testland', country_code: 'TS', latitude: 200, longitude: 0, timezone: 'UTC' }, order: 0, isDefault: true }],
      recent: [{ id: 'not-a-number', name: 'Broken' }],
    }))
    const store = createLocationStore(storage as unknown as Storage)
    expect(store.getSnapshot()).toEqual({ saved: [], recent: [] })
  })

  it('validates persisted data and keeps saved locations ordered with one default', () => {
    const storage = new MemoryStorage()
    const store = createLocationStore(storage as unknown as Storage)
    const first = store.saveLocation(location(1))
    store.saveLocation(location(2), 'Office')
    store.setDefaultLocation(location(2))
    store.reorderLocations([locationKey(location(2)), locationKey(location(1))])

    expect(first.isDefault).toBe(true)
    expect(store.getSnapshot().saved.map(item => item.location.name)).toEqual(['City 2', 'City 1'])
    expect(store.getSnapshot().saved.find(item => item.isDefault)?.location.name).toBe('City 2')

    const restored = createLocationStore(storage as unknown as Storage)
    expect(restored.getSnapshot().saved[0].label).toBe('Office')
  })

  it('deduplicates recents, caps them at eight, and removes saved records safely', () => {
    const store = createLocationStore(new MemoryStorage() as unknown as Storage)
    for (let index = 0; index < 10; index += 1) store.addRecentSearch(location(index))
    store.addRecentSearch(location(5))
    expect(store.getSnapshot().recent).toHaveLength(8)
    expect(store.getSnapshot().recent[0].name).toBe('City 5')

    store.saveLocation(location(5))
    store.removeLocation(location(5))
    expect(store.getSnapshot().saved).toHaveLength(0)
    store.clearRecentSearches()
    expect(store.getSnapshot().recent).toEqual([])
  })

  it('sanitizes saved labels before persisting them', () => {
    const store = createLocationStore(new MemoryStorage() as unknown as Storage)
    store.saveLocation(location(1), '  <Home>\u0000  ')
    expect(store.getSnapshot().saved[0].label).toBe('<Home>')

    store.renameLocation(location(1), '  Office\u0007  ')
    expect(store.getSnapshot().saved[0].label).toBe('Office')
  })
})
