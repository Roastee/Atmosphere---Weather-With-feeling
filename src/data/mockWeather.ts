import type { ForecastDay, HourlyPoint, SavedLocation } from '../types/weather'

export const currentWeather = {
  location: 'Bengaluru',
  country: 'India',
  temp: 24,
  feelsLike: 25,
  condition: 'Partly cloudy',
  high: 28,
  low: 19,
  humidity: 68,
  wind: 12,
  visibility: 9.4,
  pressure: 1012,
  uv: 5,
  sunrise: '06:12',
  sunset: '18:08',
}

export const hourlyForecast: HourlyPoint[] = [
  { time: 'Now', temp: 24, rain: 12, icon: 'partly' },
  { time: '11 AM', temp: 25, rain: 10, icon: 'partly' },
  { time: '12 PM', temp: 26, rain: 18, icon: 'sun' },
  { time: '1 PM', temp: 27, rain: 21, icon: 'sun' },
  { time: '2 PM', temp: 28, rain: 32, icon: 'cloud' },
  { time: '3 PM', temp: 27, rain: 46, icon: 'rain' },
  { time: '4 PM', temp: 26, rain: 54, icon: 'rain' },
  { time: '5 PM', temp: 24, rain: 37, icon: 'cloud' },
  { time: '6 PM', temp: 23, rain: 28, icon: 'partly' },
]

export const weekForecast: ForecastDay[] = [
  { day: 'Today', date: 'Oct 13', icon: 'partly', condition: 'Partly cloudy', high: 28, low: 19, rain: 32 },
  { day: 'Wed', date: 'Oct 14', icon: 'rain', condition: 'Light rain', high: 26, low: 19, rain: 61 },
  { day: 'Thu', date: 'Oct 15', icon: 'storm', condition: 'Scattered storms', high: 25, low: 18, rain: 74 },
  { day: 'Fri', date: 'Oct 16', icon: 'cloud', condition: 'Mostly cloudy', high: 26, low: 18, rain: 28 },
  { day: 'Sat', date: 'Oct 17', icon: 'sun', condition: 'Clear skies', high: 28, low: 18, rain: 12 },
  { day: 'Sun', date: 'Oct 18', icon: 'sun', condition: 'Sunny', high: 29, low: 19, rain: 8 },
  { day: 'Mon', date: 'Oct 19', icon: 'partly', condition: 'Partly cloudy', high: 28, low: 20, rain: 19 },
]

export const savedLocations: SavedLocation[] = [
  { name: 'London', country: 'United Kingdom', temp: 14, condition: 'Overcast', icon: 'cloud', high: 16, low: 11 },
  { name: 'Tokyo', country: 'Japan', temp: 21, condition: 'Clear skies', icon: 'sun', high: 23, low: 17 },
  { name: 'San Francisco', country: 'United States', temp: 17, condition: 'Foggy', icon: 'cloud', high: 19, low: 13 },
]
