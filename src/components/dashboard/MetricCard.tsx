import type { ReactNode } from 'react'

export function MetricCard({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note?: string }) {
  return <div className="metric"><span className="metric-icon" aria-hidden="true">{icon}</span><div><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div></div>
}
