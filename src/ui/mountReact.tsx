import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

export function mountReact(el: HTMLElement, node: React.ReactNode): () => void {
  const root: Root = createRoot(el);
  root.render(node);
  return () => {
    try { root.unmount(); } catch {}
  };
}

