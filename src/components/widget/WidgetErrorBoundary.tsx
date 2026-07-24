import React from 'react';
import { LuRotateCcw, LuTriangleAlert } from 'react-icons/lu';

interface WidgetErrorBoundaryProps {
  widgetTitle?: string;
  children: React.ReactNode;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class WidgetErrorBoundary extends React.Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): WidgetErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo): void {
    console.error(
      `[WidgetErrorBoundary] "${this.props.widgetTitle ?? 'widget'}" crashed:`,
      error,
      errorInfo,
    );
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-2 h-full bg-monitor-surface p-4 text-center"
      >
        <LuTriangleAlert className="w-5 h-5 text-amber-400" />
        <p className="text-sm font-medium text-gray-300">
          {this.props.widgetTitle ?? 'Widget'} failed to render
        </p>
        <p className="text-xs text-gray-400 line-clamp-2">
          {this.state.errorMessage}
        </p>
        <button
          onClick={this.handleRetry}
          type="button"
          className="flex items-center gap-1 px-2 py-1 mt-1 rounded text-xs text-gray-300 bg-gray-700 hover:bg-gray-600"
        >
          <LuRotateCcw className="w-3 h-3" />
          Retry
        </button>
      </div>
    );
  }
}

export default WidgetErrorBoundary;
