export type WeatherIconType = 'sun' | 'moon' | 'partly-cloudy' | 'cloud' | 'rain' | 'heavy-rain' | 'snow' | 'storm' | 'fog' | 'haze' | 'unknown'
export type AtmosphericTheme = 'clear-day' | 'clear-night' | 'cloudy' | 'rain' | 'heavy-rain' | 'snow' | 'thunderstorm' | 'fog' | 'haze' | 'unknown'
export type WeatherSeverity = 'calm' | 'moderate' | 'severe'
export interface WeatherCodeInfo { label: string; description: string; icon: WeatherIconType; theme: AtmosphericTheme; severity: WeatherSeverity }

const info = (label: string, description: string, icon: WeatherIconType, theme: AtmosphericTheme, severity: WeatherSeverity = 'calm'): WeatherCodeInfo => ({ label, description, icon, theme, severity })
export const WEATHER_CODES: Readonly<Record<number, WeatherCodeInfo>> = {
  0: info('Clear', 'Clear skies', 'sun', 'clear-day'), 1: info('Mainly clear', 'Mostly clear skies', 'partly-cloudy', 'clear-day'),
  2: info('Partly cloudy', 'A mix of sun and cloud', 'partly-cloudy', 'cloudy'), 3: info('Overcast', 'Overcast skies', 'cloud', 'cloudy'),
  45: info('Fog', 'Reduced visibility from fog', 'fog', 'fog', 'moderate'), 48: info('Rime fog', 'Depositing rime fog', 'fog', 'fog', 'moderate'),
  51: info('Light drizzle', 'Light drizzle', 'rain', 'rain'), 53: info('Drizzle', 'Moderate drizzle', 'rain', 'rain'), 55: info('Heavy drizzle', 'Dense drizzle', 'heavy-rain', 'heavy-rain', 'moderate'),
  56: info('Freezing drizzle', 'Light freezing drizzle', 'rain', 'rain', 'moderate'), 57: info('Freezing drizzle', 'Dense freezing drizzle', 'heavy-rain', 'heavy-rain', 'moderate'),
  61: info('Light rain', 'Light rain', 'rain', 'rain'), 63: info('Rain', 'Moderate rain', 'rain', 'rain'), 65: info('Heavy rain', 'Heavy rain', 'heavy-rain', 'heavy-rain', 'moderate'),
  66: info('Freezing rain', 'Light freezing rain', 'rain', 'rain', 'moderate'), 67: info('Freezing rain', 'Heavy freezing rain', 'heavy-rain', 'heavy-rain', 'severe'),
  71: info('Light snow', 'Light snowfall', 'snow', 'snow'), 73: info('Snow', 'Moderate snowfall', 'snow', 'snow'), 75: info('Heavy snow', 'Heavy snowfall', 'snow', 'snow', 'moderate'), 77: info('Snow grains', 'Snow grains', 'snow', 'snow'),
  80: info('Rain showers', 'Light rain showers', 'rain', 'rain'), 81: info('Rain showers', 'Moderate rain showers', 'rain', 'rain'), 82: info('Heavy showers', 'Violent rain showers', 'heavy-rain', 'heavy-rain', 'severe'),
  85: info('Snow showers', 'Light snow showers', 'snow', 'snow'), 86: info('Heavy snow showers', 'Heavy snow showers', 'snow', 'snow', 'moderate'),
  95: info('Thunderstorm', 'Thunderstorm', 'storm', 'thunderstorm', 'severe'), 96: info('Thunderstorm', 'Thunderstorm with hail', 'storm', 'thunderstorm', 'severe'), 99: info('Thunderstorm', 'Thunderstorm with heavy hail', 'storm', 'thunderstorm', 'severe'),
}

export function getWeatherCodeInfo(code: unknown, isDay = true): WeatherCodeInfo {
  const numeric = typeof code === 'number' ? code : NaN
  const result = Number.isFinite(numeric) ? WEATHER_CODES[numeric] : undefined
  if (!result) return info('Unknown conditions', 'Conditions unavailable', 'unknown', 'unknown')
  if (result.theme === 'clear-day' && !isDay) return { ...result, icon: 'moon', theme: 'clear-night', description: numeric === 0 ? 'Clear night skies' : 'Mostly clear night skies' }
  return result
}
