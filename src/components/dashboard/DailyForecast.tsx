import { useState } from 'react'
import { ChevronDown, Droplets } from 'lucide-react'
import { getWeatherCodeInfo } from '../../lib/weatherCodes'
import type { ForecastData } from '../../types/api'
import { WeatherIcon } from './WeatherIcon'
import { dayLabel, direction, formatValue, series } from './weatherData'

export function DailyForecast({ data, loading }: { data: ForecastData | null; loading: boolean }) {
  const [expanded, setExpanded] = useState(false)
  if (!data) return <p className="loading-state" role="status">{loading ? 'Loading daily outlook…' : 'Daily outlook unavailable. Use refresh to retry.'}</p>
  const times = series(data.daily, 'time').slice(0, 16)
  if (!times.length) return <p className="loading-state">No daily readings were returned.</p>
  return <div className="daily-outlook">{times.slice(0, expanded ? 16 : 10).map((time, index) => {
    const get = (key: string) => series(data.daily, key)[index]
    const condition = getWeatherCodeInfo(get('weather_code'))
    const high = formatValue(get('temperature_2m_max'), data.units.daily.temperature_2m_max || '°C')
    const low = formatValue(get('temperature_2m_min'), data.units.daily.temperature_2m_min || '°C')
    return <details className="daily-detail" key={String(time)}><summary className="daily-summary" aria-label={`${String(time)}, ${condition.label}, high ${high}, low ${low}. Expand for details.`}>
      <span className="day-name"><strong>{dayLabel(time, data.timezone)}</strong><small>{typeof time === 'string' ? time.slice(5, 10) : '—'}</small></span><WeatherIcon condition={condition} /><span className="daily-condition">{condition.label}</span><span className="rain-chance"><Droplets size={12} />{formatValue(get('precipitation_probability_max'), '%')}</span><span className="daily-range"><strong>{formatValue(get('temperature_2m_max'), '°')}</strong><span>{formatValue(get('temperature_2m_min'), '°')}</span></span><ChevronDown size={14} className="daily-chevron" />
    </summary><dl className="day-expanded"><div><dt>Conditions</dt><dd>{condition.description}</dd></div><div><dt>High / low</dt><dd>{high} / {low}</dd></div><div><dt>Precipitation chance</dt><dd>{formatValue(get('precipitation_probability_max'), '%')}</dd></div><div><dt>Precipitation amount</dt><dd>{formatValue(get('precipitation_sum'), ` ${data.units.daily.precipitation_sum || 'mm'}`, 1)}</dd></div><div><dt>Maximum wind</dt><dd>{formatValue(get('wind_speed_10m_max'), ` ${data.units.daily.wind_speed_10m_max || 'km/h'}`)}</dd></div><div><dt>Wind direction</dt><dd>{direction(get('wind_direction_10m_dominant'))}</dd></div></dl></details>
  })}{times.length > 10 && <button className="text-button reveal-button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show 10 days' : `Reveal ${times.length}-day outlook`} <ChevronDown size={14} /></button>}<p className="forecast-footnote">High / low · precipitation chance · select a day for details.</p></div>
}
