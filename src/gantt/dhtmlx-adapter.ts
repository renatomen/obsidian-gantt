/*
 * DHTMLX adapter (Standard Edition, GPLv2)
 * Offline-only: loads assets from local plugin vendor directory.
 */
import type { Plugin } from 'obsidian';

// Bundle DHTMLX JS into our plugin to avoid CSP on external <script> tags.
// @ts-ignore - UMD script defines window.gantt
import '../../vendor/dhtmlx/dhtmlxgantt.min.js';

// DHTMLX gantt global (provided by bundled script)
declare const gantt:
  | {
      init?: (el: HTMLElement) => void;
      parse?: (payload: { data: Array<Record<string, unknown>>; links?: Array<Record<string, unknown>> }) => void;
      config?: Record<string, unknown>;
    }
  | undefined;

/** Inject CSS text inline (allowed by style-src 'unsafe-inline'). */
async function injectInlineCss(cssText: string, id = 'ogantt-dhtmlx-css'): Promise<void> {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = cssText;
  document.head.appendChild(style);
}

/** Read a text file from the vault relative path. */
async function readVaultText(plugin: Plugin, vaultRelativePath: string): Promise<string> {
  // Use POSIX separators for adapter paths
  const p = vaultRelativePath.replace(/\\/g, '/');
  return await plugin.app.vault.adapter.read(p);
}

/** Load DHTMLX Gantt assets from the plugin's local vendor directory. */
export async function loadLocalDhtmlx(plugin: Plugin): Promise<void> {
  // Prefer minified CSS; fall back to non-minified if missing
  const base = `.obsidian/plugins/${plugin.manifest.id}/vendor/dhtmlx/`;
  let cssText: string | null = null;
  try {
    cssText = await readVaultText(plugin, `${base}dhtmlxgantt.min.css`);
  } catch {
    try {
      cssText = await readVaultText(plugin, `${base}dhtmlxgantt.css`);
    } catch {
      // leave null; will be handled below
    }
  }
  if (cssText) {
    await injectInlineCss(cssText);
  } else {
    // Not fatal; JS is bundled, chart can still render with default styles (ugly)
    console.warn('obsidian-gantt: DHTMLX CSS not found under vendor/dhtmlx');
  }
}

/** Render a simple dummy gantt chart into the provided container element. */
export function renderDummyGantt(containerEl: HTMLElement): void {
  // Ensure container for gantt
  const ganttEl = containerEl.querySelector('.gantt_container') as HTMLElement | null
    ?? containerEl.appendChild(Object.assign(document.createElement('div'), { className: 'gantt_container' }));
  // Ensure the inner container fills the root container height
  (ganttEl as HTMLElement).style.height = '100%';
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

