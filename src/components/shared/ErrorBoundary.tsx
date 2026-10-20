import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logger } from '../../lib/logger'

type Props = { children: ReactNode; fallback?: ReactNode }
type State = { hasError: boolean }

/** Last-resort UI boundary so a broken optional panel cannot blank the app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, _info: ErrorInfo) {
    void _info
    // Do not send componentStack, error.message, or the original error object
    // to a remote service. The logger deliberately keeps only safe metadata.
    logger.error('ui_render_error', error, { feature: 'rendering' })
  }

  private reload = () => {
    if (typeof window !== 'undefined') window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback !== undefined) return this.props.fallback
    return <main className="app-error-boundary" role="alert"><section className="panel"><span className="overline">Atmosphere paused</span><h1>Something went wrong.</h1><p className="muted">The weather workspace could not render this view. Your saved locations remain on this device.</p><button className="primary-button" type="button" onClick={this.reload}>Reload workspace</button></section></main>
  }
}
