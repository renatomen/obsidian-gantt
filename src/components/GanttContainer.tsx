import React, { useEffect } from 'react';
import { Gantt, Willow } from 'wx-react-gantt';
import ganttCss from 'wx-react-gantt/dist/gantt.css';
import type { SVARTask, SVARLink } from '../data-sources/DataSourceAdapter';

function ensureCssInjected(id = 'wx-react-gantt-css') {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = ganttCss;
  document.head.appendChild(style);
}

export type GanttContainerProps = {
  tasks: SVARTask[];
  links?: SVARLink[];
  scales?: Array<{ unit: 'day'|'week'|'month'; step: number; format: string }>;
};

export const GanttContainer: React.FC<GanttContainerProps> = ({ tasks, links = [], scales }) => {
  useEffect(() => { ensureCssInjected(); }, []);

  const effectiveScales = scales ?? [
    { unit: 'month' as const, step: 1, format: 'MMMM yyy' },
    { unit: 'day' as const, step: 1, format: 'd' }
  ];

  if (!tasks || tasks.length === 0) {
    return <div className="ogantt-empty">No items match.</div>;
  }

  return (
    <Willow>
      <Gantt tasks={tasks} links={links} scales={effectiveScales} />
    </Willow>
  );
};

export default GanttContainer;

