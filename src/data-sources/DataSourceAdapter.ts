import type { FieldMappings } from '../mapping/FieldMappings';

// Minimal internal SVAR task/link shapes used by our components
export interface SVARTask {
  id: string | number;
  text: string;
  start?: Date;
  end?: Date;
  duration?: number;
  progress?: number;
  parent?: string | number;
  type?: 'task' | 'summary' | 'milestone';
}

export interface SVARLink {
  id: string | number;
  source: string | number;
  target: string | number;
  type?: string;
}

export interface GanttConfig {
  fieldMappings: FieldMappings;
  viewMode: 'Day' | 'Week' | 'Month';
  tableWidth?: number;
  show_today_marker?: boolean;
  hide_task_names?: boolean;
}

// Phase 2 stub: Data source adapter interface
export interface DataSourceAdapter {
  readonly type: 'bases' | 'dataview' | 'custom';
  readonly renderContext: 'bases-view' | 'code-block' | 'custom';

  initialize(): Promise<void>;
  queryData(config: GanttConfig): Promise<any[]>;
  validateConfig(config: GanttConfig): { ok: boolean; errors?: string[] };
  mapToSVARFormat(rawData: any[], fieldMappings: FieldMappings): SVARTask[];
  dispose(): void;
}

