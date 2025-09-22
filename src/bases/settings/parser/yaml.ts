export interface YAMLCodec {
  parse<T = unknown>(text: string): T;
  stringify(obj: unknown): string;
}

// A no-op JSON-based codec useful for tests. Not real YAML.
export const JsonLikeCodec: YAMLCodec = {
  parse: (text) => JSON.parse(text) as unknown,
  stringify: (obj) => JSON.stringify(obj, null, 2),
};

