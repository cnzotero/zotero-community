import { useState, type ReactNode } from "react";

const IMG = "/images/plugins/";

/** 页面横幅:图在右、标题压在左侧留白上;图缺失或加载失败时退回纯文字,不留破图。 */
export function PageHero({ kind, title, lead, children }: { kind: "hero" | "hero-journals" | "hero-submission"; title: string; lead: string; children?: ReactNode }) {
  const [ok, setOk] = useState(true);
  return (
    <header className={ok ? "page-hero has-art" : "page-hero"}>
      {ok && (
        <picture className="page-hero-art" aria-hidden>
          <source media="(prefers-color-scheme: dark)" srcSet={`${IMG}${kind}-dark.png`} />
          <img src={`${IMG}${kind}-light.png`} alt="" decoding="async" onError={() => setOk(false)} />
        </picture>
      )}
      <div className="page-hero-body">
        <h1 className="page-title">{title}</h1>
        <p className="lead">{lead}</p>
        {children}
      </div>
    </header>
  );
}
