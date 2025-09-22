import type { BasesQuery, BasesView } from '../model/types';

export type ViewSelector = string | number | undefined;

export function selectView(q: BasesQuery, sel?: ViewSelector): BasesView {
  const views = Array.isArray(q.views) ? q.views as BasesView[] : [];
  if (typeof sel === 'number') {
    if (!views[sel]) throw new Error('ViewNotFoundError');
    return views[sel];
  }
  if (typeof sel === 'string') {
    const found = views.find(v => v?.name === sel);
    if (!found) throw new Error('ViewNotFoundError');
    return found;
  }
  if (!views.length) {
    const v: BasesView = {};
    q.views = [v];
    return v;
  }
  return views[0];
}

