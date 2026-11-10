import { Link } from "../link.tsx";
import { DownloadIcon } from "../icons.tsx";
import { OFFICIAL } from "./official.ts";

/**
 * 社区官方插件的单独展示位。放在插件广场与首页的固定位置,与插件目录分开:
 * 不进排序结果、不参与筛选与计数,也不显示星标、下载数等目录里的指标。
 */
export function OfficialBox({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={compact ? "official-box official-compact" : "official-box"} aria-label="社区官方插件">
      <picture className="official-icon" aria-hidden>
        <source media="(prefers-color-scheme: dark)" srcSet="/brand/logo-mark-dark.png" />
        <img src="/brand/logo-mark-light.png" alt="" width={48} height={48} decoding="async" />
      </picture>
      <div className="official-body">
        <p className="official-badge">{OFFICIAL.badge}</p>
        <h2 className="official-name">{OFFICIAL.name}</h2>
        <p className="official-summary">{OFFICIAL.summary}</p>
        <p className="meta official-facts">
          <span>当前版本 v{OFFICIAL.version}</span>
          <span>{OFFICIAL.compatText}</span>
        </p>
      </div>
      <div className="official-actions">
        <a className="btn" href={OFFICIAL.releaseUrl} target="_blank" rel="noopener noreferrer">
          <DownloadIcon size={14} /> 下载安装
        </a>
        <Link to={OFFICIAL.pagePath} className="btn btn-ghost">安装教程</Link>
      </div>
    </aside>
  );
}
