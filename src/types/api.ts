export interface Location {
  id: number; name: string; admin1?: string; country: string; country_code: string;
  latitude: number; longitude: number; timezone: string;
}

export interface ForecastRequest {
  latitude: number; longitude: number; timezone?: string; forecastDays?: number;
  temperatureUnit?: 'celsius' | 'fahrenheit'; windSpeedUnit?: 'kmh' | 'ms' | 'mph' | 'kn';
  precipitationUnit?: 'mm' | 'inch'; signal?: AbortSignal; forceRefresh?: boolean;
}
export interface AirQualityRequest { latitude: number; longitude: number; timezone?: string; signal?: AbortSignal; forceRefresh?: boolean; }
export interface ApiMeta { provider: string; source: string; model?: string; updatedAt: number; cached: boolean; stale: boolean; warning?: string; }
export interface ForecastData {
  current: Record<string, number | string | null>;
  hourly: Record<string, (number | null)[] | string[]>;
  daily: Record<string, (number | null)[] | string[]>;
  timezone: string; units: { current: Record<string,string>; hourly: Record<string,string>; daily: Record<string,string> }; meta: ApiMeta;
}
export type AirQualitySeries = Record<string, (number | string | null)[] | string[]>;
/**
 * Air-quality responses are intentionally permissive. Open-Meteo can omit a
 * pollutant when it is unavailable for a location or model run, so consumers
 * should treat every field as optional and render an explicit missing state.
 */
export interface AirQualityData {
  current: Record<string, number | string | null>;
  current_units?: Record<string, string>;
  hourly?: AirQualitySeries;
  hourly_units?: Record<string, string>;
  daily?: AirQualitySeries;
  daily_units?: Record<string, string>;
  timezone: string;
  meta: ApiMeta;
}
/** Backwards-compatible short name used by the existing hooks. */
export type AQ = AirQualityData;
export interface WeatherProvider {
  searchLocations(query: string, signal?: AbortSignal): Promise<Location[]>;
  getForecast(request: ForecastRequest): Promise<ForecastData>;
  getAirQuality(request: AirQualityRequest): Promise<AirQualityData>;
}
