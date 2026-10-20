import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ForecastData, Location } from '../../types/api'

vi.mock('../../hooks/useLiveWeather', () => ({
  useLiveWeather: vi.fn(),
  useAirQuality: vi.fn(),
}))

import { useLiveWeather } from '../../hooks/useLiveWeather'
import { Dashboard } from '../LiveWeather'
import { DailyForecast } from './DailyForecast'
import { HourlyForecast } from './HourlyForecast'

const location: Location = {
  id: 1277333,
  name: 'Bengaluru',
  admin1: 'Karnataka',
  country: 'India',
  country_code: 'IN',
  latitude: 12.9716,
  longitude: 77.5946,
  timezone: 'Asia/Kolkata',
}

const meta = {
  provider: 'open-meteo',
  source: 'https://api.open-meteo.com/v1/forecast',
  updatedAt: Date.now(),
  cached: false,
  stale: false,
}

const emptyForecast: ForecastData = {
  current: {},
  hourly: { time: [] },
  daily: { time: [] },
  timezone: 'Asia/Kolkata',
  units: { current: {}, hourly: {}, daily: {} },
  meta,
}

describe('Dashboard forecast states', () => {
  it('communicates loading across the current, hourly, and daily cards', () => {
    vi.mocked(useLiveWeather).mockReturnValue({ forecast: null, error: null, loading: true, refresh: vi.fn() })

    render(<Dashboard location={location} onNavigate={vi.fn()} />)

    expect(screen.getByRole('region', { name: 'Current weather' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Loading hourly forecast…')).toBeVisible()
    expect(screen.getByText('Loading daily outlook…')).toBeVisible()
    expect(screen.getByRole('status', { name: 'weather data status' })).toHaveTextContent('Updating')
  })

  it('keeps retry guidance visible when the provider fails without data', () => {
    vi.mocked(useLiveWeather).mockReturnValue({ forecast: null, error: 'Network request failed', loading: false, refresh: vi.fn() })

    render(<Dashboard location={location} onNavigate={vi.fn()} />)

    expect(screen.getByText('Conditions unavailable')).toBeVisible()
    expect(screen.getByText('Hourly forecast unavailable. Use refresh to retry.')).toBeVisible()
    expect(screen.getByText('Daily outlook unavailable. Use refresh to retry.')).toBeVisible()
    expect(screen.getByText('Network request failed. Please retry.')).toBeVisible()
  })

  it('distinguishes a valid response with empty forecast series from loading', () => {
    render(<><HourlyForecast data={emptyForecast} loading={false} /><DailyForecast data={emptyForecast} loading={false} /></>)

    expect(screen.getByText('No upcoming hourly readings were returned.')).toBeVisible()
    expect(screen.getByText('No daily readings were returned.')).toBeVisible()
  })
})
