import type { ReactNode } from "react";
import { useImageOk } from "./ssr.ts";

const IMG = "/images/plugins/";

/** 页面横幅:图在右、标题压在左侧留白上;图缺失或加载失败时退回纯文字,不留破图。 */
export function PageHero({ kind, title, lead, children }: { kind: "hero" | "hero-journals" | "hero-submission"; title: string; lead: string; children?: ReactNode }) {
  const [ok, ref, fail] = useImageOk();
  return (
    <header className={ok ? "page-hero has-art" : "page-hero"}>
      {ok && (
        <picture className="page-hero-art" aria-hidden>
          <source media="(prefers-color-scheme: dark)" srcSet={`${IMG}${kind}-dark.webp`} />
          <img ref={ref} src={`${IMG}${kind}-light.webp`} alt="" width={2400} height={720} decoding="async" onError={fail} />
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
