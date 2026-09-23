import { cloudEnabled } from '../cloud'

// 还没登录或还没有共同账本时，生活费和存钱罐页显示的引导
export function SetupPrompt({ onOpenSettings }: { onOpenSettings: () => void }) {
  if (!cloudEnabled) {
    return <p className="empty">云同步还没设置好，暂时只能用个人账本。</p>
  }
  return (
    <div className="setup-prompt">
      <p>和伴侣一起记生活费，月底自动算好谁该转给谁，结余存进存钱罐。</p>
      <button className="primary-btn" onClick={onOpenSettings}>
        登录并创建共同账本
      </button>
    </div>
  )
}
