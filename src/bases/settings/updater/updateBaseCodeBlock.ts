import type { TFile, Vault } from 'obsidian';
import type { YAMLCodec } from '../parser/yaml';
import type { BasesQuery, ColumnSizePatch } from '../model/types';
import { findBaseFence, spliceFence, type FenceSelector } from '../parser/fenceLocator';
import { selectView, type ViewSelector } from './selectors';
import { mergeColumnSize } from './merge';
import { ensureQueryId } from '../id/identity';

export interface UpdateBaseCodeBlockOptions {
  file: TFile;
  fence: FenceSelector; // index or {id}
  view?: ViewSelector;
  columnSize?: ColumnSizePatch;
  ensureId?: boolean; // if true, add an id when missing
}

export interface VaultLike {
  read(file: TFile): Promise<string>;
  modify(file: TFile, data: string): Promise<void>;
}

export async function updateBaseCodeBlock(
  vault: Vault | VaultLike,
  yaml: YAMLCodec,
  opts: UpdateBaseCodeBlockOptions
): Promise<void> {
  const vlt: VaultLike = ('read' in vault && 'modify' in vault)
    ? (vault as unknown as VaultLike)
    : ({
        read: (f: TFile) => (vault as Vault).read(f),
        modify: (f: TFile, s: string) => (vault as Vault).modify(f, s)
      } as VaultLike);

  const text = await vlt.read(opts.file);
  const fence = findBaseFence(text, opts.fence, yaml);
  if (!fence) throw new Error('FenceNotFoundError');

  let q: BasesQuery;
  try {
    q = yaml.parse<BasesQuery>(fence.code);
  } catch {
    throw new Error('InvalidYamlError');
  }

  if (opts.ensureId) ensureQueryId(q as unknown as Record<string, unknown>);

  const view = selectView(q, opts.view);
  mergeColumnSize(view, opts.columnSize);

  const newYaml = yaml.stringify(q);
  const updated = spliceFence(text, fence, newYaml);
  if (updated === text) return;
  await vlt.modify(opts.file, updated);
}

