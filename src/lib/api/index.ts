import type { WeatherProvider } from '../../types/api';
import { AirQualityApiClient, GeocodingApiClient, WeatherApiClient } from './clients';
export * from './errors'; export * from './retry'; export * from './cache'; export * from './clients';
export * from '../../types/api';
export const openMeteoProvider: WeatherProvider = (() => { const forecast = new WeatherApiClient(); const air = new AirQualityApiClient(); const geo = new GeocodingApiClient(); return { searchLocations: (q, signal) => geo.search(q, signal), getForecast: r => forecast.getForecast(r), getAirQuality: r => air.getAirQuality(r) }; })();
export default openMeteoProvider;
