import { findBaseFence } from '../../../src/bases/settings/parser/fenceLocator';
import type { YAMLCodec } from '../../../src/bases/settings/parser/yaml';

const JsonCodec: YAMLCodec = {
  parse: (t) => JSON.parse(t),
  stringify: (o) => JSON.stringify(o),
};

const md = [
  'Intro',
  '```base',
  '{"id":"alpha","views":[{"name":"A"}]}',
  '```',
  '',
  'Middle',
  '```base',
  '{"id":"beta","views":[{"name":"B"}]}',
  '```',
  'Outro',
].join('\n');

describe('findBaseFence', () => {
  test('finds by index', () => {
    const f0 = findBaseFence(md, 0);
    const f1 = findBaseFence(md, 1);
    expect(f0?.code.includes('alpha')).toBe(true);
    expect(f1?.code.includes('beta')).toBe(true);
  });

  test('finds by id with YAML codec', () => {
    const fa = findBaseFence(md, { id: 'alpha' }, JsonCodec);
    const fb = findBaseFence(md, { id: 'beta' }, JsonCodec);
    expect(fa?.code).toContain('alpha');
    expect(fb?.code).toContain('beta');
  });
});

