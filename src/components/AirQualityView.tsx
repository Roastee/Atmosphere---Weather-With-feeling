import { Activity, Cloud, Clock3, Database, Droplets, ExternalLink, Factory, Info, Leaf, Sun, Wind } from 'lucide-react'
import { useAirQuality } from '../hooks/useLiveWeather'
import type { Location } from '../types/api'
import { AIR_QUALITY_GUIDANCE_URL, AIR_QUALITY_POLLUTANTS, getAirQualityCategory, getPrimaryPollutant, numericAirQualityValue, type AirQualityPollutantDefinition } from '../lib/airQuality'
import { ForecastStatus } from './dashboard/ForecastStatus'

export default function AirQualityView({ location }: { location: Location }) {
  const { data, error, loading, refresh } = useAirQuality(location)
  const europeanAqi = numericAirQualityValue(data?.current.european_aqi)
  const usAqi = numericAirQualityValue(data?.current.us_aqi)
  const overview = europeanAqi !== null ? { value: europeanAqi, scale: 'european' as const } : usAqi !== null ? { value: usAqi, scale: 'us' as const } : null
  const category = getAirQualityCategory(overview?.value, overview?.scale ?? 'us')
  const primaryPollutant = getPrimaryPollutant(data?.current)
  const timestamp = typeof data?.current.time === 'string' ? data.current.time.replace('T', ' · ').slice(0, 19) : null
  const hasPollutantReading = AIR_QUALITY_POLLUTANTS.some(({ key }) => numericAirQualityValue(data?.current[key]) !== null)

  return <div className="single-view air-quality-view">
    <section className="aq-hero panel">
      <div className="aq-hero-main">
        <span className="overline">{location.name} · live air quality</span>
        <div className="aq-title-row">
          <div><h2>Air quality, in context.</h2><p>Current provider readings for the air around {location.name}.</p></div>
          <span className={`aq-category-pill aq-category-${category.tone}`}><i />{category.label}</span>
        </div>
        <div className="aq-hero-facts"><span>Primary pollutant<strong>{primaryPollutant?.label ?? 'Not available'}</strong></span><span>Index context<strong>{overview ? `${overview.scale === 'european' ? 'European' : 'US'} AQI band` : 'Awaiting an index'}</strong></span></div>
      </div>
      <div className="aq-hero-side">
        <div className="aq-index-grid"><AqiIndexCard label="European AQI" value={europeanAqi} scale="european" /><AqiIndexCard label="US AQI" value={usAqi} scale="us" /></div>
        <ForecastStatus meta={data?.meta} error={error} loading={loading} refresh={refresh} subject="air quality" />
      </div>
    </section>

    <section className="aq-context-grid">
      <div className="aq-guidance panel"><div className="aq-section-kicker"><span className="aq-icon"><Info size={15} /></span><span className="overline">Informational context</span></div><h3>{category.label} on the {overview?.scale === 'european' ? 'European' : 'US'} AQI scale</h3><p>{category.guidance}</p><div className="aq-disclaimer">Informational only — this summarizes public-health index bands and does not provide medical advice.</div><a href={AIR_QUALITY_GUIDANCE_URL} target="_blank" rel="noreferrer">WHO air-pollution overview <ExternalLink size={13} /></a></div>
      <div className="aq-reading-meta panel"><div className="aq-section-kicker"><span className="aq-icon"><Database size={15} /></span><span className="overline">Reading details</span></div><dl><div><dt><Clock3 size={13} />Timestamp</dt><dd>{timestamp ? `${timestamp} · ${data?.timezone || location.timezone}` : 'Not returned'}</dd></div><div><dt><Factory size={13} />Source</dt><dd>{data?.meta.source ? <a href={data.meta.source} target="_blank" rel="noreferrer">Open-Meteo Air Quality API <ExternalLink size={12} /></a> : 'Awaiting provider response'}</dd></div><div><dt><Activity size={13} />Primary pollutant</dt><dd>{primaryPollutant ? `${primaryPollutant.label} · derived from returned readings` : 'Not enough returned pollutant values'}</dd></div></dl></div>
    </section>

    <section className="panel aq-pollutants-panel"><div className="section-header"><div><h2>Pollutant readings</h2><span>Blank cards mean the provider did not return that field for this reading.</span></div><span className="aq-reading-count">{hasPollutantReading ? 'Values available' : 'No values available'}</span></div>{loading && !data ? <div className="aq-empty-state" role="status"><Activity size={18} className="spin" /><div><strong>Loading air quality…</strong><span>Requesting the latest available fields for this location.</span></div></div> : !hasPollutantReading && !loading ? <div className="aq-empty-state"><Cloud size={18} /><div><strong>No current pollutant values returned.</strong><span>The provider response was valid, but no pollutant concentration was available for this time.</span></div></div> : null}<div className="aq-pollutant-grid">{AIR_QUALITY_POLLUTANTS.map(pollutant => <PollutantCard key={pollutant.key} pollutant={pollutant} value={data?.current[pollutant.key]} unit={data?.current_units?.[pollutant.key]} />)}</div></section>
  </div>
}

function AqiIndexCard({ label, value, scale }: { label: string; value: number | null; scale: 'european' | 'us' }) {
  const category = getAirQualityCategory(value, scale)
  return <div className={`aq-index-card aq-category-${category.tone}`}><span>{label}</span><strong>{value === null ? '—' : Math.round(value)}</strong><small>{value === null ? 'Not returned' : category.label}</small></div>
}

function pollutantIcon(pollutant: AirQualityPollutantDefinition) {
  if (pollutant.key === 'uv_index') return <Sun size={17} />
  if (pollutant.key === 'aerosol_optical_depth') return <Activity size={17} />
  if (pollutant.key === 'carbon_monoxide' || pollutant.key === 'nitrogen_dioxide' || pollutant.key === 'sulphur_dioxide') return <Factory size={17} />
  if (pollutant.key === 'ozone') return <Wind size={17} />
  if (pollutant.key === 'dust') return <Leaf size={17} />
  if (pollutant.key === 'pm10') return <Cloud size={17} />
  return <Droplets size={17} />
}

function PollutantCard({ pollutant, value, unit }: { pollutant: AirQualityPollutantDefinition; value: unknown; unit?: string }) {
  const numeric = numericAirQualityValue(value)
  const formatted = numeric === null ? '—' : new Intl.NumberFormat(undefined, { maximumFractionDigits: pollutant.decimals }).format(numeric)
  return <article className={`aq-pollutant-card ${numeric === null ? 'is-missing' : ''}`}><span className="aq-pollutant-icon">{pollutantIcon(pollutant)}</span><div><span className="aq-pollutant-label">{pollutant.label}</span><strong>{formatted}</strong><small>{numeric === null ? 'Not returned' : unit || pollutant.defaultUnit}</small><em>{pollutant.description}</em></div></article>
}
