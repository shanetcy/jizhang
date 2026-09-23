import { currentMonth, monthLabel, shiftMonth } from '../dates'

interface Props {
  month: string
  onChange: (ym: string) => void
}

export function MonthSwitcher({ month, onChange }: Props) {
  const isCurrent = month === currentMonth()
  return (
    <div className="month-switcher">
      <button aria-label="上个月" onClick={() => onChange(shiftMonth(month, -1))}>
        ‹
      </button>
      <h1>{monthLabel(month)}</h1>
      <button aria-label="下个月" disabled={isCurrent} onClick={() => onChange(shiftMonth(month, 1))}>
        ›
      </button>
    </div>
  )
}
