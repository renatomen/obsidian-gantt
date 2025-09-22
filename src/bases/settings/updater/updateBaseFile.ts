import type { TFile, Vault } from 'obsidian';
import type { YAMLCodec } from '../parser/yaml';
import type { BasesQuery, ColumnSizePatch } from '../model/types';
import { selectView, type ViewSelector } from './selectors';
import { mergeColumnSize } from './merge';

export interface VaultLike {
  read(file: TFile): Promise<string>;
  modify(file: TFile, data: string): Promise<void>;
}

export interface UpdateBaseFileOptions {
  file: TFile;
  view?: ViewSelector;
  columnSize?: ColumnSizePatch;
}

export async function updateBaseFile(
  vault: Vault | VaultLike,
  yaml: YAMLCodec,
  opts: UpdateBaseFileOptions
): Promise<void> {
  const vlt: VaultLike = ('read' in vault && 'modify' in vault)
    ? (vault as unknown as VaultLike)
    : ({
        read: (f: TFile) => (vault as Vault).read(f),
        modify: (f: TFile, s: string) => (vault as Vault).modify(f, s)
      } as VaultLike);

  const raw = await vlt.read(opts.file);
  let parsed: BasesQuery;
  try {
    parsed = yaml.parse<BasesQuery>(raw);
  } catch {
    throw new Error('InvalidYamlError');
  }

  const view = selectView(parsed, opts.view);
  mergeColumnSize(view, opts.columnSize);

  const out = yaml.stringify(parsed);
  if (typeof out !== 'string' || out.trim().length === 0) {
    throw new Error('StringifyError');
  }
  if (out === raw) return; // no change
  await vlt.modify(opts.file, out);
}

