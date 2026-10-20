import { AirVent, Bookmark, CalendarDays, LayoutDashboard, Map, Settings, ShieldCheck, Sun, X } from 'lucide-react'
import { Modal } from '../components/shared/Modal'

export type View = 'Dashboard' | 'Forecast' | 'Maps' | 'Air Quality' | 'Saved Locations' | 'Settings'
const items = [
  { label: 'Dashboard', icon: LayoutDashboard }, { label: 'Forecast', icon: CalendarDays },
  { label: 'Maps', icon: Map }, { label: 'Air Quality', icon: AirVent },
  { label: 'Saved Locations', icon: Bookmark }, { label: 'Settings', icon: Settings },
] as const

export function Navigation({ compact, open, onClose, view, onNavigate }: {
  compact: boolean; open: boolean; onClose: () => void; view: View; onNavigate: (view: View) => void
}) {
  const content = <>
    <div className="brand"><span className="brand-mark"><Sun size={20} aria-hidden="true" /></span><span id="navigation-title">atmosphere</span>
      {compact && <button className="icon-button" aria-label="Close navigation" onClick={onClose}><X size={20} /></button>}
    </div>
    <div className="sidebar-label">Weather workspace</div>
    <nav className="nav-list" aria-label="Primary navigation">{items.map(({ label, icon: Icon }) =>
      <button className={`nav-item ${view === label ? 'active' : ''}`} key={label} aria-current={view === label ? 'page' : undefined}
        onClick={() => { onNavigate(label); onClose() }}><Icon size={19} aria-hidden="true" /><span>{label}</span></button>)}</nav>
    <div className="sidebar-spacer" />
    <div className="sidebar-card"><ShieldCheck size={20} aria-hidden="true" /><div><strong>On your terms.</strong><p>Locations saved on this device.</p></div></div>
    <p className="sidebar-source">Weather by Open-Meteo</p>
  </>
  return compact
    ? <Modal id="navigation-drawer" open={open} onClose={onClose} titleId="navigation-title" className="navigation-dialog">{content}</Modal>
    : <aside className="sidebar">{content}</aside>
}

export function BottomNavigation({ view, onNavigate }: { view: View; onNavigate: (view: View) => void }) {
  return <nav className="bottom-nav" aria-label="Quick navigation">{items.slice(0, 4).map(({ label, icon: Icon }) =>
    <button key={label} aria-current={view === label ? 'page' : undefined} className={view === label ? 'active' : ''} onClick={() => onNavigate(label)}>
      <Icon size={20} aria-hidden="true" /><span>{label === 'Air Quality' ? 'Air quality' : label}</span>
    </button>)}</nav>
}
