import { parse as yamlParse, stringify as yamlStringify } from 'yaml';

export function parseYaml(text: string): unknown {
  return yamlParse(text);
}

export function stringifyYaml(value: unknown): string {
  return yamlStringify(value);
}

