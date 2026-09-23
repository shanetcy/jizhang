import type { Txn } from '../db'
import { dayLabel } from '../dates'
import { useCategoryMap, useMonthTxns } from '../hooks'
import { formatMoney } from '../money'
import { totalsByCurrency } from '../totals'
import { MonthSwitcher } from '../components/MonthSwitcher'

interface Props {
  month: string
  onMonthChange: (ym: string) => void
  onEdit: (t: Txn) => void
}

export function ListPage({ month, onMonthChange, onEdit }: Props) {
  const txns = useMonthTxns(month)
  const categories = useCategoryMap()
  if (!txns) return null

  const totals = totalsByCurrency(txns)

  // 按日期分组，txns 已经是新的在前
  const days: [string, Txn[]][] = []
  for (const t of txns) {
    const last = days[days.length - 1]
    if (last?.[0] === t.date) last[1].push(t)
    else days.push([t.date, [t]])
  }

  return (
    <main className="page">
      <header className="page-header">
        <MonthSwitcher month={month} onChange={onMonthChange} />
      </header>

      {totals.length > 0 && (
        <section className="month-summary" aria-label="本月合计">
          {totals.map((t) => (
            <div key={t.currency} className={`summary-line cur-${t.currency}`}>
              <span className="dot" />
              <span className="summary-label">支出</span>
              <span className="num">{formatMoney(t.expense, t.currency)}</span>
              {t.income > 0 && <span className="summary-income num">收入 +{formatMoney(t.income, t.currency)}</span>}
            </div>
          ))}
        </section>
      )}

      {days.length === 0 ? (
        <p className="empty">这个月还没有记录。点下方的 + 记一笔。</p>
      ) : (
        days.map(([date, list]) => (
          <section key={date} className="day">
            <h2 className="day-label">{dayLabel(date)}</h2>
            <ul>
              {list.map((t) => {
                const c = categories.get(t.categoryId)
                return (
                  <li key={t.id}>
                    <button className="txn-row" onClick={() => onEdit(t)}>
                      <span className="emoji">{c?.icon ?? '❔'}</span>
                      <span className="txn-text">
                        <span className="txn-cat">{c?.name ?? '未分类'}</span>
                        {t.note && <span className="txn-note">{t.note}</span>}
                      </span>
                      <span className={`num txn-amount ${t.type}`}>
                        {t.type === 'income' ? '+' : ''}
                        {formatMoney(t.amount, t.currency)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </main>
  )
}
