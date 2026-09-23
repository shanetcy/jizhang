import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore'
import { auth, cloudEnabled, fs, type Household, type SharedExpense, type Withdrawal } from './cloud'

interface SharedState {
  ready: boolean // 登录状态和账本是否已加载
  user: User | null
  household: Household | null
  expenses: SharedExpense[] // 全部生活费支出，日期新的在前
  budgets: Map<string, number> // 月份 → 预算（欧分）
  withdrawals: Withdrawal[]
}

const empty: SharedState = { ready: !cloudEnabled, user: null, household: null, expenses: [], budgets: new Map(), withdrawals: [] }

const SharedContext = createContext<SharedState>(empty)

export const useShared = () => useContext(SharedContext)

// 在整个 App 外层实时订阅共同账本的数据（数据量很小，全部载入即可）
export function SharedProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!cloudEnabled)
  const [household, setHousehold] = useState<Household | null>(null)
  const [householdReady, setHouseholdReady] = useState(false)
  const [expenses, setExpenses] = useState<SharedExpense[]>([])
  const [budgets, setBudgets] = useState(new Map<string, number>())
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])

  useEffect(() => {
    if (!cloudEnabled) return
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthReady(true)
    })
  }, [])

  // 找到自己所在的账本
  useEffect(() => {
    setHousehold(null)
    setHouseholdReady(false)
    if (!user) return
    const q = query(collection(fs, 'households'), where('members', 'array-contains', user.uid), limit(1))
    return onSnapshot(
      q,
      { includeMetadataChanges: true }, // 服务器确认写入时也要通知
      (snap) => {
        const d = snap.docs[0]
        // 刚创建、服务器还没确认时先不用，否则订阅子数据会被安全规则拒绝
        if (d?.metadata.hasPendingWrites) return
        setHousehold(d ? ({ id: d.id, ...d.data() } as Household) : null)
        setHouseholdReady(true)
      },
      () => setHouseholdReady(true),
    )
  }, [user])

  // 账本里的支出、预算、取出记录
  const hid = household?.id
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!hid) {
      setExpenses([])
      setBudgets(new Map())
      setWithdrawals([])
      return
    }
    const col = (name: string) => collection(fs, 'households', hid, name)
    // 订阅出错（比如网络或权限短暂异常）时，3 秒后重新订阅
    let timer: ReturnType<typeof setTimeout> | undefined
    const onError = (e: Error) => {
      console.warn('同步中断，稍后重试', e)
      timer ??= setTimeout(() => setRetry((n) => n + 1), 3000)
    }
    const unsubs = [
      onSnapshot(col('expenses'), (s) =>
        setExpenses(
          s.docs
            .map((d) => ({ id: d.id, ...d.data() }) as SharedExpense)
            .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
        ),
        onError,
      ),
      onSnapshot(col('budgets'), (s) => setBudgets(new Map(s.docs.map((d) => [d.id, d.data().amount as number]))), onError),
      onSnapshot(col('withdrawals'), (s) =>
        setWithdrawals(
          s.docs.map((d) => ({ id: d.id, ...d.data() }) as Withdrawal).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
        ),
        onError,
      ),
    ]
    return () => {
      clearTimeout(timer)
      unsubs.forEach((u) => u())
    }
  }, [hid, retry])

  const ready = authReady && (!user || householdReady)

  return (
    <SharedContext.Provider value={{ ready, user, household, expenses, budgets, withdrawals }}>{children}</SharedContext.Provider>
  )
}
