// 页面预取:鼠标移上链接、手指按下、浏览器空闲时先把目标页面的代码与数据下载好,
// 点击时已就绪就立刻切换;没就绪就留在原页面,等下载完成(或超时)再切换,不再整页闪「正在加载」。
// 不依赖 DOM 与 React,便于单测;具体怎么加载由 App 注册(setPrefetchLoader)。

type Loader = (key: string) => Promise<unknown>;

let loader: Loader | null = null;
const done = new Set<string>();
const inflight = new Map<string, Promise<void>>();

/** 注册「按页面键加载代码与数据」的函数(App 模块加载时调用一次)。 */
export function setPrefetchLoader(fn: Loader | null): void {
  loader = fn;
  done.clear();
  inflight.clear();
}

/**
 * 开始预取某个页面。已经加载好、或还没有注册加载函数时返回 null(调用方可以直接切换);
 * 否则返回「加载完成」的 Promise:同一页面重复调用共用一次加载;加载失败时 Promise 照常结束
 * (不抛错,也不记为已加载,下次还会重试),页面自己的加载逻辑会在切换后再次尝试并处理错误。
 */
export function prefetch(key: string): Promise<void> | null {
  if (!loader || done.has(key)) return null;
  let p = inflight.get(key);
  if (!p) {
    p = loader(key).then(
      () => { done.add(key); inflight.delete(key); },
      () => { inflight.delete(key); },
    );
    inflight.set(key, p);
  }
  return p;
}

/** 等一个 Promise,但最多等 ms 毫秒(超时就当作完成,不让点击一直没有反应)。 */
export function waitUpTo(p: Promise<unknown>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    p.then(() => { clearTimeout(t); resolve(); });
  });
}

/** 数据节省模式或慢速网络下不做空闲预取。 */
export function shouldIdlePrefetch(conn: { saveData?: boolean; effectiveType?: string } | undefined): boolean {
  if (!conn) return true;
  if (conn.saveData) return false;
  return !/^(slow-2g|2g)$/.test(conn.effectiveType ?? "");
}
