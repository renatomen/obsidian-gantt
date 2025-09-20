/*
 * DHTMLX adapter (Standard Edition, GPLv2)
 * Offline-only: loads assets from local plugin vendor directory.
 */
import type { Plugin } from 'obsidian';

// DHTMLX gantt global (injected by local JS asset)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const gantt: any;

/** Compute a resource URL for a plugin-local asset (desktop and mobile). */
export function getPluginAssetUrl(plugin: Plugin, relativePath: string): string {
  // @ts-expect-error FileSystemAdapter typing
  const adapter = plugin.app.vault.adapter;
  if (!adapter || typeof adapter.getBasePath !== 'function' || typeof adapter.getResourcePath !== 'function') {
    throw new Error('Unsupported adapter for asset loading');
  }
  const base: string = adapter.getBasePath();
  // Join using platform-appropriate separator heuristics without importing 'path'.
  const sep = base.includes('\\') ? '\\' : '/';
  const trimmedBase = base.replace(/[\\/]+$/, '');
  const trimmedRel = relativePath.replace(/^[\\/]+/, '').replace(/[\\/]+/g, sep);
  const abs = `${trimmedBase}${sep}.obsidian${sep}plugins${sep}${plugin.manifest.id}${sep}${trimmedRel}`;
  return adapter.getResourcePath(abs);
}

export async function injectCss(href: string): Promise<void> {
  if ([...document.styleSheets].some((s) => (s as CSSStyleSheet).href === href)) return;
  await new Promise<void>((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
    document.head.appendChild(link);
  });
}

export async function injectScript(src: string): Promise<void> {
  if ([...document.scripts].some((s) => s.src === src)) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

/** Load DHTMLX Gantt assets from the plugin's local vendor directory. */
export async function loadLocalDhtmlx(plugin: Plugin): Promise<void> {
  const css = getPluginAssetUrl(plugin, 'vendor/dhtmlx/dhtmlxgantt.css');
  const js = getPluginAssetUrl(plugin, 'vendor/dhtmlx/dhtmlxgantt.js');
  try {
    await injectCss(css);
  } catch (e) {
    // Try minified filename as alternative
    const altCss = getPluginAssetUrl(plugin, 'vendor/dhtmlx/dhtmlxgantt.min.css');
    await injectCss(altCss);
  }
  try {
    await injectScript(js);
  } catch (e) {
    const altJs = getPluginAssetUrl(plugin, 'vendor/dhtmlx/dhtmlxgantt.min.js');
    await injectScript(altJs);
  }
}

/** Render a simple dummy gantt chart into the provided container element. */
export function renderDummyGantt(containerEl: HTMLElement): void {
  // Ensure container for gantt
  const ganttEl = containerEl.querySelector('.gantt_container') as HTMLElement | null
    ?? containerEl.appendChild(Object.assign(document.createElement('div'), { className: 'gantt_container' }));
  // @ts-ignore depends on injected global
  if (typeof gantt?.init === 'function') {
    // Minimal config to avoid heavy DOM
    // @ts-ignore
    gantt.config.autoscroll = true;
    // @ts-ignore
    gantt.init(ganttEl);
    // @ts-ignore
    gantt.parse({
      data: [
        { id: 1, text: 'Dummy Task A', start_date: '2025-01-01', duration: 3 },
        { id: 2, text: 'Dummy Task B', start_date: '2025-01-04', duration: 2 },
      ],
      links: [
        { id: 1, source: 1, target: 2, type: '0' },
      ],
    });
  } else {
    // Fallback text if assets not loaded
    ganttEl.textContent = 'DHTMLX Gantt assets not loaded. Place Standard Edition files under vendor/dhtmlx.';
    ganttEl.setAttr?.('style', 'padding:8px;color:var(--text-muted);');
  }
}

