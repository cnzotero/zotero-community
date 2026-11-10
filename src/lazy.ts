// 路由组件按需加载。与预渲染兼容的关键:组件一旦加载完就直接渲染真组件,
// 预渲染前、以及浏览器接管静态页面前都会先把当前页面的组件加载好,所以接管时不会出现「加载中」。
import { createElement, lazy, type ComponentType } from "react";

export interface LazyRoute<P extends object> {
  (props: P): ReturnType<typeof createElement>;
  preload: () => Promise<void>;
}

export function lazyRoute<P extends object = Record<string, never>>(load: () => Promise<ComponentType<P>>): LazyRoute<P> {
  let Comp: ComponentType<P> | null = null;
  let pending: Promise<void> | null = null;
  const preload = () =>
    (pending ??= load().then(
      (c) => { Comp = c; },
      (e) => { pending = null; throw e; },
    ));
  const Lazy = lazy(() => preload().then(() => ({ default: Comp as ComponentType<P> })));
  const Route = (props: P) => (Comp ? createElement(Comp, props) : createElement(Lazy as ComponentType<P>, props));
  return Object.assign(Route, { preload });
}
