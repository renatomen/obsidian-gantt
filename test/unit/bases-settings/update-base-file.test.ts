import type { TFile } from 'obsidian';
import { updateBaseFile } from '../../../src/bases/settings/updater/updateBaseFile';
import { JsonLikeCodec } from '../../../src/bases/settings/parser/yaml';

function makeFile(path: string): TFile {
  return { path } as unknown as TFile;
}

describe('updateBaseFile', () => {
  test('merges columnSize into first view when none specified', async () => {
    const file = makeFile('test.base');
    const initial = JSON.stringify({ views: [{ name: 'Default', type: 'table' }] }, null, 2);

    const writes: string[] = [];
    const vault: { read: (f: TFile) => Promise<string>; modify: (f: TFile, data: string) => Promise<void> } = {
      read: async (_: TFile) => initial,
      modify: async (_: TFile, data: string) => { writes.push(data); },
    };

    await updateBaseFile(vault, JsonLikeCodec, {
      file,
      columnSize: { title: 240, status: 180 }
    });

    expect(writes.length).toBe(1);
    const out = JSON.parse(writes[0]);
    expect(out.views[0].columnSize).toEqual({ title: 240, status: 180 });
  });

  test('selects view by name', async () => {
    const file = makeFile('test.base');
    const initial = JSON.stringify({ views: [{ name: 'A' }, { name: 'B' }] }, null, 2);
    const writes: string[] = [];
    const vault: { read: (f: TFile) => Promise<string>; modify: (f: TFile, data: string) => Promise<void> } = {
      read: async () => initial,
      modify: async (_: TFile, data: string) => { writes.push(data); },
    };

    await updateBaseFile(vault, JsonLikeCodec, {
      file,
      view: 'B',
      columnSize: { foo: 100 }
    });

    const out = JSON.parse(writes[0]);
    expect(out.views[0].columnSize).toBeUndefined();
    expect(out.views[1].columnSize).toEqual({ foo: 100 });
  });
});

