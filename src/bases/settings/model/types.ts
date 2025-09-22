export interface BasesQuery {
  views?: BasesView[];
  [k: string]: unknown;
}

export interface BasesView {
  name?: string;
  type?: string;
  columnSize?: Record<string, number>;
  [k: string]: unknown;
}

export type ColumnSizePatch = Record<string, number>;

