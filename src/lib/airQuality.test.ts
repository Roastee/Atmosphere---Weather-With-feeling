import { describe, expect, it } from 'vitest'
import { getAirQualityCategory, getPrimaryPollutant } from './airQuality'

describe('air-quality interpretation helpers', () => {
  it('uses the correct neutral category bands for both index scales', () => {
    expect(getAirQualityCategory(42, 'us').label).toBe('Good')
    expect(getAirQualityCategory(42, 'european').label).toBe('Moderate')
    expect(getAirQualityCategory(null, 'us').label).toBe('Not available')
    expect(getAirQualityCategory(42, 'us').informational).toBe(true)
  })

  it('derives the primary pollutant from returned values instead of assuming one', () => {
    expect(getPrimaryPollutant({ pm2_5: 4, pm10: 90, ozone: null })?.key).toBe('pm10')
    expect(getPrimaryPollutant({ pm2_5: null, ozone: 'not returned' })).toBeNull()
  })
})
