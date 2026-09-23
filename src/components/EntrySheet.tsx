import { useEffect, useState } from 'react'
import { db, type Txn, type TxnType } from '../db'
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

interface Props {
  editing: Txn | null // null 表示新记一笔
  onClose: () => void
}

export function EntrySheet({ editing, onClose }: Props) {
  const [type, setType] = useState<TxnType>(editing?.type ?? 'expense')
  const [amount, setAmount] = useState(editing ? String(editing.amount / 100) : '')
  const [currency, setCurrency] = useState<Currency>(editing?.currency ?? getLastCurrency())
  const [pickingCurrency, setPickingCurrency] = useState(false)
  const [categoryId, setCategoryId] = useState<number | null>(editing?.categoryId ?? null)
  const [date, setDate] = useState(editing?.date ?? today())
  const [note, setNote] = useState(editing?.note ?? '')
  const [error, setError] = useState('')

  const categories = useCategoriesByUsage(type)

  // 分类列表加载好、或切换支出/收入后，默认选中最常用的一个
  useEffect(() => {
    if (!categories?.length) return
    if (!categories.some((c) => c.id === categoryId)) setCategoryId(categories[0].id!)
  }, [categories, categoryId])

  // 按 Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const cents = parseToCents(amount)

  async function save() {
    if (cents <= 0) return setError('请输入金额')
    if (categoryId == null) return setError('请选择分类')
    const data = { type, amount: cents, currency, categoryId, date, note: note.trim() }
    if (editing) await db.txns.update(editing.id!, data)
    else await db.txns.add({ ...data, createdAt: Date.now() })
    setLastCurrency(currency)
    onClose()
  }

  async function remove() {
    if (!editing || !confirm('删除这笔记录？')) return
    await db.txns.delete(editing.id!)
    onClose()
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className={`sheet cur-${currency}`}
        role="dialog"
        aria-label={editing ? '编辑记录' : '记一笔'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-top">
          <div className="segmented" role="tablist">
            {(['expense', 'income'] as const).map((t) => (
              <button key={t} role="tab" aria-selected={type === t} onClick={() => setType(t)}>
                {t === 'expense' ? '支出' : '收入'}
              </button>
            ))}
          </div>
          {editing && (
            <button className="text-btn danger" onClick={remove}>
              删除
            </button>
          )}
          <button className="text-btn" onClick={onClose}>
            取消
          </button>
        </div>

        <div className="amount-row">
          <button
            className="currency-chip"
            aria-expanded={pickingCurrency}
            aria-label={`币种：${currency}，点按更换`}
            onClick={() => setPickingCurrency((v) => !v)}
          >
            {symbolOf(currency)} <span aria-hidden>▾</span>
          </button>
          <output className={`amount-display ${amount ? '' : 'is-empty'}`}>
            {displayAmount(amount)}
          </output>
        </div>

        {pickingCurrency && (
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

        <div className="category-grid">
          {categories?.map((c) => (
            <button key={c.id} aria-pressed={c.id === categoryId} onClick={() => setCategoryId(c.id!)}>
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

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="save-btn" onClick={save}>
          保存
        </button>
      </div>
    </div>
  )
}
