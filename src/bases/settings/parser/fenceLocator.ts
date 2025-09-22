import type { YAMLCodec } from './yaml';

export type FenceSelector = number | { id: string };

export interface BaseFence {
  start: number; // start index of opening ```base line
  end: number;   // index just after closing ``` line
  code: string;  // inner YAML text only
}

/**
 * Find the nth or id-matching ```base fenced block in a markdown document.
 * - CRLF/LF agnostic
 * - Returns the first match for id if multiple share same id.
 */
export function findBaseFence(text: string, selector: FenceSelector, yaml?: YAMLCodec): BaseFence | null {
  const reFenceOpen = /(^|\n)```base\s*(?:\n|\r\n)/g;
  let match: RegExpExecArray | null;
  const candidates: BaseFence[] = [];

  while ((match = reFenceOpen.exec(text)) !== null) {
    const openIdx = match.index + (match[1] ? match[1].length : 0);
    const afterOpen = reFenceOpen.lastIndex; // position after the opening line

    const closeRe = /(^|\n)```\s*(?:\n|\r\n|$)/g;
    closeRe.lastIndex = afterOpen;
    const closeMatch = closeRe.exec(text);
    if (!closeMatch) break; // unclosed fence; stop scanning to be safe

    const closeIdx = closeMatch.index + (closeMatch[1] ? closeMatch[1].length : 0);
    const code = text.slice(afterOpen, closeIdx);
    candidates.push({ start: openIdx, end: closeIdx + closeMatch[0].length - (closeMatch[1]?.length ?? 0), code });

    reFenceOpen.lastIndex = closeIdx + closeMatch[0].length;
  }

  if (typeof selector === 'number') {
    const idx = selector < 0 ? 0 : selector;
    return candidates[idx] ?? null;
  }

  const id = selector.id;
  if (!id) return null;
  for (const f of candidates) {
    try {
      const parsed = yaml?.parse<Record<string, unknown>>(f.code);
      const idVal = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>)['id'] : undefined;
      if (typeof idVal === 'string' && idVal === id) {
        return f;
      }
    } catch {
      // ignore parse errors and continue
    }
  }
  return null;
}

export function spliceFence(text: string, fence: BaseFence, newYaml: string): string {
  const before = text.slice(0, fence.start);
  const openLineMatch = /(^|\n)```base\s*(?:\n|\r\n)/.exec(text.slice(fence.start));
  if (!openLineMatch) return text; // should not happen

  const after = text.slice(fence.end);
  const body = newYaml.endsWith('\n') ? newYaml : newYaml + '\n';
  return before + openLineMatch[0] + body + '```\n' + after;
}

