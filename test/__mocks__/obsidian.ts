type JSONValue = string | number | boolean | null | { [key: string]: JSONValue } | JSONValue[];

export function parseYaml(text: string): unknown {
  // Use yaml package in tests
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const yaml = require('yaml');
  return yaml.parse(text);
}

export function stringifyYaml(value: JSONValue): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const yaml = require('yaml');
  return yaml.stringify(value);
}
