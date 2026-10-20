import { describe, expect, it } from 'vitest'
import {
  alignedHourlyPoints, bestOutdoorWindow, formatDaylightDuration, formatLocalTimeLabel,
  precipitationSummary, temperatureExtrema, trendCardCalculations, uvRiskCategory, windSummary,
} from './visualization'

describe('visualization data helpers', () => {
  it('aligns short and missing hourly series without shifting values', () => {
    expect(alignedHourlyPoints({ time: ['2026-01-01T23:00', '2026-01-02T00:00'], temperature_2m: [2] })).toEqual([
      { index: 0, time: '2026-01-01T23:00', values: { time: '2026-01-01T23:00', temperature_2m: 2 } },
      { index: 1, time: '2026-01-02T00:00', values: { time: '2026-01-02T00:00', temperature_2m: null } },
    ])
    expect(alignedHourlyPoints(null)).toEqual([])
  })

  it('formats local wall times across midnight and instant times across DST', () => {
    expect(formatLocalTimeLabel('2026-03-08T00:30', 'America/New_York')).toBe('00:30')
    expect(formatLocalTimeLabel('2026-03-08T06:30:00Z', 'America/New_York')).toMatch(/1:30|01:30/)
    expect(formatLocalTimeLabel('not-a-date', 'America/New_York')).toBe('—')
  })

  it('handles empty, partial, and extreme temperature data', () => {
    expect(temperatureExtrema([])).toEqual({ min: null, max: null, range: null, minIndex: null, maxIndex: null })
    expect(temperatureExtrema([-40, null, 54])).toMatchObject({ min: -40, max: 54, range: 94, minIndex: 0, maxIndex: 2 })
  })

  it('separates precipitation probability from quantities', () => {
    expect(precipitationSummary([20, null, 80], [0, 2.5, null])).toMatchObject({ probabilityMax: 80, probabilityAverage: 50, quantityTotal: 2.5, quantityMax: 2.5 })
    expect(precipitationSummary()).toMatchObject({ probabilityMax: null, quantityTotal: null })
  })

  it('provides wind scale, direction, UV, daylight and trend labels', () => {
    expect(windSummary(36, 360)).toMatchObject({ beaufort: 5, direction: 'N 360°' })
    expect(windSummary(null, null).beaufortLabel).toBe('—')
    expect(uvRiskCategory(11)).toBe('extreme')
    expect(uvRiskCategory(null)).toBeNull()
    expect(formatDaylightDuration(45000)).toBe('12h 30m')
    expect(formatDaylightDuration(null)).toBe('—')
    expect(trendCardCalculations([null, -40, 54])).toMatchObject({ low: -40, high: 54, change: 94, direction: 'up' })
  })

  it('chooses the longest eligible daylight window and tolerates missing fields', () => {
    const points = [
      { time: '2026-06-01T09:00', temperature: 20, isDay: 1 },
      { time: '2026-06-01T10:00', temperature: 22, isDay: 1, precipitationProbability: 10 },
      { time: '2026-06-01T11:00', temperature: 24, isDay: 1, precipitation: 0 },
      { time: '2026-06-01T12:00', temperature: 25, isDay: 0 },
    ]
    expect(bestOutdoorWindow(points, { maxTemperature: 30, minHours: 2 })).toMatchObject({ start: '2026-06-01T09:00', end: '2026-06-01T11:00', durationHours: 3 })
    expect(bestOutdoorWindow([])).toBeNull()
  })
})
