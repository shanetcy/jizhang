const pad = (n: number) => String(n).padStart(2, '0')

// 本地日期 → “2026-09-23”
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const today = () => toISODate(new Date())

// “2026-09” 形式的月份
export const currentMonth = () => today().slice(0, 7)

export function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return `${y}年${m}月`
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

// 明细页的日期标题：“9月21日 周日”，今天和昨天前面加上“今天”“昨天”
export function dayLabel(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const base = `${m}月${d}日 ${WEEKDAYS[new Date(y, m - 1, d).getDay()]}`
  if (iso === today()) return `今天  ${base}`
  if (iso === toISODate(new Date(Date.now() - 86400000))) return `昨天  ${base}`
  return base
}

// 记账面板上的日期：“今天”“昨天”或“9月21日”
export function shortDayLabel(iso: string) {
  if (iso === today()) return '今天'
  if (iso === toISODate(new Date(Date.now() - 86400000))) return '昨天'
  const [y, m, d] = iso.split('-').map(Number)
  const sameYear = y === new Date().getFullYear()
  return sameYear ? `${m}月${d}日` : `${y}年${m}月${d}日`
}
