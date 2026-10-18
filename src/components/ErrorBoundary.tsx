import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logError } from '../lib/errorLog'

interface State {
  error: Error | null
}

/** Statt eines leeren (schwarzen) Bildschirms: Hinweis zeigen und Neuladen anbieten – der Spielstand bleibt erhalten */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError(`${error.message}\n${info.componentStack?.split('\n').slice(0, 4).join('\n') ?? ''}`)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-4xl">🧭</p>
        <p className="text-lg font-semibold">Da ist etwas schiefgelaufen.</p>
        <p className="text-sm text-stone-500">Euer Fortschritt ist gespeichert.</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white active:bg-brand-700"
        >
          Weiterspielen
        </button>
        <p className="max-w-sm break-words font-mono text-xs text-stone-400">{this.state.error.message}</p>
      </div>
    )
  }
}
