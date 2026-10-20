import { Droplets, Eye, MapPin, Sun, Sunrise, Sunset, Umbrella, Wind } from 'lucide-react'
import type { ForecastData, Location } from '../../types/api'
import { useWeatherTheme } from '../../hooks/useWeatherTheme'
import { MetricCard } from './MetricCard'
import { WeatherIcon } from './WeatherIcon'
import { currentHourIndex, direction, formatValue, numeric, reading, series, todayIndex, wallTime } from './weatherData'

export function HeroWeather({ location, data, loading }: { location: Location; data: ForecastData | null; loading: boolean }) {
  const c = data?.current
  const isDay = numeric(reading(c, 'is_day')) !== 0
  const hour = data ? currentHourIndex(data) : -1
  const today = data ? todayIndex(data) : -1
  const daily = (key: string) => series(data?.daily, key)[today]
  const hourly = (key: string) => series(data?.hourly, key)[hour]
  const temperatureUnit = data?.units.current.temperature_2m || '°C'
  const timezone = data?.timezone || location.timezone
  const sunrise = daily('sunrise')
  const sunset = daily('sunset')
  const currentTime = reading(c, 'time') ?? hourly('time')
  const { condition } = useWeatherTheme(numeric(reading(c, 'weather_code', 'weathercode')), isDay, { timeZone: timezone, sunrise: typeof sunrise === 'string' ? sunrise : null, sunset: typeof sunset === 'string' ? sunset : null, now: typeof currentTime === 'string' ? currentTime : null })
  return <section className={`hero-weather panel hero-theme-${condition.theme}`} aria-label="Current weather" aria-busy={loading}>
    <div className="atmosphere-layer atmosphere-layer-one" aria-hidden="true" /><div className="atmosphere-layer atmosphere-layer-two" aria-hidden="true" />
    <div className="hero-copy">
      <div className="location-line"><MapPin size={15} /><span>{location.name}, {location.admin1 || location.country}</span></div>
      <div className="hero-temp-row"><div><div className="hero-temp">{formatValue(reading(c, 'temperature_2m', 'temperature'))}<sup>{temperatureUnit}</sup></div><p>{data ? condition.description : loading ? 'Reading the atmosphere…' : 'Conditions unavailable'}</p><span className="hero-feels">Feels like {formatValue(reading(c, 'apparent_temperature', 'feels_like'), temperatureUnit)}</span></div><div className="hero-icon"><WeatherIcon condition={condition} size={100} isDay={reading(c, 'is_day') !== 0} /></div></div>
      <div className="temp-range"><span>High {formatValue(daily('temperature_2m_max'), '°')} · Low {formatValue(daily('temperature_2m_min'), '°')}</span><span><Umbrella size={14} /> Today’s precipitation chance {formatValue(daily('precipitation_probability_max'), '%')}</span></div>
    </div>
    <div className="hero-metrics">
      <MetricCard icon={<Wind />} label="Wind · direction" value={`${formatValue(reading(c, 'wind_speed_10m'), ` ${data?.units.current.wind_speed_10m || 'km/h'}`)} · ${direction(reading(c, 'wind_direction_10m'))}`} />
      <MetricCard icon={<Droplets />} label="Humidity" value={formatValue(reading(c, 'relative_humidity_2m'), '%')} />
      <MetricCard icon={<Eye />} label="Visibility · current hour" value={formatValue(reading(c, 'visibility') ?? hourly('visibility'), ` ${data?.units.hourly.visibility || 'm'}`)} />
      <MetricCard icon={<Sun />} label="UV index · current hour" value={formatValue(reading(c, 'uv_index') ?? hourly('uv_index'), '', 1)} />
    </div>
    <div className="hero-footer"><span><Sunrise size={14} /> Sunrise <strong>{wallTime(daily('sunrise'), timezone)}</strong></span><span><Sunset size={14} /> Sunset <strong>{wallTime(daily('sunset'), timezone)}</strong></span><span>{timezone}</span></div>
  </section>
}
