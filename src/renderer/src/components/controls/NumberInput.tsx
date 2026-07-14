import { useEffect, useRef, useState } from 'react'

interface NumberInputProps {
  value: number
  onCommit: (value: number) => void
  min?: number
  max?: number
  step?: number
  ariaLabel?: string
  className?: string
  live?: boolean
}

const decimalsForStep = (step: number): number => String(step).split('.')[1]?.length ?? 0
const displayValue = (value: number, step: number): string => Number.isFinite(value) ? String(Number(value.toFixed(decimalsForStep(step)))) : ''
const parsedNumber = (draft: string): number => Number(draft.trim().replace(',', '.'))

const NumberInput = ({ value, onCommit, min, max, step = 0.1, ariaLabel, className = 'inspector-input', live = false }: NumberInputProps): JSX.Element => {
  const focused = useRef(false)
  const [draft, setDraft] = useState(() => displayValue(value, step))

  useEffect(() => {
    if (!focused.current) setDraft(displayValue(value, step))
  }, [step, value])

  const commit = (): void => {
    const parsed = parsedNumber(draft)
    if (!Number.isFinite(parsed)) {
      setDraft(displayValue(value, step))
      return
    }
    const next = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, parsed))
    setDraft(displayValue(next, step))
    onCommit(next)
  }

  return (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
      className={className}
      value={draft}
      onFocus={(event) => {
        focused.current = true
        event.currentTarget.select()
      }}
      onChange={(event) => {
        const nextDraft = event.target.value
        setDraft(nextDraft)
        if (live) {
          const parsed = parsedNumber(nextDraft)
          if (Number.isFinite(parsed)) onCommit(Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, parsed)))
        }
      }}
      onBlur={() => {
        commit()
        focused.current = false
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit()
          event.currentTarget.blur()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          setDraft(displayValue(value, step))
          event.currentTarget.blur()
        }
      }}
    />
  )
}

export default NumberInput
