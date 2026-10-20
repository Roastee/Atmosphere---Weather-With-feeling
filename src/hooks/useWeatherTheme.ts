import { useEffect } from 'react'
import { getWeatherCodeInfo, type AtmosphericTheme, type WeatherCodeInfo } from '../lib/weatherCodes'

export type WeatherTheme = AtmosphericTheme | 'golden-hour'
export type WeatherTimestamp = Date | string | number

export interface WeatherThemeSolarContext {
  sunrise?: WeatherTimestamp | null
  sunset?: WeatherTimestamp | null
  timeZone?: string | null
  now?: WeatherTimestamp | null
  currentTime?: WeatherTimestamp | null
  timestamp?: WeatherTimestamp | null
}

export interface WeatherThemeContext extends WeatherThemeSolarContext {
  /**
   * An optional local hour can be passed by callers that already have it, but
   * it is not enough on its own to infer a golden-hour theme.
   */
  hour?: number | null
  solar?: WeatherThemeSolarContext | null
}

export interface WeatherThemeResult {
  theme: WeatherTheme
  condition: WeatherCodeInfo
}

const GOLDEN_HOUR_WINDOW_MS = 45 * 60 * 1000

function isTimestampString(value: string) {
  return /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value.trim())
}

function toTimestamp(value: WeatherTimestamp | null | undefined): number | null {
  if (value == null) return null

  if (value instanceof Date) {
    const timestamp = value.getTime()
    return Number.isFinite(timestamp) ? timestamp : null
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    // Support both Unix seconds and JavaScript millisecond timestamps.
    return Math.abs(value) < 100_000_000_000 ? value * 1000 : value
  }

  if (!isTimestampString(value)) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

type WallClock = { date: string; minutes: number }

function toWallClock(value: WeatherTimestamp | null | undefined): WallClock | null {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/)
  if (!match) return null
  const hour = Number(match[2])
  const minute = Number(match[3])
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return null
  return { date: match[1], minutes: hour * 60 + minute }
}

function getWallClock(date: Date, timeZone: string): WallClock | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
    const hour = Number(values.hour)
    const minute = Number(values.minute)
    if (!values.year || !values.month || !values.day || !Number.isFinite(hour) || !Number.isFinite(minute)) return null
    return { date: `${values.year}-${values.month}-${values.day}`, minutes: hour * 60 + minute }
  } catch {
    return null
  }
}

function isWithinGoldenHour(now: number, sunrise: number, sunset: number) {
  if (sunrise >= sunset) return false
  const afterSunrise = now - sunrise
  const beforeSunset = sunset - now
  return (afterSunrise >= 0 && afterSunrise <= GOLDEN_HOUR_WINDOW_MS) ||
    (beforeSunset >= 0 && beforeSunset <= GOLDEN_HOUR_WINDOW_MS)
}

function hasGoldenHourContext(isDay: boolean, context?: WeatherThemeContext) {
  // Golden hour is a daylight transition. Requiring isDay prevents a stale or
  // mismatched solar payload from turning an ordinary clear night into it.
  if (!isDay || !context) return false

  const solar = context.solar
  const timeZone = context.timeZone ?? solar?.timeZone ?? undefined
  const sunriseValue = context.sunrise ?? solar?.sunrise
  const sunsetValue = context.sunset ?? solar?.sunset
  const explicitNow = context.now ?? context.currentTime ?? context.timestamp ?? solar?.now ?? solar?.currentTime
  const now = explicitNow === undefined ? Date.now() : toTimestamp(explicitNow)

  if (timeZone && now != null) {
    const sunriseWall = toWallClock(sunriseValue)
    const sunsetWall = toWallClock(sunsetValue)
    const currentWall = typeof explicitNow === 'string' && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(explicitNow.trim())
      ? toWallClock(explicitNow)
      : getWallClock(new Date(now), timeZone)
    if (sunriseWall && sunsetWall && currentWall && sunriseWall.date === sunsetWall.date && currentWall.date === sunriseWall.date) {
      const afterSunrise = currentWall.minutes - sunriseWall.minutes
      const beforeSunset = sunsetWall.minutes - currentWall.minutes
      if ((afterSunrise >= 0 && afterSunrise <= GOLDEN_HOUR_WINDOW_MS / 60_000) || (beforeSunset >= 0 && beforeSunset <= GOLDEN_HOUR_WINDOW_MS / 60_000)) return true
    }
  }

  const sunrise = toTimestamp(sunriseValue)
  const sunset = toTimestamp(sunsetValue)
  if (sunrise == null || sunset == null) return false
  return now != null && isWithinGoldenHour(now, sunrise, sunset)
}

/**
 * Resolve the global atmosphere theme from the centralized WMO condition
 * mapping. Solar context is intentionally conservative: a real timestamp for
 * sunrise, sunset, and the current time is required before using golden-hour.
 */
export function resolveWeatherTheme(code: number | null | undefined, isDay: boolean, context?: WeatherThemeContext): WeatherThemeResult {
  const condition = getWeatherCodeInfo(code, isDay)
  const theme = hasGoldenHourContext(isDay, context) ? 'golden-hour' : condition.theme
  return { theme, condition }
}

export function useWeatherTheme(code: number | null | undefined, isDay: boolean, context?: WeatherThemeContext): WeatherThemeResult {
  const { theme, condition } = resolveWeatherTheme(code, isDay, context)

  useEffect(() => {
    if (typeof document === 'undefined') return

    const root = document.documentElement
    if (!root) return

    const previousTheme = root.dataset.weatherTheme
    root.dataset.weatherTheme = theme
    const shells = Array.from(document.querySelectorAll<HTMLElement>('.app-shell'))
    const previousShellThemes = shells.map(shell => shell.dataset.weatherTheme)
    shells.forEach(shell => { shell.dataset.weatherTheme = theme })

    return () => {
      // Do not remove or overwrite a value written by another owner after
      // this effect ran.
      if (root.dataset.weatherTheme !== theme) return
      if (previousTheme === undefined) delete root.dataset.weatherTheme
      else root.dataset.weatherTheme = previousTheme
      shells.forEach((shell, index) => {
        if (shell.dataset.weatherTheme !== theme) return
        const previousShellTheme = previousShellThemes[index]
        if (previousShellTheme === undefined) delete shell.dataset.weatherTheme
        else shell.dataset.weatherTheme = previousShellTheme
      })
    }
  }, [theme])

  return { theme, condition }
}
