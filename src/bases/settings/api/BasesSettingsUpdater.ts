import type { TFile, Vault } from 'obsidian';
import type { YAMLCodec } from '../parser/yaml';
import type { ColumnSizePatch } from '../model/types';
import { updateBaseFile } from '../updater/updateBaseFile';
import { updateBaseCodeBlock } from '../updater/updateBaseCodeBlock';
import type { FenceSelector } from '../parser/fenceLocator';
import type { ViewSelector } from '../updater/selectors';

export class BasesSettingsUpdater {
  constructor(private readonly vault: Vault, private readonly yaml: YAMLCodec) {}

  async updateBaseFile(opts: { file: TFile; view?: ViewSelector; columnSize?: ColumnSizePatch }): Promise<void> {
    return updateBaseFile(this.vault, this.yaml, opts);
  }

  async updateBaseCodeBlock(opts: { file: TFile; fence: FenceSelector; view?: ViewSelector; columnSize?: ColumnSizePatch; ensureId?: boolean }): Promise<void> {
    return updateBaseCodeBlock(this.vault, this.yaml, opts);
  }
}

