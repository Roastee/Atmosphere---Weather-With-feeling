import { describe, expect, it } from 'vitest'
import { getWeatherCodeInfo } from './weatherCodes'

describe('weather code mapping', () => {
  it('maps clear conditions to day and night variants', () => {
    expect(getWeatherCodeInfo(0, true)).toMatchObject({ label: 'Clear', icon: 'sun', theme: 'clear-day' })
    expect(getWeatherCodeInfo(0, false)).toMatchObject({ label: 'Clear', icon: 'moon', theme: 'clear-night' })
  })

  it('preserves severe storm metadata and handles unknown codes honestly', () => {
    expect(getWeatherCodeInfo(95)).toMatchObject({ label: 'Thunderstorm', severity: 'severe', theme: 'thunderstorm' })
    expect(getWeatherCodeInfo(999)).toMatchObject({ label: 'Unknown conditions', description: 'Conditions unavailable', icon: 'unknown' })
  })
})
