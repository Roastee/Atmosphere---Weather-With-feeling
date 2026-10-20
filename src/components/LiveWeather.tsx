import { Cloud, Droplets, Gauge, Wind } from 'lucide-react'
import { useLiveWeather } from '../hooks/useLiveWeather'
import { useWeatherTheme } from '../hooks/useWeatherTheme'
import type { ForecastData, Location } from '../types/api'
import { DailyForecast } from './dashboard/DailyForecast'
import { ForecastStatus, ForecastTransparency } from './dashboard/ForecastStatus'
import { HeroWeather } from './dashboard/HeroWeather'
import { HourlyForecast } from './dashboard/HourlyForecast'
import { MetricCard } from './dashboard/MetricCard'
import { formatValue, numeric, reading, series, todayIndex } from './dashboard/weatherData'
import { lazy, Suspense } from 'react'

const AdvancedWeatherInsights = lazy(() => import('./dashboard/AdvancedWeatherInsights').then(module => ({ default: module.AdvancedWeatherInsights })))

function InsightsFallback() {
  return <section className="panel insight-panel" aria-label="Loading advanced weather insights" role="status"><div className="section-header"><div><span className="overline">Optional analysis</span><h2>Advanced weather insights</h2></div></div><p className="loading-state">Loading detailed charts…</p></section>
}

function WeatherThemeSync({ data }: { data: ForecastData | null }) {
  const today = data ? todayIndex(data) : -1
  const sunrise = today >= 0 ? series(data?.daily, 'sunrise')[today] : null
  const sunset = today >= 0 ? series(data?.daily, 'sunset')[today] : null
  const now = reading(data?.current, 'time')
  useWeatherTheme(numeric(reading(data?.current, 'weather_code', 'weathercode')), numeric(reading(data?.current, 'is_day')) !== 0, {
    timeZone: data?.timezone,
    sunrise: typeof sunrise === 'string' ? sunrise : null,
    sunset: typeof sunset === 'string' ? sunset : null,
    now: typeof now === 'string' ? now : null,
  })
  return null
}

function Conditions({ data }: { data: ForecastData | null }) {
  const units = data?.units.current
  return <section className="panel details-panel"><div className="section-header"><div><h2>A closer look</h2><span>Current provider readings · missing values shown as —</span></div></div><div className="metric-grid">
    <MetricCard icon={<Gauge />} label="Surface pressure" value={formatValue(reading(data?.current, 'surface_pressure'), ` ${units?.surface_pressure || 'hPa'}`)} />
    <MetricCard icon={<Wind />} label="Wind gusts" value={formatValue(reading(data?.current, 'wind_gusts_10m'), ` ${units?.wind_gusts_10m || 'km/h'}`)} />
    <MetricCard icon={<Cloud />} label="Cloud cover" value={formatValue(reading(data?.current, 'cloud_cover'), '%')} />
    <MetricCard icon={<Droplets />} label="Precipitation" value={formatValue(reading(data?.current, 'precipitation'), ` ${units?.precipitation || 'mm'}`, 1)} />
  </div></section>
}

export function Dashboard({ location, onNavigate }: { location: Location; onNavigate: (view: 'Forecast') => void }) {
  const { forecast, error, loading, refresh } = useLiveWeather(location, 16)
  return <div className="dashboard-grid weather-dashboard">
    <HeroWeather location={location} data={forecast} loading={loading} />
    <ForecastTransparency data={forecast} error={error} loading={loading} refresh={refresh} />
    <section className="panel hourly-panel"><div className="section-header"><div><h2>The next 24 hours</h2><span>{forecast?.timezone || location.timezone} · temperature & precipitation</span></div><button className="text-button" onClick={() => onNavigate('Forecast')}>Full outlook →</button></div><HourlyForecast data={forecast} loading={loading} /></section>
    <section className="panel week-panel"><div className="section-header"><div><h2>The days ahead</h2><span>10-day outlook · reveal up to 16 days</span></div></div><DailyForecast data={forecast} loading={loading} /></section>
     <Conditions data={forecast} />
      <Suspense fallback={<InsightsFallback />}><AdvancedWeatherInsights data={forecast} loading={loading} /></Suspense>
  </div>
}

export function ForecastView({ location }: { location: Location }) {
  const { forecast, error, loading, refresh } = useLiveWeather(location, 16)
  return <div className="single-view extended-forecast"><WeatherThemeSync data={forecast} /><section className="panel forecast-banner"><div><span className="overline">Extended outlook · provider data</span><h2>Plan around the weather.</h2><p>{location.name} · up to 16 days</p></div><ForecastStatus meta={forecast?.meta} error={error} loading={loading} refresh={refresh} /></section>
    <section className="panel hourly-panel"><div className="section-header"><div><h2>Hour by hour</h2><span>{forecast?.timezone || location.timezone}</span></div></div><HourlyForecast data={forecast} loading={loading} /></section>
    <section className="panel week-panel"><div className="section-header"><div><h2>Daily forecast</h2><span>Select a day to see precipitation and wind details</span></div></div><DailyForecast data={forecast} loading={loading} /></section>
     <ForecastTransparency data={forecast} error={error} loading={loading} refresh={refresh} />
      <Suspense fallback={<InsightsFallback />}><AdvancedWeatherInsights data={forecast} loading={loading} /></Suspense>
  </div>
}
