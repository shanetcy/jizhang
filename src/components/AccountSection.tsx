import { useState } from 'react'
import {
  cloudEnabled,
  createHousehold,
  joinHousehold,
  logOut,
  resetPassword,
  signIn,
  signUp,
  updateProfile,
  type Profile,
} from '../cloud'
import { useShared } from '../SharedContext'
import { ProfilePicker } from './ProfilePicker'

// 设置页里的“共同账本”：登录 → 创建或加入 → 邀请伴侣 / 修改自己的符号
export function AccountSection() {
  const { ready, user, household } = useShared()
  if (!cloudEnabled) {
    return (
      <section className="settings-section">
        <h2>共同账本</h2>
        <p className="hint">云同步还没设置好，暂时只能用个人账本。</p>
      </section>
    )
  }
  if (!ready) return null
  return (
    <section className="settings-section">
      <h2>共同账本</h2>
      {!user ? <AuthForm /> : !household ? <CreateOrJoin uid={user.uid} /> : <HouseholdInfo />}
    </section>
  )
}

function AuthForm() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      await (mode === 'signIn' ? signIn(email, pw) : signUp(email, pw))
    } catch (err) {
      setMsg((err as Error).message)
    }
    setBusy(false)
  }

  async function forgot() {
    if (!email) return setMsg('先填上邮箱，再点“忘记密码”')
    try {
      await resetPassword(email)
      setMsg('重设密码的邮件已发送，请查收邮箱')
    } catch (err) {
      setMsg((err as Error).message)
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <p className="hint">登录后，你和伴侣就能在各自的手机上一起记生活费。个人账本不会上传。</p>
      <div className="segmented" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'signIn'} onClick={() => setMode('signIn')}>
          登录
        </button>
        <button type="button" role="tab" aria-selected={mode === 'signUp'} onClick={() => setMode('signUp')}>
          注册
        </button>
      </div>
      <input
        className="field"
        type="email"
        autoComplete="email"
        placeholder="邮箱"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="field"
        type="password"
        autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
        placeholder={mode === 'signIn' ? '密码' : '密码（至少 6 位）'}
        value={pw}
        onChange={(e) => setPw(e.target.value)}
      />
      {msg && (
        <p className="hint" role="status">
          {msg}
        </p>
      )}
      <div className="row-actions">
        <button className="primary-btn" type="submit" disabled={busy || !email || !pw}>
          {mode === 'signIn' ? '登录' : '注册'}
        </button>
        {mode === 'signIn' && (
          <button className="text-btn" type="button" onClick={forgot}>
            忘记密码
          </button>
        )}
      </div>
    </form>
  )
}

function CreateOrJoin({ uid }: { uid: string }) {
  const [profile, setProfile] = useState<Profile>({ emoji: '🐰', name: '' })
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const ok = profile.name.trim().length > 0

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setMsg('')
    try {
      await fn()
    } catch (err) {
      setMsg((err as Error).message)
      setBusy(false)
    }
  }

  const p = { ...profile, name: profile.name.trim() }

  return (
    <div className="create-join">
      <p className="hint">先选一个代表你的符号，再起个昵称。</p>
      <ProfilePicker value={profile} onChange={setProfile} />

      <div className="join-row">
        <input
          className="field num"
          placeholder="伴侣给的邀请码"
          value={code}
          maxLength={6}
          autoCapitalize="characters"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          aria-label="邀请码"
        />
        <button className="primary-btn" disabled={busy || !ok || code.length !== 6} onClick={() => run(() => joinHousehold(uid, code, p))}>
          加入
        </button>
      </div>
      <p className="hint">还没有共同账本？由一个人创建，再把邀请码发给另一个人。</p>
      <button className="secondary-btn" disabled={busy || !ok} onClick={() => run(() => createHousehold(uid, p))}>
        创建共同账本
      </button>
      {msg && (
        <p className="form-error" role="alert">
          {msg}
        </p>
      )}
      <button className="text-btn" onClick={logOut}>
        退出登录
      </button>
    </div>
  )
}

function HouseholdInfo() {
  const { user, household } = useShared()
  const h = household!
  const me = user!.uid
  const partner = h.members.find((m) => m !== me)
  const [editing, setEditing] = useState(false)
  const [profile, setProfile] = useState<Profile>(h.profiles[me] ?? { emoji: '🐰', name: '' })

  return (
    <div className="household-info">
      <ul className="members">
        {h.members.map((uid) => (
          <li key={uid}>
            <span className="person-emoji">{h.profiles[uid]?.emoji}</span>
            <span className="cat-name">
              {h.profiles[uid]?.name}
              {uid === me && <span className="me-tag">我</span>}
            </span>
            {uid === me && !editing && (
              <button className="text-btn" onClick={() => setEditing(true)}>
                修改
              </button>
            )}
          </li>
        ))}
      </ul>

      {editing && (
        <div className="create-join">
          <ProfilePicker value={profile} onChange={setProfile} taken={partner ? h.profiles[partner]?.emoji : undefined} />
          <div className="row-actions">
            <button
              className="primary-btn"
              disabled={!profile.name.trim()}
              onClick={() => {
                updateProfile(h.id, me, { ...profile, name: profile.name.trim() })
                setEditing(false)
              }}
            >
              保存
            </button>
            <button className="text-btn" onClick={() => setEditing(false)}>
              取消
            </button>
          </div>
        </div>
      )}

      {!partner && (
        <div className="invite">
          <p className="hint">把这个邀请码发给伴侣，Ta 登录后在这里输入就能加入：</p>
          <p className="invite-code num">{h.inviteCode}</p>
        </div>
      )}

      <p className="hint">已登录：{user!.email}</p>
      <button className="text-btn" onClick={() => confirm('退出登录？生活费数据会保留在云端，重新登录就能看到。') && logOut()}>
        退出登录
      </button>
    </div>
  )
}
