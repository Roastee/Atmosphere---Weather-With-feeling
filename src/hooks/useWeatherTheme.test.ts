import { describe, expect, it } from 'vitest'
import { resolveWeatherTheme } from './useWeatherTheme'

describe('resolveWeatherTheme', () => {
  it('returns the centralized mapped condition and preserves clear nights', () => {
    expect(resolveWeatherTheme(63, true)).toMatchObject({ theme: 'rain' })
    expect(resolveWeatherTheme(0, false)).toMatchObject({ theme: 'clear-night' })
  })

  it('uses golden-hour only inside a real solar window', () => {
    const solar = {
      sunrise: '2026-10-13T06:00:00Z',
      sunset: '2026-10-13T18:00:00Z',
      now: '2026-10-13T06:30:00Z',
    }

    expect(resolveWeatherTheme(0, true, solar).theme).toBe('golden-hour')
    expect(resolveWeatherTheme(0, true, { ...solar, now: '2026-10-13T09:00:00Z' }).theme).toBe('clear-day')
    expect(resolveWeatherTheme(0, true, { ...solar, sunrise: '06:00', sunset: '18:00' }).theme).toBe('clear-day')
    expect(resolveWeatherTheme(0, false, solar).theme).toBe('clear-night')
  })

  it('evaluates Open-Meteo wall-clock solar times in the destination timezone', () => {
    const context = {
      timeZone: 'Asia/Kolkata',
      sunrise: '2026-10-13T06:00',
      sunset: '2026-10-13T18:00',
      now: '2026-10-13T00:30:00.000Z',
    }
    expect(resolveWeatherTheme(0, true, context).theme).toBe('golden-hour')
  })
})
