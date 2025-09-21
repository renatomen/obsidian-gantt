export type { GanttTask, GanttLink } from '@mapping/mapping-service';

export type GanttLike = {
  init?: (el: HTMLElement) => void;
  parse?: (payload: { data: Array<Record<string, unknown>>; links?: Array<Record<string, unknown>> }) => void;
  config?: Record<string, any>;
};

/** Thin facade over the DHTMLX gantt global for DI and testability. */
export class GanttService {
  private readonly gantt: GanttLike;

  constructor(gantt: GanttLike) {
    this.gantt = gantt;
  }

  /** Ensure a child container with the class expected by DHTMLX exists. */
  private ensureInnerContainer(containerEl: HTMLElement): HTMLElement {
    const el = (containerEl.querySelector('.gantt_container') as HTMLElement | null)
      ?? containerEl.appendChild(Object.assign(document.createElement('div'), { className: 'gantt_container' }));
    el.style.height = '100%';
    return el;
  }

  /** Render tasks into the provided container. Links are optional and can be omitted for now. */
  render(containerEl: HTMLElement, tasks: Array<Record<string, unknown>>, links: Array<Record<string, unknown>> = []): void {
    const inner = this.ensureInnerContainer(containerEl);

    // Ensure DHTMLX uses the same date format we emit (YYYY-MM-DD)
    if (this.gantt.config) {
      // Common DHTMLX settings for parsing dates from JSON payload
      // Some versions use `date_format`, others use `xml_date` during parse
      (this.gantt.config as any).date_format = '%Y-%m-%d';
      (this.gantt.config as any).xml_date = '%Y-%m-%d';
    }

    this.gantt.init?.(inner);
    this.gantt.parse?.({ data: tasks, links });
  }
}

