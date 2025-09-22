import type { FieldMappings } from '../mapping/FieldMappings';
import type { GanttConfig } from '../data-sources/DataSourceAdapter';

export interface ValidationResult {
  ok: boolean;
  errors?: string[];
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function validateFieldMappings(m: Partial<FieldMappings> | undefined): ValidationResult {
  const errors: string[] = [];
  if (!m) {
    return { ok: false, errors: ['fieldMappings is required'] };
  }
  if (!isNonEmptyString(m.id)) errors.push('fieldMappings.id is required');
  if (!isNonEmptyString(m.text)) errors.push('fieldMappings.text is required');
  if (m.duration && !isNonEmptyString(m.duration)) errors.push('fieldMappings.duration must be a string when provided');
  if (m.start && !isNonEmptyString(m.start)) errors.push('fieldMappings.start must be a string when provided');
  if (m.end && !isNonEmptyString(m.end)) errors.push('fieldMappings.end must be a string when provided');
  if (m.parent && !isNonEmptyString(m.parent)) errors.push('fieldMappings.parent must be a string when provided');
  if (m.parents && !isNonEmptyString(m.parents)) errors.push('fieldMappings.parents must be a string when provided');
  return { ok: errors.length === 0, errors: errors.length ? errors : undefined };
}

export function validateGanttConfig(config: Partial<GanttConfig> | undefined): ValidationResult {
  if (!config) return { ok: false, errors: ['config is required'] };
  const errors: string[] = [];
  const fm = validateFieldMappings(config.fieldMappings);
  if (!fm.ok) errors.push(...(fm.errors ?? []));
  if (config.viewMode && !['Day', 'Week', 'Month'].includes(config.viewMode)) {
    errors.push('viewMode must be one of Day|Week|Month');
  }
  if (config.defaultDuration != null) {
    if (typeof config.defaultDuration !== 'number' || !Number.isFinite(config.defaultDuration) || config.defaultDuration <= 0) {
      errors.push('defaultDuration must be a positive number when provided');
    }
  }
  const validMissing = ['infer', 'show', 'hide'];
  if (config.missingStartBehavior && !validMissing.includes(config.missingStartBehavior)) {
    errors.push('missingStartBehavior must be one of infer|show|hide');
  }
  if (config.missingEndBehavior && !validMissing.includes(config.missingEndBehavior)) {
    errors.push('missingEndBehavior must be one of infer|show|hide');
  }
  return { ok: errors.length === 0, errors: errors.length ? errors : undefined };
}

export function applyGanttDefaults(config: Partial<GanttConfig>): GanttConfig {
  const fieldMappings = config.fieldMappings as FieldMappings;
  return {
    fieldMappings,
    viewMode: config.viewMode ?? 'Week',
    tableWidth: config.tableWidth,
    show_today_marker: config.show_today_marker ?? true,
    hide_task_names: config.hide_task_names ?? false,
    showMissingDates: config.showMissingDates ?? true,
    missingStartBehavior: config.missingStartBehavior ?? 'infer',
    missingEndBehavior: config.missingEndBehavior ?? 'infer',
    defaultDuration: config.defaultDuration ?? 3,
    showMissingDateIndicators: config.showMissingDateIndicators ?? true,
  };
}

