import React from 'react';

type State = { hasError: boolean; error?: unknown };

export class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: unknown, info: any) {
    console.warn('obsidian-gantt: React error boundary caught', error, info);
  }

  override render() {
    if (this.state.hasError) {
      return React.createElement('div', { className: 'ogantt-error' }, 'Render error in Gantt view');
    }
    return this.props.children as any;
  }
}

