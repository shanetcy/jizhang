// 生活费结算和存钱罐的计算（纯函数，金额单位：欧分）
import type { SharedExpense, Withdrawal } from './cloud'
import { shiftMonth } from './dates'

// 某个月的预算：这个月单独设置过就用它，否则沿用之前最近一次设置的；从没设置过返回 null
export function budgetFor(ym: string, budgets: Map<string, number>): number | null {
  let bestMonth = ''
  for (const m of budgets.keys()) if (m <= ym && m > bestMonth) bestMonth = m
  return bestMonth ? budgets.get(bestMonth)! : null
}

export interface MonthSummary {
  budget: number | null
  spent: number
  remaining: number // 预算 − 已用，负数表示超支
  paid: Map<string, number> // 每人付了多少
  share: number // 每人应分摊（所有支出两人平分）
  // 付得少的人转给付得多的人，金额 = 两人已付之差的一半
  transfer: { from: string; to: string; amount: number } | null
}

export function summarizeMonth(expenses: SharedExpense[], budget: number | null, members: string[]): MonthSummary {
  const paid = new Map(members.map((m) => [m, 0]))
  for (const e of expenses) paid.set(e.payer, (paid.get(e.payer) ?? 0) + e.amount)
  const spent = expenses.reduce((s, e) => s + e.amount, 0)

  let transfer: MonthSummary['transfer'] = null
  if (members.length === 2) {
    const [a, b] = members
    const diff = paid.get(a)! - paid.get(b)!
    const amount = Math.round(Math.abs(diff) / 2)
    if (amount > 0) transfer = diff > 0 ? { from: b, to: a, amount } : { from: a, to: b, amount }
  }

  return { budget, spent, remaining: (budget ?? 0) - spent, paid, share: Math.round(spent / 2), transfer }
}

export type PiggyEntry =
  | { kind: 'month'; month: string; amount: number; overspent: number } // 月底结余存入（超支的月份存入 0）
  | { kind: 'withdrawal'; w: Withdrawal }

// 存钱罐：已结束的月份把结余存进来，再减去取出的钱
export function piggy(
  expenses: SharedExpense[],
  budgets: Map<string, number>,
  withdrawals: Withdrawal[],
  startMonth: string,
  thisMonth: string,
) {
  const spentByMonth = new Map<string, number>()
  for (const e of expenses) {
    const m = e.date.slice(0, 7)
    spentByMonth.set(m, (spentByMonth.get(m) ?? 0) + e.amount)
  }

  const months: PiggyEntry[] = []
  for (let m = startMonth; m < thisMonth; m = shiftMonth(m, 1)) {
    const budget = budgetFor(m, budgets)
    if (budget == null) continue
    const left = budget - (spentByMonth.get(m) ?? 0)
    months.push({ kind: 'month', month: m, amount: Math.max(left, 0), overspent: Math.max(-left, 0) })
  }

  const saved = months.reduce((s, e) => s + (e.kind === 'month' ? e.amount : 0), 0)
  const taken = withdrawals.reduce((s, w) => s + w.amount, 0)

  // 本月到月底预计存入多少
  const budgetNow = budgetFor(thisMonth, budgets)
  const pending = budgetNow == null ? 0 : Math.max(budgetNow - (spentByMonth.get(thisMonth) ?? 0), 0)

  // 历史记录：月份结余和取出按时间倒序混在一起
  const history: PiggyEntry[] = [...months, ...withdrawals.map((w) => ({ kind: 'withdrawal' as const, w }))].sort((a, b) => {
    const key = (e: PiggyEntry) => (e.kind === 'month' ? shiftMonth(e.month, 1) + '-00' : e.w.date)
    return key(b).localeCompare(key(a))
  })

  return { balance: saved - taken, pending, history }
}
