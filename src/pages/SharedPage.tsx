import { useState } from 'react'
import { setBudget, type SharedExpense } from '../cloud'
import { useShared } from '../SharedContext'
import { budgetFor, summarizeMonth } from '../settle'
import { currentMonth, dayLabel, monthLabel } from '../dates'
import { formatMoney } from '../money'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { Modal, parseAmountInput } from '../components/Modal'
import { SetupPrompt } from '../components/SetupPrompt'

const eur = (c: number) => formatMoney(c, 'EUR')

interface Props {
  month: string
  onMonthChange: (ym: string) => void
  onEdit: (e: SharedExpense) => void
  onOpenSettings: () => void
}

export function SharedPage({ month, onMonthChange, onEdit, onOpenSettings }: Props) {
  const { ready, user, household, expenses, budgets } = useShared()
  const [editingBudget, setEditingBudget] = useState(false)

  if (!ready) return null
  if (!user || !household) {
    return (
      <main className="page">
        <header className="page-header">
          <h1>生活费</h1>
        </header>
        <SetupPrompt onOpenSettings={onOpenSettings} />
      </main>
    )
  }

  const list = expenses.filter((e) => e.date.startsWith(month))
  const budget = budgetFor(month, budgets)
  const s = summarizeMonth(list, budget, household.members)
  const who = (uid: string) => household.profiles[uid] ?? { emoji: '❔', name: '?' }
  const isPast = month < currentMonth()
  const over = s.remaining < 0

  // 按日期分组
  const days: [string, SharedExpense[]][] = []
  for (const e of list) {
    const last = days[days.length - 1]
    if (last?.[0] === e.date) last[1].push(e)
    else days.push([e.date, [e]])
  }

  return (
    <main className="page">
      <header className="page-header">
        <MonthSwitcher month={month} onChange={onMonthChange} />
      </header>

      {household.members.length < 2 && (
        <p className="notice">
          伴侣还没加入。把邀请码 <b className="num">{household.inviteCode}</b> 发给 Ta，在“设置”里输入就能加入。
        </p>
      )}

      <section className="budget-card">
        {budget == null ? (
          <button className="primary-btn" onClick={() => setEditingBudget(true)}>
            设定每月生活费
          </button>
        ) : (
          <>
            <div className="budget-head">
              <span className="num budget-spent">{eur(s.spent)}</span>
              <button className="budget-total" onClick={() => setEditingBudget(true)} aria-label="修改预算">
                / {eur(budget)} ✎
              </button>
            </div>
            <div className={`progress ${over ? 'is-over' : ''}`} aria-hidden>
              <div style={{ width: `${Math.min(s.spent / budget, 1) * 100}%` }} />
            </div>
            <p className={`budget-left ${over ? 'is-over' : ''}`}>
              {over ? `超支 ${eur(-s.remaining)}，两人各补 ${eur(Math.round(-s.remaining / 2))}` : `还剩 ${eur(s.remaining)}`}
            </p>
          </>
        )}
      </section>

      <section className="people">
        {household.members.map((uid) => (
          <div key={uid} className="person">
            <span className="person-emoji">{who(uid).emoji}</span>
            <span className="person-name">
              {who(uid).name}
              {uid === user.uid && <span className="me-tag">我</span>}
            </span>
            <span className="num person-paid">付了 {eur(s.paid.get(uid) ?? 0)}</span>
          </div>
        ))}
      </section>

      {household.members.length === 2 && s.spent > 0 && (
        <section className="settle">
          <h2>{isPast ? `${monthLabel(month)}结算` : '到目前为止的结算'}</h2>
          {s.transfer ? (
            <p className="settle-line">
              <span className="settle-who">
                {who(s.transfer.from).emoji} {who(s.transfer.from).name}
              </span>
              <span className="settle-arrow">转给</span>
              <span className="settle-who">
                {who(s.transfer.to).emoji} {who(s.transfer.to).name}
              </span>
              <b className="num settle-amount">{eur(s.transfer.amount)}</b>
            </p>
          ) : (
            <p className="settle-line">两人付的一样多，不用转账 🎉</p>
          )}
          <p className="hint">
            每人分摊 {eur(s.share)}
            {budget != null && !over && s.remaining > 0 && `，结余 ${eur(s.remaining)}${isPast ? '，已存进' : '，月底存进'}存钱罐 🐷`}
          </p>
        </section>
      )}

      {days.length === 0 ? (
        <p className="empty">这个月还没有生活费支出。点 + 记一笔，选“生活费”。</p>
      ) : (
        days.map(([date, items]) => (
          <section key={date} className="day">
            <h2 className="day-label">{dayLabel(date)}</h2>
            <ul>
              {items.map((e) => (
                <li key={e.id}>
                  <button className="txn-row" onClick={() => onEdit(e)}>
                    <span className="emoji">{e.catIcon}</span>
                    <span className="txn-text">
                      <span className="txn-cat">{e.catName}</span>
                      {e.note && <span className="txn-note">{e.note}</span>}
                    </span>
                    <span className="payer-badge" title={`${who(e.payer).name} 付的`}>
                      {who(e.payer).emoji}
                    </span>
                    <span className="num txn-amount">{eur(e.amount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {editingBudget && (
        <BudgetDialog
          month={month}
          current={budget}
          onSave={(amount) => setBudget(household.id, month, amount)}
          onClose={() => setEditingBudget(false)}
        />
      )}
    </main>
  )
}

function BudgetDialog({
  month,
  current,
  onSave,
  onClose,
}: {
  month: string
  current: number | null
  onSave: (cents: number) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(current ? String(current / 100) : '')
  const cents = parseAmountInput(value)
  return (
    <Modal title={`${monthLabel(month)}生活费`} onClose={onClose}>
      <label className="field-label">
        两人合计（欧元）
        <input
          className="field num"
          inputMode="decimal"
          autoFocus
          placeholder="600"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <p className="hint">{cents > 0 ? `每人出 ${eur(Math.round(cents / 2))}。` : ''}之后的月份会沿用这个金额，随时可以再改。</p>
      <div className="modal-actions">
        <button className="secondary-btn" onClick={onClose}>
          取消
        </button>
        <button
          className="primary-btn"
          disabled={cents <= 0}
          onClick={() => {
            onSave(cents)
            onClose()
          }}
        >
          保存
        </button>
      </div>
    </Modal>
  )
}
