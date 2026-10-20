import { describe, expect, it } from 'vitest'
import { convertTemperature, convertWindSpeed, formatTimezone } from './formatting'

describe('weather formatting helpers', () => {
  it('converts temperature and wind units', () => {
    expect(convertTemperature(0, 'celsius', 'fahrenheit')).toBe(32)
    expect(convertWindSpeed(36, 'kmh', 'ms')).toBe(10)
    expect(convertTemperature(null, 'celsius', 'fahrenheit')).toBeNull()
  })

  it('formats a timestamp in the requested timezone', () => {
    const formatted = formatTimezone(new Date('2026-01-01T00:00:00.000Z'), 'Asia/Kolkata', { timeZoneName: 'short' })
    expect(formatted).toMatch(/Jan 1|GMT\+5:30|IST/)
  })
})
