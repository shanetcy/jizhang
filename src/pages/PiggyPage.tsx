import { useState } from 'react'
import { addWithdrawal, deleteWithdrawal } from '../cloud'
import { useShared } from '../SharedContext'
import { piggy } from '../settle'
import { currentMonth, monthLabel, shortDayLabel, today } from '../dates'
import { formatMoney } from '../money'
import { Modal, parseAmountInput } from '../components/Modal'
import { SetupPrompt } from '../components/SetupPrompt'

const eur = (c: number) => formatMoney(c, 'EUR')
const PIG_SRC = import.meta.env.BASE_URL + 'pig.webp'

export function PiggyPage({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { ready, user, household, expenses, budgets, withdrawals } = useShared()
  const [withdrawing, setWithdrawing] = useState(false)
  const [wiggle, setWiggle] = useState(0)

  if (!ready) return null
  const signedUp = Boolean(user && household)
  const p = signedUp ? piggy(expenses, budgets, withdrawals, household!.startMonth, currentMonth()) : null
  const who = (uid: string) => household?.profiles[uid]?.emoji ?? ''

  return (
    <main className="page piggy-page">
      <header className="page-header">
        <h1>存钱罐</h1>
      </header>

      <section className="piggy-hero">
        {/* 点一下小猪，它会晃一晃 */}
        <button className="pig-btn" aria-label="小猪存钱罐" onClick={() => setWiggle((n) => n + 1)}>
          <img key={wiggle} className={wiggle ? 'pig wiggle' : 'pig'} src={PIG_SRC} alt="" width={240} height={218} />
        </button>
        {p && (
          <>
            <p className="piggy-balance num">{eur(p.balance)}</p>
            {p.pending > 0 && <p className="hint">这个月如果不再花钱，月底还会存进 {eur(p.pending)}</p>}
          </>
        )}
      </section>

      {!signedUp ? (
        <SetupPrompt onOpenSettings={onOpenSettings} />
      ) : (
        <>
          <div className="piggy-actions">
            <button className="secondary-btn" disabled={p!.balance <= 0} onClick={() => setWithdrawing(true)}>
              从存钱罐取钱
            </button>
          </div>

          {p!.history.length === 0 ? (
            <p className="empty">每个月的生活费结余会在月底存进来。</p>
          ) : (
            <ul className="piggy-history">
              {p!.history.map((e) =>
                e.kind === 'month' ? (
                  <li key={e.month}>
                    <span className="history-text">
                      {monthLabel(e.month)}结余
                      {e.overspent > 0 && <span className="txn-note">超支 {eur(e.overspent)}，没有结余</span>}
                    </span>
                    <span className="num history-in">+{eur(e.amount)}</span>
                  </li>
                ) : (
                  <li key={e.w.id}>
                    <button
                      className="history-btn"
                      onClick={() => confirm(`撤销这笔取出（${e.w.note}）？`) && deleteWithdrawal(household!.id, e.w.id)}
                    >
                      <span className="history-text">
                        {e.w.note}
                        <span className="txn-note">
                          {shortDayLabel(e.w.date)} {who(e.w.by)} 取出
                        </span>
                      </span>
                      <span className="num history-out">−{eur(e.w.amount)}</span>
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}
        </>
      )}

      {withdrawing && (
        <WithdrawDialog
          max={p!.balance}
          onSave={(amount, note) =>
            addWithdrawal(household!.id, { amount, note, date: today(), by: user!.uid, createdAt: Date.now() })
          }
          onClose={() => setWithdrawing(false)}
        />
      )}
    </main>
  )
}

function WithdrawDialog({
  max,
  onSave,
  onClose,
}: {
  max: number
  onSave: (cents: number, note: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const cents = parseAmountInput(value)
  const tooMuch = cents > max
  return (
    <Modal title="从存钱罐取钱" onClose={onClose}>
      <label className="field-label">
        金额（欧元）
        <input className="field num" inputMode="decimal" autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <label className="field-label">
        用来做什么
        <input className="field" placeholder="比如：周末去旅行" maxLength={30} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {tooMuch && <p className="form-error">存钱罐里只有 {eur(max)}</p>}
      <div className="modal-actions">
        <button className="secondary-btn" onClick={onClose}>
          取消
        </button>
        <button
          className="primary-btn"
          disabled={cents <= 0 || tooMuch || !note.trim()}
          onClick={() => {
            onSave(cents, note.trim())
            onClose()
          }}
        >
          取出
        </button>
      </div>
    </Modal>
  )
}
