export type Currency = 'EUR' | 'MYR' | 'USD'

export const CURRENCIES: { code: Currency; symbol: string; name: string }[] = [
  { code: 'EUR', symbol: '€', name: '欧元' },
  { code: 'MYR', symbol: 'RM', name: '马币' },
  { code: 'USD', symbol: '$', name: '美元' },
]

export const symbolOf = (c: Currency) => CURRENCIES.find((x) => x.code === c)!.symbol

const numberFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// 分 → “1,234.50”
export const formatCents = (cents: number) => numberFmt.format(cents / 100)

// 分 → “€1,234.50”
export const formatMoney = (cents: number, c: Currency) => symbolOf(c) + formatCents(cents)

// 键盘输入的字符串 “12.5” → 1250 分
export const parseToCents = (s: string) => Math.round(parseFloat(s || '0') * 100)

// ---------- 记住上次用的币种 ----------

const LAST_CURRENCY_KEY = 'jizhang.lastCurrency'

export function getLastCurrency(): Currency {
  try {
    const v = localStorage.getItem(LAST_CURRENCY_KEY)
    if (v === 'EUR' || v === 'MYR' || v === 'USD') return v
  } catch {}
  return 'MYR'
}

export function setLastCurrency(c: Currency) {
  try {
    localStorage.setItem(LAST_CURRENCY_KEY, c)
  } catch {}
}
