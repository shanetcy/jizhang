import { useEffect, useState } from 'react'
import { db, type Txn, type TxnType } from '../db'
import { deleteExpense, saveExpense, type SharedExpense } from '../cloud'
import { useShared } from '../SharedContext'
import { useCategoriesByUsage } from '../hooks'
import { CURRENCIES, getLastCurrency, parseToCents, setLastCurrency, symbolOf, type Currency } from '../money'
import { shortDayLabel, today } from '../dates'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']

// 数字键盘输入规则：最多两位小数、整数部分最多 9 位
function applyKey(s: string, k: string) {
  if (k === '⌫') return s.slice(0, -1)
  if (k === '.') return s.includes('.') ? s : (s || '0') + '.'
  const [int, dec] = s.split('.')
  if (dec !== undefined) return dec.length >= 2 ? s : s + k
  if (int === '0') return k
  return int.length >= 9 ? s : s + k
}

// 输入中的金额加上千位分隔符，小数部分按输入原样显示：“1234.5” → “1,234.5”
function displayAmount(s: string) {
  if (!s) return '0'
  const [int, dec] = s.split('.')
  return Number(int || 0).toLocaleString('en-US') + (dec !== undefined ? '.' + dec : '')
}

export type Ledger = 'personal' | 'shared'

export type SheetTarget =
  | { kind: 'new'; ledger: Ledger }
  | { kind: 'personal'; txn: Txn }
  | { kind: 'shared'; exp: SharedExpense }

interface Props {
  target: SheetTarget
  onClose: () => void
}

interface PickedCategory {
  id?: number
  icon: string
  name: string
}

