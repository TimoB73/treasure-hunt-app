import type { ReactNode } from 'react'

/** Fehlermeldung mit Handlungsanweisung („Was ist zu tun?“) und optionalen Knöpfen */
export function ErrorNotice({ title, action, children }: { title: string; action?: string; children?: ReactNode }) {
  return (
    <section
      role="alert"
      className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100"
    >
      <p className="font-semibold">⚠️ {title}</p>
      {action && (
        <p className="mt-2 text-sm">
          <span className="font-medium">Was tun? </span>
          {action}
        </p>
      )}
      {children && <div className="mt-3 grid gap-2">{children}</div>}
    </section>
  )
}
