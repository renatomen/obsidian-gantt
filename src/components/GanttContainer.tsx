import React, { useEffect } from 'react';
import { Gantt, Willow } from 'wx-react-gantt';
import ganttCss from 'wx-react-gantt/dist/gantt.css';

function ensureCssInjected(id = 'wx-react-gantt-css') {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = ganttCss;
  document.head.appendChild(style);
}

export const GanttContainer: React.FC = () => {
  useEffect(() => { ensureCssInjected(); }, []);

  const tasks = [
    { id: 10, text: 'Summary', start: new Date(2025, 0, 1), end: new Date(2025, 0, 8), duration: 7, progress: 0, type: 'summary' as const },
    { id: 1, text: 'Sample Task', start: new Date(2025, 0, 1), end: new Date(2025, 0, 5), duration: 4, progress: 0.5, type: 'task' as const, parent: 10 },
    { id: 2, text: 'Another Task', start: new Date(2025, 0, 3), end: new Date(2025, 0, 8), duration: 5, progress: 0.2, type: 'task' as const, parent: 10 }
  ];

  const links = [{ id: 1, source: 1, target: 2, type: 'e2e' as const }];

  const scales = [
    { unit: 'month' as const, step: 1, format: 'MMMM yyy' },
    { unit: 'day' as const, step: 1, format: 'd' }
  ];

  return (
    <Willow>
      <Gantt tasks={tasks} links={links} scales={scales} />
    </Willow>
  );
};

export default GanttContainer;

