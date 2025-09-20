export type GanttConfigInput = Partial<{
  tasksField: string;
  startField: string;
  endField: string;
  idField: string;
  titleField: string;
}>;

export type GanttConfig = {
  tasksField: string;
  startField: string;
  endField: string;
  idField: string;
  titleField: string;
};

const REQUIRED_FIELDS = ['tasksField', 'startField', 'endField'] as const;

type RequiredField = (typeof REQUIRED_FIELDS)[number];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function validateGanttConfig(input: GanttConfigInput): GanttConfig {
  const missing = REQUIRED_FIELDS.filter((k) => input == null || (input as any)[k] == null);
  if (missing.length === REQUIRED_FIELDS.length) {
    throw new Error(`${REQUIRED_FIELDS.join(',')} are required`);
  }
  if (missing.length > 0) {
    throw new Error(`${missing.join(',')} are required`);
  }

  for (const key of REQUIRED_FIELDS) {
    const val = (input as any)[key];
    if (!isNonEmptyString(val)) {
      throw new Error(`${key} must be a non-empty string`);
    }
  }

  return {
    tasksField: (input as any).tasksField,
    startField: (input as any).startField,
    endField: (input as any).endField,
    idField: isNonEmptyString((input as any).idField) ? (input as any).idField : 'id',
    titleField: isNonEmptyString((input as any).titleField) ? (input as any).titleField : 'title',
  };
}

