import type { ReactNode } from 'react'

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-stone-900">
      {title && <h2 className="mb-2 text-lg font-semibold text-brand-700 dark:text-brand-500">{title}</h2>}
      {children}
    </section>
  )
}

export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white active:bg-brand-700 disabled:opacity-40"
    >
      {children}
    </button>
  )
}
