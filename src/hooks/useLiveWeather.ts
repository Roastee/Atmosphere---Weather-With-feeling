import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import openMeteoProvider from '../lib/api'
import type { AQ, ForecastData, Location } from '../types/api'

export type TemperatureUnit = 'celsius' | 'fahrenheit'
export type WindUnit = 'kmh' | 'mph'
export interface UnitPreference { temperature: TemperatureUnit; wind: WindUnit }
export const defaultUnits: UnitPreference = { temperature: 'celsius', wind: 'kmh' }
export const WeatherUnitsContext = createContext<UnitPreference>(defaultUnits)

type WeatherResult = ForecastData | AQ
function useProviderData<T extends WeatherResult>(key: string, load: (signal: AbortSignal, force: boolean) => Promise<T>) {
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null; loading: boolean }>({ key, data: null, error: null, loading: true })
  const sequence = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const request = useCallback(async (force = false) => {
    controller.current?.abort()
    const id = ++sequence.current
    const c = new AbortController()
    controller.current = c
    setState(previous => ({ key, data: previous.key === key ? previous.data : null, error: null, loading: true }))
    try {
      const result = await load(c.signal, force)
      if (id !== sequence.current || c.signal.aborted) return
      setState({ key, data: result, error: null, loading: false })
      window.dispatchEvent(new CustomEvent('atmosphere:data-updated', { detail: { key, meta: result.meta } }))
    } catch (error) {
      if (id !== sequence.current || c.signal.aborted) return
      const message = error instanceof Error ? error.message : 'Unable to load provider data'
      setState(previous => ({ key, data: previous.data ? { ...previous.data, meta: { ...previous.data.meta, stale: true, warning: message } } : null, error: message, loading: false }))
    }
  }, [key, load])
  const cancel = useCallback(() => {
    sequence.current += 1
    controller.current?.abort()
  }, [])
  useEffect(() => {
    const onRefresh = () => { void request(false) }
    window.addEventListener('atmosphere:refresh', onRefresh)
    void request()
    return () => { window.removeEventListener('atmosphere:refresh', onRefresh); cancel() }
  }, [cancel, request])
  const refresh = useCallback(() => request(true), [request])
  return { data: state.key === key ? state.data : null, error: state.key === key ? state.error : null, loading: state.key !== key || state.loading, refresh }
}

export function useLiveWeather(location: Location, days = 7) {
  const units = useContext(WeatherUnitsContext)
  const { latitude, longitude, timezone } = location
  const key = `forecast:${latitude}:${longitude}:${timezone}:${days}:${units.temperature}:${units.wind}`
  const load = useCallback((signal: AbortSignal, forceRefresh: boolean) => openMeteoProvider.getForecast({ latitude, longitude, timezone, forecastDays: days, temperatureUnit: units.temperature, windSpeedUnit: units.wind, signal, forceRefresh }), [latitude, longitude, timezone, days, units.temperature, units.wind])
  const { data: forecast, ...rest } = useProviderData(key, load)
  return { forecast, ...rest }
}

export function useAirQuality(location: Location) {
  const { latitude, longitude, timezone } = location
  const key = `air:${latitude}:${longitude}:${timezone}`
  const load = useCallback((signal: AbortSignal, forceRefresh: boolean) => openMeteoProvider.getAirQuality({ latitude, longitude, timezone, signal, forceRefresh }), [latitude, longitude, timezone])
  return useProviderData(key, load)
}
