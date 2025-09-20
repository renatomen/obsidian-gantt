export type BasesContainerLike = {
  viewContainerEl?: HTMLElement;
  containerEl?: HTMLElement;
  results?: Map<unknown, unknown>;
  query?: { on?: (event: string, cb: (...args: unknown[]) => void) => void; off?: (event: string, cb: (...args: unknown[]) => void) => void };
  controller?: { runQuery?: () => Promise<void> | void; getViewConfig?: (key?: string) => unknown };
};

