import { CircleHelp, Cloud, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudRainWind, CloudSnow, CloudSun, Moon, Sun } from 'lucide-react'
import { getWeatherCodeInfo, type WeatherCodeInfo } from '../../lib/weatherCodes'

export function WeatherIcon({ code, isDay = true, size = 24, condition }: { code?: unknown; isDay?: boolean; size?: number; condition?: WeatherCodeInfo }) {
  const weather = condition || getWeatherCodeInfo(code, isDay)
  const icons = { sun: Sun, moon: Moon, 'partly-cloudy': isDay ? CloudSun : CloudMoon, cloud: Cloud, rain: CloudRain, 'heavy-rain': CloudRainWind, snow: CloudSnow, storm: CloudLightning, fog: CloudFog, haze: CloudFog, unknown: CircleHelp }
  const Icon = icons[weather.icon]
  return <Icon size={size} aria-hidden="true" className={`weather-icon weather-icon-${weather.icon}`} />
}
