import type { Txn } from './db'
import { CURRENCIES, type Currency } from './money'

export interface CurrencyTotal {
  currency: Currency
  expense: number
  income: number
}

const sum = (list: Txn[]) => list.reduce((s, t) => s + t.amount, 0)

// 按币种分别汇总收入和支出，只返回有记录的币种（顺序固定为 EUR、MYR、USD）
export function totalsByCurrency(txns: Txn[]): CurrencyTotal[] {
  const result: CurrencyTotal[] = []
  for (const { code } of CURRENCIES) {
    const list = txns.filter((t) => t.currency === code)
    if (list.length === 0) continue
    result.push({
      currency: code,
      expense: sum(list.filter((t) => t.type === 'expense')),
      income: sum(list.filter((t) => t.type === 'income')),
    })
  }
  return result
}
