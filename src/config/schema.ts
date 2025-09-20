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

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function validateGanttConfig(input: GanttConfigInput): GanttConfig {
  const allMissing =
    input.tasksField == null && input.startField == null && input.endField == null;
  if (allMissing) {
    throw new Error('tasksField,startField,endField are required');
  }

  if (!isNonEmptyString(input.tasksField)) {
    throw new Error('tasksField must be a non-empty string');
  }
  if (!isNonEmptyString(input.startField)) {
    throw new Error('startField must be a non-empty string');
  }
  if (!isNonEmptyString(input.endField)) {
    throw new Error('endField must be a non-empty string');
  }

  return {
    tasksField: input.tasksField,
    startField: input.startField,
    endField: input.endField,
    idField: isNonEmptyString(input.idField) ? input.idField : 'id',
    titleField: isNonEmptyString(input.titleField) ? input.titleField : 'title',
  };
}

