import type { ReactNode } from 'react'

interface Props {
  title: string
  /** Fünfmal schnell tippen schaltet den versteckten Testmodus um */
  onTitleTap: () => void
  /** Knopf oben rechts, z. B. zum Konto */
  right?: ReactNode
  children?: ReactNode
}

export function AppHeader({ title, onTitleTap, right, children }: Props) {
  return (
    <header className="safe-top sticky top-0 z-[1000] bg-brand-700 text-white shadow">
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="select-none text-lg font-bold" onClick={onTitleTap}>
          🗝️ {title}
        </h1>
        {right}
      </div>
      {children}
    </header>
  )
}

export function VersionFooter() {
  return <p className="mt-auto pt-4 text-center text-xs text-stone-400">Version {__APP_VERSION__}</p>
}
