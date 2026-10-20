import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'

type Tone = 'success' | 'info' | 'warning'
type Notice = { id: number; message: string; tone: Tone }
const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {})

export function useToast() { return useContext(ToastContext) }

/** One dismissible message, not an accumulating wall of notifications. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null)
  const sequence = useRef(0)
  const notify = (message: string, tone: Tone = 'info') => setNotice({ id: ++sequence.current, message, tone })
  const Icon = notice?.tone === 'success' ? CheckCircle2 : notice?.tone === 'warning' ? TriangleAlert : Info
  return <ToastContext.Provider value={notify}>
    {children}
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      {notice && <div key={notice.id} className={`app-toast toast-${notice.tone}`}>
        <Icon size={20} aria-hidden="true" />
        <p>{notice.message}</p>
        <button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={18} /></button>
      </div>}
    </div>
  </ToastContext.Provider>
}

export function LoadingSkeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return <div className="loading-skeleton" aria-label={label} role="status">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true">{Array.from({ length: rows }, (_, i) => <i className="skeleton-block" key={i} />)}</div>
  </div>
}