export function EntrySheet({ target, onClose }: Props) {
  const { user, household } = useShared()
  const txn = target.kind === 'personal' ? target.txn : null
  const exp = target.kind === 'shared' ? target.exp : null
  const canShare = Boolean(user && household)

  const [ledger, setLedger] = useState<Ledger>(
    target.kind === 'new' ? (target.ledger === 'shared' && canShare ? 'shared' : 'personal') : target.kind,
  )
  const shared = ledger === 'shared'

  const [type, setType] = useState<TxnType>(txn?.type ?? 'expense')
  const initialAmount = txn?.amount ?? exp?.amount
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount / 100) : '')
  const [currency, setCurrency] = useState<Currency>(txn?.currency ?? getLastCurrency())
  const [pickingCurrency, setPickingCurrency] = useState(false)
  const [cat, setCat] = useState<PickedCategory | null>(
    exp ? { icon: exp.catIcon, name: exp.catName } : txn ? { id: txn.categoryId, icon: '', name: '' } : null,
  )
  const [payer, setPayer] = useState(exp?.payer ?? user?.uid ?? '')
  const [date, setDate] = useState(txn?.date ?? exp?.date ?? today())
  const [note, setNote] = useState(txn?.note ?? exp?.note ?? '')
  const [error, setError] = useState('')

  // 生活费只有支出
  const effectiveType = shared ? 'expense' : type
  const categories = useCategoriesByUsage(effectiveType)

  // 还没选分类时，默认选中最常用的一个
  useEffect(() => {
    if (!cat && categories?.length) {
      const c = categories[0]
      setCat({ id: c.id, icon: c.icon, name: c.name })
    }
  }, [cat, categories])

  // 按 Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const cents = parseToCents(amount)
  const isPicked = (c: { id?: number; icon: string; name: string }) =>
    shared ? c.icon === cat?.icon && c.name === cat?.name : c.id === cat?.id

  async function save() {
    if (cents <= 0) return setError('请输入金额')
    if (!cat) return setError('请选择分类')
    if (shared) {
      saveExpense(
        household!.id,
        {
          amount: cents,
          payer,
          date,
          note: note.trim(),
          catIcon: cat.icon,
          catName: cat.name,
          createdBy: exp?.createdBy ?? user!.uid,
          createdAt: exp?.createdAt ?? Date.now(),
        },
        exp?.id,
      )
    } else {
      const data = { type, amount: cents, currency, categoryId: cat.id!, date, note: note.trim() }
      if (txn) await db.txns.update(txn.id!, data)
      else await db.txns.add({ ...data, createdAt: Date.now() })
      setLastCurrency(currency)
    }
    onClose()
  }

  async function remove() {
    if (!confirm('删除这笔记录？')) return
    if (exp) deleteExpense(household!.id, exp.id)
    if (txn) await db.txns.delete(txn.id!)
    onClose()
  }

  const members = household?.members ?? []

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className={`sheet ${shared ? 'cur-shared' : `cur-${currency}`}`}
        role="dialog"
        aria-label={target.kind === 'new' ? '记一笔' : '编辑记录'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-top">
          {target.kind === 'new' && canShare && (
            <div className="segmented" role="tablist" aria-label="记到哪里">
              {(['personal', 'shared'] as const).map((l) => (
                <button
                  key={l}
                  role="tab"
                  aria-selected={ledger === l}
                  onClick={() => {
                    setLedger(l)
                    setCat(null)
                  }}
                >
                  {l === 'personal' ? '个人' : '生活费'}
                </button>
              ))}
            </div>
          )}
          {!shared && (
            <div className="segmented" role="tablist" aria-label="支出或收入">
              {(['expense', 'income'] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={type === t}
                  onClick={() => {
                    setType(t)
                    setCat(null)
                  }}
                >
                  {t === 'expense' ? '支出' : '收入'}
                </button>
              ))}
            </div>
          )}
          <span className="spacer" />
          {target.kind !== 'new' && (
            <button className="text-btn danger" onClick={remove}>
              删除
            </button>
          )}
          <button className="text-btn" onClick={onClose}>
            取消
          </button>
        </div>

        <div className="amount-row">
          {shared ? (
            <span className="currency-chip is-fixed" aria-label="欧元">
              €
            </span>
          ) : (
            <button
              className="currency-chip"
              aria-expanded={pickingCurrency}
              aria-label={`币种：${currency}，点按更换`}
              onClick={() => setPickingCurrency((v) => !v)}
            >
              {symbolOf(currency)} <span aria-hidden>▾</span>
            </button>
          )}
          <output className={`amount-display ${amount ? '' : 'is-empty'}`}>{displayAmount(amount)}</output>
        </div>

        {pickingCurrency && !shared && (
          <div className="currency-picker">
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                aria-pressed={c.code === currency}
                className={`cur-${c.code}`}
                onClick={() => {
                  setCurrency(c.code)
                  setPickingCurrency(false)
                }}
              >
                <span className="dot" />
                {c.name} {c.symbol}
              </button>
            ))}
          </div>
        )}

        {shared && members.length > 1 && (
          <div className="payer-row" role="radiogroup" aria-label="谁付的">
            <span className="payer-label">谁付的</span>
            {members.map((uid) => {
              const p = household!.profiles[uid]
              return (
                <button key={uid} role="radio" aria-checked={payer === uid} onClick={() => setPayer(uid)}>
                  <span className="emoji">{p?.emoji}</span>
                  {p?.name}
                </button>
              )
            })}
          </div>
        )}

        <div className="category-grid">
          {categories?.map((c) => (
            <button key={c.id} aria-pressed={isPicked(c)} onClick={() => setCat({ id: c.id, icon: c.icon, name: c.name })}>
              <span className="emoji">{c.icon}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>

        <div className="meta-row">
          <label className="date-chip">
            {shortDayLabel(date)} <span aria-hidden>▾</span>
            <input type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
          <input
            className="note-input"
            placeholder="备注（可不填）"
            value={note}
            maxLength={60}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="keypad">
          {KEYS.map((k) => (
            <button
              key={k}
              aria-label={k === '⌫' ? '退格' : k}
              onClick={() => {
                setAmount((s) => applyKey(s, k))
                setError('')
              }}
            >
              {k}
            </button>
          ))}
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="save-btn" onClick={save}>
          {shared ? '记到生活费' : '保存'}
        </button>
      </div>
    </div>
  )
}
