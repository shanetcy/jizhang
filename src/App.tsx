import { useEffect, useState } from 'react'
import { requestPersist } from './db'
import { currentMonth } from './dates'
import { SharedProvider } from './SharedContext'
import { EntrySheet, type SheetTarget } from './components/EntrySheet'
import { ListPage } from './pages/ListPage'
import { SharedPage } from './pages/SharedPage'
import { PiggyPage } from './pages/PiggyPage'
import { StatsPage } from './pages/StatsPage'
import { SettingsPage } from './pages/SettingsPage'

type Tab = 'list' | 'shared' | 'piggy' | 'stats'

const TABS: { key: Tab; label: string }[] = [
  { key: 'list', label: '明细' },
  { key: 'shared', label: '生活费' },
  { key: 'piggy', label: '存钱罐' },
  { key: 'stats', label: '统计' },
]

export default function App() {
  return (
    <SharedProvider>
      <Main />
    </SharedProvider>
  )
}

function Main() {
  const [tab, setTab] = useState<Tab>('list')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [month, setMonth] = useState(currentMonth())
  // 记账面板：null 表示关闭
  const [sheet, setSheet] = useState<SheetTarget | null>(null)

  useEffect(requestPersist, [])

  if (settingsOpen) return <SettingsPage onBack={() => setSettingsOpen(false)} />

  const openSettings = () => setSettingsOpen(true)
  const tabButton = (t: (typeof TABS)[number]) => (
    <button key={t.key} aria-current={tab === t.key ? 'page' : undefined} onClick={() => setTab(t.key)}>
      {t.label}
    </button>
  )

  return (
    <>
      {tab === 'list' && <ListPage month={month} onMonthChange={setMonth} onEdit={(txn) => setSheet({ kind: 'personal', txn })} />}
      {tab === 'shared' && (
        <SharedPage
          month={month}
          onMonthChange={setMonth}
          onEdit={(exp) => setSheet({ kind: 'shared', exp })}
          onOpenSettings={openSettings}
        />
      )}
      {tab === 'piggy' && <PiggyPage onOpenSettings={openSettings} />}
      {tab === 'stats' && <StatsPage month={month} onMonthChange={setMonth} onOpenSettings={openSettings} />}

      <nav className="tabbar">
        {TABS.slice(0, 2).map(tabButton)}
        <button
          className="add-btn"
          aria-label="记一笔"
          onClick={() => setSheet({ kind: 'new', ledger: tab === 'shared' ? 'shared' : 'personal' })}
        >
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </button>
        {TABS.slice(2).map(tabButton)}
      </nav>

      {sheet && <EntrySheet target={sheet} onClose={() => setSheet(null)} />}
    </>
  )
}
