import { useEffect, useState, type ReactNode } from 'react'
import { AccountScreen } from './components/AccountScreen'
import { AdminScreen } from './components/AdminScreen'
import { AppHeader, VersionFooter } from './components/AppHeader'
import { Card } from './components/Card'
import { ErrorNotice } from './components/ErrorNotice'
import { GeneratorScreen } from './components/GeneratorScreen'
import { HomeScreen } from './components/HomeScreen'
import { HuntOverview } from './components/HuntOverview'
import { HuntPlayer } from './components/HuntPlayer'
import { demoHunt } from './game/demoHunt'
import { GeneratorError, loadHunt, type GeneratedHunt } from './game/generator'
import type { Hunt } from './game/types'
import { useTestMode, type TestMode } from './hooks/useTestMode'
import { canCreate, useAccount } from './lib/account'

/**
 * Ansichten über die Adresse, damit Links teilbar sind:
 *   /                    Start
 *   /?neu                Generator
 *   /?konto              Anmelden bzw. eigenes Konto
 *   /?admin              Gästeliste (nur Admins)
 *   /?jagd=ID            Jagd spielen
 *   /?jagd=ID&leiter     Übersicht für den Spielleiter
 */
type Route =
  | { view: 'home' }
  | { view: 'new' }
  | { view: 'account' }
  | { view: 'admin' }
  | { view: 'hunt'; id: string; leader: boolean }

function parseRoute(): Route {
  const params = new URLSearchParams(window.location.search)
  const id = params.get('jagd')
  if (id) return { view: 'hunt', id, leader: params.has('leiter') }
  if (params.has('neu')) return { view: 'new' }
  if (params.has('konto')) return { view: 'account' }
  if (params.has('admin')) return { view: 'admin' }
  return { view: 'home' }
}

function routeUrl(route: Route): string {
  switch (route.view) {
    case 'home':
      return '/'
    case 'new':
      return '/?neu'
    case 'account':
      return '/?konto'
    case 'admin':
      return '/?admin'
    case 'hunt':
      return `/?jagd=${encodeURIComponent(route.id)}${route.leader ? '&leiter' : ''}`
  }
}

function Shell({ testMode, onAccount, children }: { testMode: TestMode; onAccount?: () => void; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col">
      <AppHeader
        title="Schatzsuche"
        onTitleTap={testMode.registerTap}
        right={
          onAccount && (
            <button onClick={onAccount} aria-label="Konto" className="rounded-full bg-white/15 px-3 py-1 text-lg">
              👤
            </button>
          )
        }
      />
      <main className="safe-bottom flex flex-1 flex-col gap-3 p-3">
        {children}
        <VersionFooter />
      </main>
    </div>
  )
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseRoute)
  const testMode = useTestMode()
  const [account, reloadAccount] = useAccount()

  useEffect(() => {
    const onPop = () => setRoute(parseRoute())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = (next: Route, replace = false) => {
    if (replace) history.replaceState(null, '', routeUrl(next))
    else history.pushState(null, '', routeUrl(next))
    setRoute(next)
    window.scrollTo({ top: 0 })
  }
  const home = () => navigate({ view: 'home' })
  const toAccount = () => navigate({ view: 'account' })

  switch (route.view) {
    case 'home':
      return (
        <Shell testMode={testMode} onAccount={toAccount}>
          <HomeScreen
            account={account}
            onCreate={() => navigate({ view: 'new' })}
            onAccount={toAccount}
            onPlayDemo={() => navigate({ view: 'hunt', id: demoHunt.id, leader: false })}
            onOpenHunt={(id) => navigate({ view: 'hunt', id, leader: true })}
          />
        </Shell>
      )
    case 'new':
      return (
        <Shell testMode={testMode} onAccount={toAccount}>
          {canCreate(account) ? (
            <GeneratorScreen
              onCreated={(id) => {
                reloadAccount()
                navigate({ view: 'hunt', id, leader: true }, true)
              }}
              onCancel={home}
            />
          ) : (
            <HomeScreen
              account={account}
              onCreate={() => undefined}
              onAccount={toAccount}
              onPlayDemo={() => navigate({ view: 'hunt', id: demoHunt.id, leader: false })}
              onOpenHunt={(id) => navigate({ view: 'hunt', id, leader: true })}
            />
          )}
        </Shell>
      )
    case 'account':
      return (
        <Shell testMode={testMode}>
          <AccountScreen
            account={account}
            onReload={reloadAccount}
            onOpenAdmin={() => navigate({ view: 'admin' })}
            onHome={home}
          />
        </Shell>
      )
    case 'admin':
      return (
        <Shell testMode={testMode} onAccount={toAccount}>
          <AdminScreen onBack={toAccount} />
        </Shell>
      )
    case 'hunt':
      return (
        <HuntRoute
          key={route.id}
          id={route.id}
          leader={route.leader}
          testMode={testMode}
          onPlay={() => navigate({ view: 'hunt', id: route.id, leader: false })}
          onExit={home}
        />
      )
  }
}

interface HuntRouteProps {
  id: string
  leader: boolean
  testMode: TestMode
  onPlay: () => void
  onExit: () => void
}

/** Lädt eine erzeugte Jagd aus Firestore (die Demo-Jagd ist eingebaut) */
function HuntRoute({ id, leader, testMode, onPlay, onExit }: HuntRouteProps) {
  const [hunt, setHunt] = useState<Hunt | GeneratedHunt | null>(id === demoHunt.id ? demoHunt : null)
  const [error, setError] = useState<GeneratorError | null>(null)

  useEffect(() => {
    if (id === demoHunt.id) return
    let active = true
    loadHunt(id)
      .then((h) => {
        if (!active) return
        if (h) setHunt(h)
        else setError(new GeneratorError('Diese Jagd gibt es nicht (mehr).', 'Link prüfen oder eine neue Jagd erzeugen.'))
      })
      .catch((e: GeneratorError) => active && setError(e))
    return () => {
      active = false
    }
  }, [id])

  if (!hunt) {
    return (
      <Shell testMode={testMode}>
        {error ? (
          <>
            <ErrorNotice title={error.message} action={error.action} />
            <button onClick={onExit} className="text-sm text-stone-500 underline">
              Zur Übersicht
            </button>
          </>
        ) : (
          <Card>
            <p className="text-stone-500">Jagd wird geladen …</p>
          </Card>
        )}
      </Shell>
    )
  }

  if (leader && 'params' in hunt) {
    return (
      <Shell testMode={testMode}>
        <HuntOverview hunt={hunt} onPlay={onPlay} onBack={onExit} />
      </Shell>
    )
  }

  return <HuntPlayer key={hunt.id} hunt={hunt} testMode={testMode} onExit={onExit} />
}
