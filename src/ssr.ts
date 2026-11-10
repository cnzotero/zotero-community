// 构建时预渲染(服务端渲染)与浏览器共用的「当前地址」与「当前时间」。
// 预渲染时没有 window/location:由预渲染入口设置要渲染的地址和构建日期;浏览器里读真实地址。
// 时间先用构建日期,保证接管(水合)时与静态页面一致;接管完成后再换成当前时间。
import { useEffect, useRef, useState, type RefObject } from "react";

interface ServerLocation {
  path: string;
  search: string;
  /** 构建日期 YYYY-MM-DD */
  now: string;
}

let server: ServerLocation | null = null;
let live = false;

export function setServerLocation(v: ServerLocation | null): void {
  server = v;
}

export const isServer = (): boolean => server !== null;
export const currentPath = (): string => (server ? server.path : location.pathname);
export const currentSearch = (): string => (server ? server.search : location.search);

/** 构建日期 YYYY-MM-DD:预渲染时由入口注入,浏览器里从静态页面读取(不随访问时间变化);取不到返回空串。 */
export function buildDate(): string {
  if (server) return server.now;
  if (typeof document === "undefined") return "";
  return document.getElementById("root")?.dataset.now ?? "";
}

function initialNow(): Date {
  if (server) return new Date(server.now);
  if (live) return new Date();
  const d = document.getElementById("root")?.dataset.now;
  return d ? new Date(d) : new Date();
}

/** 用于「几天前」「近 30 天」等计算的当前时间:首次渲染与静态页面一致,挂载后换成真实时间。 */
export function useNow(): Date {
  const [s, setS] = useState(() => ({ now: initialNow(), fresh: live }));
  useEffect(() => {
    live = true;
    if (!s.fresh) setS({ now: new Date(), fresh: true });
  }, []);
  return s.now;
}

/**
 * 图片加载失败时隐藏。静态页面里的图片可能在前端接管之前就已失败(那时 onError 还没挂上),
 * 所以挂载后再检查一次。
 */
export function useImageOk(): [boolean, RefObject<HTMLImageElement | null>, () => void] {
  const [ok, setOk] = useState(true);
  const ref = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0 && img.getAttribute("src")) setOk(false);
  }, []);
  return [ok, ref, () => setOk(false)];
}
