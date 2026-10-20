import { useId, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { getWeatherCodeInfo } from '../../lib/weatherCodes'
import type { ForecastData } from '../../types/api'
import { WeatherIcon } from './WeatherIcon'
import { formatValue, localStamp, numeric, series, wallTime } from './weatherData'

export function HourlyForecast({ data, loading }: { data: ForecastData | null; loading: boolean }) {
  const [apparent, setApparent] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const detailId = useId()
  if (!data) return <p className="loading-state" role="status">{loading ? 'Loading hourly forecast…' : 'Hourly forecast unavailable. Use refresh to retry.'}</p>
  const h = data.hourly
  const nowHour = localStamp(data.timezone).slice(0, 13)
  const rows = series(h, 'time').map((time, index) => ({ time, index })).filter((row): row is { time: string; index: number } => typeof row.time === 'string' && row.time.slice(0, 13) >= nowHour).slice(0, 24)
  if (!rows.length) return <p className="loading-state">No upcoming hourly readings were returned.</p>
  const key = apparent ? 'apparent_temperature' : 'temperature_2m'
  const unit = data.units.hourly[key] || '°C'
  const temps = rows.map(({ index }) => numeric(series(h, key)[index]))
  const valid = temps.filter((v): v is number => v !== null)
  const low = valid.length ? Math.min(...valid) - 2 : 0
  const high = valid.length ? Math.max(...valid) + 2 : 1
  const x = (index: number) => 22 + index * 48
  const y = (temp: number) => 95 - (temp - low) / (high - low) * 70
  const width = rows.length * 48
  let path = ''; let gap = true
  temps.forEach((temp, index) => { if (temp === null) { gap = true; return }; path += `${gap ? 'M' : 'L'}${x(index)},${y(temp)} `; gap = false })
  const precipitation = rows.map(({ index }) => numeric(series(h, 'precipitation')[index]))
  const maxRain = Math.max(1, ...precipitation.filter((v): v is number => v !== null))
  const active = rows.find(row => row.time === selected) || rows[0]
  const weather = (index: number) => getWeatherCodeInfo(series(h, 'weather_code')[index], series(h, 'is_day')[index] !== 0)
  return <div className="hourly-wrap">
    <div className="hourly-controls"><span>{rows.length} hours · destination local time</span><div className="segmented" role="group" aria-label="Chart temperature"><button aria-pressed={!apparent} className={!apparent ? 'selected' : ''} onClick={() => setApparent(false)}>Temperature</button><button aria-pressed={apparent} className={apparent ? 'selected' : ''} onClick={() => setApparent(true)}>Feels like</button></div></div>
    <div className="forecast-hour-scroll" tabIndex={0} role="region" aria-label="Scrollable hourly forecast; select an hour for details">
      <div className="forecast-hour-track" style={{ minWidth: `${width}px` }}>
        <svg className="forecast-chart" viewBox={`0 0 ${width} 130`} preserveAspectRatio="none" role="img" aria-label={`${apparent ? 'Feels-like' : 'Temperature'} line in ${unit}; precipitation amount bars. Exact readings are in the hourly table below.`}>
          <line x1="0" y1="110" x2={width} y2="110" className="chart-baseline" />
          {precipitation.map((rain, i) => rain !== null && <rect key={i} x={x(i) - 8} y={110 - rain / maxRain * 35} width="16" height={rain / maxRain * 35} rx="3" className="chart-rain" />)}
          <path d={path} className="chart-temperature" />
          {temps.map((temp, i) => temp !== null && <circle key={i} cx={x(i)} cy={y(temp)} r="3" className="chart-point" />)}
        </svg>
        <div className="forecast-hour-items" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(48px, 1fr))` }}>{rows.map(({ time, index }) => {
          const condition = weather(index); const day = series(h, 'is_day')[index]
          return <button key={time} className={`forecast-hour ${active.time === time ? 'is-selected' : ''}`} aria-pressed={active.time === time} aria-describedby={detailId} aria-label={`${time.replace('T', ' ')}, ${condition.label}, ${formatValue(series(h, key)[index], unit)}`} onClick={() => setSelected(time)}>
            <span>{wallTime(time, data.timezone, true)}</span><WeatherIcon condition={condition} isDay={day !== 0} /><strong>{formatValue(series(h, key)[index], '°')}</strong><small>{formatValue(series(h, 'precipitation')[index], data.units.hourly.precipitation || 'mm', 1)}</small><span className="day-marker">{day === 0 ? <Moon size={11} /> : day === 1 ? <Sun size={11} /> : null}<span className="sr-only">{day === 0 ? 'Night' : day === 1 ? 'Day' : 'Daylight unavailable'}</span></span>
          </button>
        })}</div>
      </div>
    </div>
    <p id={detailId} className="hour-detail" role="status">{active.time.slice(0, 10)} · {wallTime(active.time, data.timezone)} · {weather(active.index).description} · Feels like {formatValue(series(h, 'apparent_temperature')[active.index], unit)} · Precipitation {formatValue(series(h, 'precipitation')[active.index], ` ${data.units.hourly.precipitation || 'mm'}`, 1)} · Chance {formatValue(series(h, 'precipitation_probability')[active.index], '%')}</p>
    <details className="forecast-alt"><summary>View hourly readings as a table</summary><div className="table-scroll" tabIndex={0}><table aria-label={`Next ${rows.length} hours of weather in ${data.timezone}`}><thead><tr><th scope="col">Local time</th><th scope="col">Conditions</th><th scope="col">Temperature</th><th scope="col">Feels like</th><th scope="col">Precipitation</th><th scope="col">Chance</th><th scope="col">Day / night</th></tr></thead><tbody>{rows.map(({ time, index }) => <tr key={time}><th scope="row">{time.replace('T', ' ')}</th><td>{weather(index).label}</td><td>{formatValue(series(h, 'temperature_2m')[index], data.units.hourly.temperature_2m || '°C')}</td><td>{formatValue(series(h, 'apparent_temperature')[index], data.units.hourly.apparent_temperature || '°C')}</td><td>{formatValue(series(h, 'precipitation')[index], data.units.hourly.precipitation || 'mm', 1)}</td><td>{formatValue(series(h, 'precipitation_probability')[index], '%')}</td><td>{series(h, 'is_day')[index] === 0 ? 'Night' : series(h, 'is_day')[index] === 1 ? 'Day' : '—'}</td></tr>)}</tbody></table></div></details>
  </div>
}
