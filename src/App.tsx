import { useEffect, useState } from 'react'
import type { Txn } from './db'
import { requestPersist } from './db'
import { currentMonth } from './dates'
import { EntrySheet } from './components/EntrySheet'
import { ListPage } from './pages/ListPage'
import { StatsPage } from './pages/StatsPage'
import { SettingsPage } from './pages/SettingsPage'

type Tab = 'list' | 'stats' | 'settings'

export default function App() {
  const [tab, setTab] = useState<Tab>('list')
  const [month, setMonth] = useState(currentMonth())
  // 记账面板：null 关闭，'new' 新记一笔，Txn 编辑这笔
  const [sheet, setSheet] = useState<Txn | 'new' | null>(null)

  useEffect(requestPersist, [])

  if (tab === 'settings') return <SettingsPage onBack={() => setTab('stats')} />

  return (
    <>
      {tab === 'list' ? (
        <ListPage month={month} onMonthChange={setMonth} onEdit={setSheet} />
      ) : (
        <StatsPage month={month} onMonthChange={setMonth} onOpenSettings={() => setTab('settings')} />
      )}

      <nav className="tabbar">
        <button aria-current={tab === 'list' ? 'page' : undefined} onClick={() => setTab('list')}>
          明细
        </button>
        <button className="add-btn" aria-label="记一笔" onClick={() => setSheet('new')}>
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
        <button aria-current={tab === 'stats' ? 'page' : undefined} onClick={() => setTab('stats')}>
          统计
        </button>
      </nav>

      {sheet && <EntrySheet editing={sheet === 'new' ? null : sheet} onClose={() => setSheet(null)} />}
    </>
  )
}
