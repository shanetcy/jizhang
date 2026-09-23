import { useState } from 'react'
import type { TxnType } from '../db'
import { useCategoryMap, useMonthTxns } from '../hooks'
import { useShared } from '../SharedContext'
import { CURRENCIES, formatMoney, getLastCurrency, type Currency } from '../money'
import { MonthSwitcher } from '../components/MonthSwitcher'

interface Props {
  month: string
  onMonthChange: (ym: string) => void
  onOpenSettings: () => void
}

type Source = Currency | 'shared'

interface Row {
  key: string
  icon: string
  name: string
  amount: number
}

export function StatsPage({ month, onMonthChange, onOpenSettings }: Props) {
  const txns = useMonthTxns(month)
  const categories = useCategoryMap()
  const { household, expenses } = useShared()
  const [picked, setPicked] = useState<Source>(getLastCurrency())
  const [type, setType] = useState<TxnType>('expense')
  if (!txns) return null

  const sharedList = household ? expenses.filter((e) => e.date.startsWith(month)) : []

  // 只显示本月有记录的标签；选中的本月没数据时，自动换到第一个有数据的
  const tabs: { key: Source; label: string }[] = CURRENCIES.filter((c) => txns.some((t) => t.currency === c.code)).map(
    (c) => ({ key: c.code, label: c.name }),
  )
  if (sharedList.length > 0) tabs.push({ key: 'shared', label: '生活费' })
  const source = tabs.some((t) => t.key === picked) ? picked : tabs[0]?.key
  const isShared = source === 'shared'
  const currency: Currency = isShared || !source ? 'EUR' : source

  // 按分类汇总，从多到少
  const byCat = new Map<string, Row>()
  const addTo = (key: string, icon: string, name: string, amount: number) => {
    const row = byCat.get(key) ?? { key, icon, name, amount: 0 }
    row.amount += amount
    byCat.set(key, row)
  }
  if (isShared) {
    for (const e of sharedList) addTo(e.catIcon + e.catName, e.catIcon, e.catName, e.amount)
  } else {
    for (const t of txns) {
      if (t.currency !== source || t.type !== type) continue
      const c = categories.get(t.categoryId)
      addTo(String(t.categoryId), c?.icon ?? '❔', c?.name ?? '未分类', t.amount)
    }
  }
  const rows = [...byCat.values()].sort((a, b) => b.amount - a.amount)
  const total = rows.reduce((s, r) => s + r.amount, 0)
  const max = rows[0]?.amount ?? 1
  const shownType = isShared ? 'expense' : type

  return (
    <main className={`page cur-${isShared ? 'shared' : currency}`}>
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

      {!source ? (
        <p className="empty">这个月还没有记录，记几笔后这里会显示分类统计。</p>
      ) : (
        <>
          <div className="stats-controls">
            {tabs.length > 1 && (
              <div className="segmented" role="tablist" aria-label="账本">
                {tabs.map((t) => (
                  <button key={t.key} role="tab" aria-selected={t.key === source} onClick={() => setPicked(t.key)}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
            {!isShared && (
              <div className="segmented" role="tablist" aria-label="类型">
                {(['expense', 'income'] as const).map((t) => (
                  <button key={t} role="tab" aria-selected={type === t} onClick={() => setType(t)}>
                    {t === 'expense' ? '支出' : '收入'}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="stats-total">
            <span className="stats-total-label">
              {isShared ? '生活费合计' : shownType === 'expense' ? '支出合计' : '收入合计'}
            </span>
            <span className="stats-total-num num">{formatMoney(total, currency)}</span>
          </div>

          {rows.length === 0 ? (
            <p className="empty">这个月没有{shownType === 'expense' ? '支出' : '收入'}记录。</p>
          ) : (
            <ul className="bars">
              {rows.map((r) => (
                <li key={r.key}>
                  <div className="bar-head">
                    <span>
                      {r.icon} {r.name}
                    </span>
                    <span className="num">
                      {formatMoney(r.amount, currency)}
                      <span className="bar-pct">{Math.round((r.amount / total) * 100)}%</span>
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(r.amount / max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  )
}
