import Dexie, { type EntityTable } from 'dexie'
import type { Currency } from './money'

export type TxnType = 'expense' | 'income'

// 一笔账。金额用“分”（整数）存储，避免小数误差。
export interface Txn {
  id?: number
  type: TxnType
  amount: number
  currency: Currency
  categoryId: number
  date: string // YYYY-MM-DD，本地日期
  note: string
  createdAt: number
}

export interface Category {
  id?: number
  type: TxnType
  name: string
  icon: string // 一个 emoji
  order: number
  archived?: boolean // 删除的分类只隐藏，旧账仍能显示
}

export const db = new Dexie('jizhang') as Dexie & {
  txns: EntityTable<Txn, 'id'>
  categories: EntityTable<Category, 'id'>
}

db.version(1).stores({
  txns: '++id, date, categoryId, currency, [currency+date]',
  categories: '++id, type, order',
})

const DEFAULT_CATEGORIES: [TxnType, string, string][] = [
  ['expense', '🍜', '餐饮'],
  ['expense', '🚇', '交通'],
  ['expense', '🛒', '日用'],
  ['expense', '🛍️', '购物'],
  ['expense', '🏠', '住房'],
  ['expense', '💡', '水电网'],
  ['expense', '🎮', '娱乐'],
  ['expense', '💊', '医疗'],
  ['expense', '✈️', '旅行'],
  ['expense', '📚', '学习'],
  ['expense', '🎁', '人情'],
  ['expense', '📦', '其他'],
  ['income', '💼', '工资'],
  ['income', '🧧', '红包'],
  ['income', '📈', '理财'],
  ['income', '↩️', '退款'],
  ['income', '📦', '其他'],
]

// 第一次打开时写入默认分类
db.on('populate', (tx) => {
  tx.table('categories').bulkAdd(
    DEFAULT_CATEGORIES.map(([type, icon, name], order) => ({ type, icon, name, order })),
  )
})

// ---------- 备份 ----------

interface Backup {
  app: 'jizhang'
  version: 1
  exportedAt: string
  categories: Category[]
  txns: Txn[]
}

export async function exportBackup(): Promise<Blob> {
  const data: Backup = {
    app: 'jizhang',
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: await db.categories.toArray(),
    txns: await db.txns.toArray(),
  }
  return new Blob([JSON.stringify(data)], { type: 'application/json' })
}

// 用备份文件整个替换当前数据，返回导入的记录条数
export async function importBackup(file: File): Promise<number> {
  let data: Backup
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error('文件不是有效的备份（无法读取 JSON）')
  }
  if (data?.app !== 'jizhang' || !Array.isArray(data.txns) || !Array.isArray(data.categories)) {
    throw new Error('这不是记账 App 导出的备份文件')
  }
  await db.transaction('rw', db.txns, db.categories, async () => {
    await db.txns.clear()
    await db.categories.clear()
    await db.categories.bulkAdd(data.categories)
    await db.txns.bulkAdd(data.txns)
  })
  return data.txns.length
}

// 申请持久存储，降低浏览器自动清理数据的可能
export function requestPersist() {
  navigator.storage?.persist?.().catch(() => {})
}
