import { describe, expect, it } from 'vitest'
import { direction, formatValue, localStamp, wallTime } from './weatherData'

describe('weather display helpers', () => {
  it('formats temperatures and missing values without inventing readings', () => {
    expect(formatValue(21.456, '°C', 1)).toBe('21.5°C')
    expect(formatValue(null, '°C')).toBe('—')
    expect(formatValue('21', '°C')).toBe('—')
  })

  it('formats wind direction with normalized compass points', () => {
    expect(direction(0)).toBe('N 0°')
    expect(direction(360)).toBe('N 360°')
    expect(direction(-45)).toBe('NW -45°')
    expect(direction(null)).toBe('—')
  })

  it('keeps provider wall times in the requested timezone', () => {
    expect(localStamp('Asia/Kolkata', new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01T05:30')
    expect(wallTime('2026-01-01T06:30', 'Asia/Kolkata')).toBe('06:30')
    expect(wallTime('2026-01-01T00:00:00.000Z', 'Asia/Kolkata')).toMatch(/5:30|05:30/)
    expect(wallTime('not-a-time', 'Asia/Kolkata')).toBe('—')
  })
})
