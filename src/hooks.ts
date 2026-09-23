import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Category, type Txn, type TxnType } from './db'

// 全部分类（包括已删除的，旧账要用来显示名称），按 id 查找
export function useCategoryMap() {
  return useLiveQuery(async () => {
    const list = await db.categories.toArray()
    return new Map(list.map((c) => [c.id!, c]))
  }) ?? new Map<number, Category>()
}

// 某类型下可选的分类，按使用次数从多到少排序
export function useCategoriesByUsage(type: TxnType) {
  return useLiveQuery(async () => {
    const [cats, usedIds] = await Promise.all([
      db.categories.where('type').equals(type).toArray(),
      db.txns.orderBy('categoryId').keys(),
    ])
    const count = new Map<number, number>()
    for (const id of usedIds) count.set(id as number, (count.get(id as number) ?? 0) + 1)
    return cats
      .filter((c) => !c.archived)
      .sort((a, b) => (count.get(b.id!) ?? 0) - (count.get(a.id!) ?? 0) || a.order - b.order)
  }, [type])
}

// 某个月的全部记录，日期新的在前
export function useMonthTxns(ym: string) {
  return useLiveQuery(async () => {
    const list = await db.txns.where('date').startsWith(ym).toArray()
    return list.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  }, [ym])
}

export type EditTarget = Txn | 'new' | null
