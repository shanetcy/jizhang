import { PROFILE_EMOJIS, type Profile } from '../cloud'

interface Props {
  value: Profile
  onChange: (p: Profile) => void
  taken?: string // 伴侣已经用了的符号
}

// 选一个代表自己的可爱符号，再起个昵称
export function ProfilePicker({ value, onChange, taken }: Props) {
  return (
    <div className="profile-picker">
      <div className="emoji-grid" role="radiogroup" aria-label="选一个符号">
        {PROFILE_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={value.emoji === e}
            disabled={e === taken}
            onClick={() => onChange({ ...value, emoji: e })}
          >
            {e}
          </button>
        ))}
      </div>
      <input
        className="field"
        placeholder="昵称，比如：小兔"
        value={value.name}
        maxLength={8}
        onChange={(ev) => onChange({ ...value, name: ev.target.value })}
        aria-label="昵称"
      />
    </div>
  )
}
