import { useState, type FormEvent } from 'react'
import { checkAnswer } from '../lib/answer'
import type { Riddle } from '../game/types'
import { Card, PrimaryButton } from './Card'

interface Props {
  riddle: Riddle
  hintsUsed: number
  onSolved: () => void
  onWrong: () => void
  onHint: () => void
}

export function RiddleCard({ riddle, hintsUsed, onSolved, onWrong, onHint }: Props) {
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<'wrong' | null>(null)
  const { answer } = riddle

  const submit = (value: string) => {
    if (checkAnswer(answer, value)) {
      onSolved()
    } else {
      setFeedback('wrong')
      onWrong()
      navigator.vibrate?.([60, 60, 60])
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (input.trim()) submit(input)
  }

  return (
    <Card title="Rätsel">
      <p className="text-lg leading-snug">{riddle.question}</p>

      {answer.type === 'choice' ? (
        <div className="mt-4 grid gap-2">
          {answer.options.map((option, i) => (
            <button
              key={option}
              onClick={() => submit(String(i))}
              className="rounded-xl border border-stone-300 px-4 py-3 text-left active:bg-brand-50 dark:border-stone-700 dark:active:bg-stone-800"
            >
              {option}
            </button>
          ))}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 grid gap-2">
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setFeedback(null)
            }}
            inputMode={answer.type === 'number' ? 'decimal' : 'text'}
            autoComplete="off"
            autoCorrect="off"
            placeholder={answer.type === 'number' ? 'Zahl eingeben' : 'Antwort eingeben'}
            className="rounded-xl border border-stone-300 bg-transparent px-4 py-3 text-lg dark:border-stone-700"
          />
          <PrimaryButton type="submit" disabled={!input.trim()}>
            Antwort prüfen
          </PrimaryButton>
        </form>
      )}

      {feedback === 'wrong' && <p className="mt-3 font-medium text-red-600">Leider falsch – versucht es noch einmal!</p>}

      <div className="mt-4 space-y-2">
        {riddle.hints.slice(0, hintsUsed).map((hint, i) => (
          <p key={i} className="rounded-lg bg-brand-50 p-2 text-sm dark:bg-stone-800">
            💡 Tipp {i + 1}: {hint}
          </p>
        ))}
        {hintsUsed < riddle.hints.length && (
          <button onClick={onHint} className="text-sm font-medium text-brand-700 underline dark:text-brand-500">
            Tipp {hintsUsed + 1} anzeigen
          </button>
        )}
      </div>
    </Card>
  )
}
