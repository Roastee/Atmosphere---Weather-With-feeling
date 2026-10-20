export type WeatherIcon = 'sun' | 'partly' | 'cloud' | 'rain' | 'storm' | 'moon'

export type ForecastDay = {
  day: string
  date: string
  icon: WeatherIcon
  condition: string
  high: number
  low: number
  rain: number
}

export type HourlyPoint = {
  time: string
  temp: number
  rain: number
  icon: WeatherIcon
}

export type SavedLocation = {
  name: string
  country: string
  temp: number
  condition: string
  icon: WeatherIcon
  high: number
  low: number
}
