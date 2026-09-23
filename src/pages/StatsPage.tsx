import { useState } from 'react'
import type { TxnType } from '../db'
import { useCategoryMap, useMonthTxns } from '../hooks'
import { CURRENCIES, formatMoney, getLastCurrency, type Currency } from '../money'
import { MonthSwitcher } from '../components/MonthSwitcher'

interface Props {
  month: string
  onMonthChange: (ym: string) => void
  onOpenSettings: () => void
}

export function StatsPage({ month, onMonthChange, onOpenSettings }: Props) {
  const txns = useMonthTxns(month)
  const categories = useCategoryMap()
  const [picked, setPicked] = useState<Currency>(getLastCurrency())
  const [type, setType] = useState<TxnType>('expense')
  if (!txns) return null

  // 只显示本月有记录的币种；选中的币种本月没数据时，自动换到第一个有数据的
  const available = CURRENCIES.filter((c) => txns.some((t) => t.currency === c.code))
  const currency = available.some((c) => c.code === picked) ? picked : available[0]?.code

  const list = txns.filter((t) => t.currency === currency && t.type === type)
  const total = list.reduce((s, t) => s + t.amount, 0)

  // 按分类汇总，从多到少
  const byCat = new Map<number, number>()
  for (const t of list) byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.amount)
  const rows = [...byCat].sort((a, b) => b[1] - a[1])
  const max = rows[0]?.[1] ?? 1

  return (
    <main className={`page cur-${currency ?? 'none'}`}>
      <header className="page-header">
        <MonthSwitcher month={month} onChange={onMonthChange} />
        <button className="icon-btn" aria-label="设置" onClick={onOpenSettings}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
            <path
              fill="currentColor"
              d="M19.14 12.94a7.07 7.07 0 0 0 0-1.88l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7 7 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54a7 7 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.61.22L2.71 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.07 7.07 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.3.61.22l2.39-.96c.5.38 1.05.7 1.63.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54a7 7 0 0 0 1.63-.94l2.39.96c.22.08.48 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
            />
          </svg>
        </button>
      </header>

      {!currency ? (
        <p className="empty">这个月还没有记录，记几笔后这里会显示分类统计。</p>
      ) : (
        <>
          <div className="stats-controls">
            {available.length > 1 && (
              <div className="segmented" role="tablist" aria-label="币种">
                {available.map((c) => (
                  <button key={c.code} role="tab" aria-selected={c.code === currency} onClick={() => setPicked(c.code)}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            <div className="segmented" role="tablist" aria-label="类型">
              {(['expense', 'income'] as const).map((t) => (
                <button key={t} role="tab" aria-selected={type === t} onClick={() => setType(t)}>
                  {t === 'expense' ? '支出' : '收入'}
                </button>
              ))}
            </div>
          </div>

          <div className="stats-total">
            <span className="stats-total-label">{type === 'expense' ? '支出合计' : '收入合计'}</span>
            <span className="stats-total-num num">{formatMoney(total, currency)}</span>
          </div>

          {rows.length === 0 ? (
            <p className="empty">这个月没有{type === 'expense' ? '支出' : '收入'}记录。</p>
          ) : (
            <ul className="bars">
              {rows.map(([catId, amount]) => {
                const c = categories.get(catId)
                return (
                  <li key={catId}>
                    <div className="bar-head">
                      <span>
                        {c?.icon} {c?.name ?? '未分类'}
                      </span>
                      <span className="num">
                        {formatMoney(amount, currency)}
                        <span className="bar-pct">{Math.round((amount / total) * 100)}%</span>
                      </span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(amount / max) * 100}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </main>
  )
}
