export type ColumnKind = 'builtin' | 'property';

export type BuiltinKey = 'text' | 'start_date' | 'end_date' | 'duration' | 'progress' | 'parent';

export type ColumnSpec = {
  kind: ColumnKind;
  id: string; // unique stable id for the column
  label: string;
  width?: number;
  // For property columns
  propertyKey?: string; // dotted path like note.due, file.name, or plain frontmatter key
  // For built-in columns
  builtinKey?: BuiltinKey;
};

export type ColumnLayout = {
  columns: ColumnSpec[];
};

