import type { MouseEvent, ReactNode } from "react";
import { navigate, prefetchPath } from "./router.ts";

export function Link({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to);
  };
  // 鼠标移上、键盘聚焦、手指按下时就开始下载目标页面,点下去时多半已经就绪
  const warm = () => { void prefetchPath(to); };
  return (
    <a href={to} onClick={onClick} onMouseEnter={warm} onFocus={warm} onTouchStart={warm} className={className}>
      {children}
    </a>
  );
}
