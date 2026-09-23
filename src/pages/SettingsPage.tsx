import { useRef, useState } from 'react'
import { db, exportBackup, importBackup, type TxnType } from '../db'
import { useCategoriesByUsage } from '../hooks'
import { today } from '../dates'
import { AccountSection } from '../components/AccountSection'

interface Props {
  onBack: () => void
}

export function SettingsPage({ onBack }: Props) {
  return (
    <main className="page settings">
      <header className="page-header">
        <button className="text-btn back-btn" onClick={onBack}>
          ‹ 返回
        </button>
        <h1>设置</h1>
      </header>
      <AccountSection />
      <CategorySection />
      <BackupSection />
    </main>
  )
}

function CategorySection() {
  const [type, setType] = useState<TxnType>('expense')
  const [icon, setIcon] = useState('')
  const [name, setName] = useState('')
  const categories = useCategoriesByUsage(type)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const order = (await db.categories.count()) + 1
    // 只取输入的第一个字符（emoji）作为图标，不填则用 📦
    const firstChar = [...new Intl.Segmenter().segment(icon.trim())][0]?.segment
    await db.categories.add({ type, name: trimmed, icon: firstChar || '📦', order })
    setIcon('')
    setName('')
  }

  async function remove(id: number, label: string) {
    if (!confirm(`删除分类“${label}”？已经记下的账不受影响。`)) return
    await db.categories.update(id, { archived: true })
  }

  return (
    <section className="settings-section">
      <h2>个人账本分类</h2>
      <div className="segmented" role="tablist">
        {(['expense', 'income'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={type === t} onClick={() => setType(t)}>
            {t === 'expense' ? '支出' : '收入'}
          </button>
        ))}
      </div>
      <ul className="cat-list">
        {categories?.map((c) => (
          <li key={c.id}>
            <span className="emoji">{c.icon}</span>
            <span className="cat-name">{c.name}</span>
            <button className="text-btn danger" onClick={() => remove(c.id!, c.name)} disabled={categories.length <= 1}>
              删除
            </button>
          </li>
        ))}
      </ul>
      <form className="cat-add" onSubmit={add}>
        <input className="cat-add-icon" placeholder="📦" value={icon} onChange={(e) => setIcon(e.target.value)} aria-label="图标（emoji）" />
        <input placeholder="新分类名称" value={name} maxLength={8} onChange={(e) => setName(e.target.value)} aria-label="分类名称" />
        <button type="submit" disabled={!name.trim()}>
          添加
        </button>
      </form>
    </section>
  )
}

function BackupSection() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')

  async function doExport() {
    const blob = await exportBackup()
    const file = new File([blob], `记账备份-${today()}.json`, { type: 'application/json' })
    // 手机上优先用系统分享面板（可存到“文件”、网盘或发给自己）
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    URL.revokeObjectURL(url)
  }

  async function doImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!confirm('导入会用备份替换现在的全部数据，确定继续？')) return
    try {
      const n = await importBackup(file)
      setMessage(`已导入 ${n} 条记录`)
    } catch (err) {
      setMessage((err as Error).message)
    }
  }

  return (
    <section className="settings-section">
      <h2>个人账本备份</h2>
      <p className="hint">个人账本只保存在这台手机上（生活费和存钱罐在云端，不用备份）。建议定期导出备份，换手机时用“导入备份”恢复。</p>
      <div className="backup-actions">
        <button onClick={doExport}>导出备份</button>
        <button onClick={() => fileRef.current?.click()}>导入备份</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={doImport} />
      </div>
      {message && <p className="hint" role="status">{message}</p>}
    </section>
  )
}
