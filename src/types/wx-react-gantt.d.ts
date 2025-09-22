declare module 'wx-react-gantt' {
  // Minimal type surface for MVP; refine later with actual API
  import * as React from 'react';
  export interface TaskItem {
    id: number | string;
    text?: string;
    start?: Date;
    end?: Date;
    duration?: number;
    progress?: number;
    parent?: number | string;
    type?: 'task' | 'summary';
    [key: string]: unknown;
  }
  export interface LinkItem {
    id: number | string;
    source: number | string;
    target: number | string;
    type?: string;
  }
  export interface ScaleItem {
    unit: string;
    step?: number;
    format?: string;
  }
  export interface GanttProps {
    tasks?: TaskItem[];
    links?: LinkItem[];
    scales?: ScaleItem[];
    [key: string]: unknown;
  }
  export const Gantt: React.FC<GanttProps>;
  export const Willow: React.FC<React.PropsWithChildren<{}>>;
}

