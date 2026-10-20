import { RefreshCw } from 'lucide-react'
import type { ApiMeta, ForecastData } from '../../types/api'
import { numeric, series } from './weatherData'

export function ForecastStatus({ meta, error, loading, refresh, subject = 'weather' }: { meta?: ApiMeta; error: string | null; loading: boolean; refresh: () => void; subject?: string }) {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  const state = offline ? 'Offline' : meta?.stale ? 'Stale cache' : loading ? 'Updating' : error ? 'Update failed' : meta?.cached ? 'Cached' : meta ? 'Live response' : 'Unavailable'
  return <div className="live-status" role="status" aria-label={`${subject} data status`}><span className={meta?.stale || error || offline ? 'stale' : 'online'}>{state}</span><button className="refresh-button" onClick={refresh} disabled={loading} aria-label={`Refresh ${subject} data`}><RefreshCw size={15} className={loading ? 'spin' : ''} />{loading ? 'Updating' : 'Refresh'}</button>{error && <span className="status-error">{error}. {meta ? 'Last available readings are shown.' : 'Please retry.'}</span>}{meta?.warning && <span className="status-warning">{meta.warning}</span>}</div>
}

export function ForecastTransparency({ data, error, loading, refresh }: { data: ForecastData | null; error: string | null; loading: boolean; refresh: () => void }) {
  const horizon = series(data?.daily, 'time').length
  const temperatures = series(data?.hourly, 'temperature_2m')
  const incomplete = !temperatures.length || temperatures.some(value => numeric(value) === null) || !horizon
  const updated = data?.meta.updatedAt
  const age = typeof updated === 'number' && Number.isFinite(updated) ? Math.max(0, Math.floor((Date.now() - updated) / 60_000)) : null
  const freshness = data?.meta.stale ? 'Stale cache' : data?.meta.cached ? 'Cached response' : data ? 'Latest fetched response' : 'Awaiting data'
  return <section className="insight-card panel forecast-transparency" aria-label="Forecast transparency">
    <span className="overline">Behind the forecast</span><h3>A little perspective.<br />A clearer outlook.</h3>
    <dl className="transparency-facts"><div><dt>Provider</dt><dd>{data?.meta.provider || '—'}</dd></div><div><dt>Model</dt><dd>{data?.meta.model || 'Not supplied by provider'}</dd></div><div><dt>Returned horizon</dt><dd>{horizon ? `${horizon} days` : '—'}</dd></div><div><dt>Last fetched</dt><dd>{age === null ? '—' : `${age < 1 ? 'Just now' : `${age} min ago`}`}</dd></div><div><dt>Freshness</dt><dd>{freshness}</dd></div></dl>
    {age !== null && <p className="fetch-time">{new Date(updated!).toLocaleString()} · your local time. Fetch time is not the model’s run time.</p>}
    <div className="confidence-explainer"><strong>{!data ? 'Awaiting an outlook' : incomplete || data.meta.stale ? 'Interpret with care' : 'Best used near-term'}</strong><p>{!data ? 'Confidence context will appear when the provider responds.' : `${incomplete ? 'Some forecast fields are missing. ' : ''}${data.meta.stale ? 'Cached readings may no longer reflect the latest forecast. ' : ''}Near-term detail is generally more useful for planning. ${horizon > 7 ? 'Beyond a week, use the trend rather than precise timing or amounts. ' : ''}This is qualitative guidance, not a calibrated probability or an official warning.`}</p></div>
    <ForecastStatus meta={data?.meta} error={error} loading={loading} refresh={refresh} />
  </section>
}
