import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { SettingsView } from './LegacyViews'
import { SavedLocationsView } from './LegacyViews'
import { locationStore } from '../lib/locationStore'
import type { Location } from '../types/api'

vi.mock('../hooks/useLiveWeather', () => ({
  useLiveWeather: vi.fn(),
  useAirQuality: vi.fn(),
}))

import { useAirQuality, useLiveWeather } from '../hooks/useLiveWeather'

const bengaluru: Location = {
  id: 1277333,
  name: 'Bengaluru',
  admin1: 'Karnataka',
  country: 'India',
  country_code: 'IN',
  latitude: 12.9716,
  longitude: 77.5946,
  timezone: 'Asia/Kolkata',
}

const clearLocationStore = () => {
  for (const item of locationStore.getSnapshot().saved) locationStore.removeLocation(item.location)
  locationStore.clearRecentSearches()
}

beforeEach(() => {
  clearLocationStore()
  vi.mocked(useLiveWeather).mockReturnValue({ forecast: null, error: null, loading: false, refresh: vi.fn() })
  vi.mocked(useAirQuality).mockReturnValue({ data: null, error: null, loading: false, refresh: vi.fn() })
})

describe('SettingsView', () => {
  it('lets users change theme and reduced-motion preferences', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [dark, setDark] = React.useState(true)
      const [reducedMotion, setReducedMotion] = React.useState(false)
      return <SettingsView dark={dark} setDark={setDark} reducedMotion={reducedMotion} setReducedMotion={setReducedMotion} />
    }

    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Light' }))
    expect(screen.getByRole('button', { name: 'Light' })).toHaveClass('selected')

    const motionSwitch = screen.getByRole('switch')
    expect(motionSwitch).toHaveAttribute('aria-checked', 'false')
    await user.click(motionSwitch)
    expect(motionSwitch).toHaveAttribute('aria-checked', 'true')
  })
})

describe('SavedLocationsView', () => {
  it('saves the selected location and exposes it as a visible saved card', async () => {
    const user = userEvent.setup()
    render(<SavedLocationsView location={bengaluru} onSelect={vi.fn()} />)

    expect(screen.getByText('No saved locations yet.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Save selected location' }))

    expect(await screen.findByRole('heading', { name: 'Bengaluru' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Bengaluru is saved on this device.')
    expect(screen.getByRole('button', { name: 'Selected location saved' })).toBeDisabled()
    expect(locationStore.getSnapshot().saved[0].location.name).toBe('Bengaluru')
  })

  it('renders recent searches and sends a selected recent location to the parent', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    locationStore.addRecentSearch(bengaluru)
    render(<SavedLocationsView location={bengaluru} onSelect={onSelect} />)

    const recent = screen.getByRole('button', { name: /Bengaluru.*India/ })
    await user.click(recent)
    expect(onSelect).toHaveBeenCalledWith(bengaluru)
  })
})
