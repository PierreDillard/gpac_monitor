import React, { useCallback, useState, useMemo } from 'react';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/redux';
import { useOptimizedResize } from '@/shared/hooks/ui/useOptimizedResize';
import { widgetIcons } from './widgetIcons';
import WidgetErrorBoundary from './WidgetErrorBoundary';

import { LuX, LuRotateCcw } from 'react-icons/lu';
import {
  removeWidget,
  minimizeWidget,
  maximizeWidget,
  restoreWidget,
} from '@/shared/store/slices/widgetsSlice';
import { makeSelectWidgetConfig } from '@/shared/store/selectors/widgets';

interface WidgetWrapperProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  customActions?: React.ReactNode;
  statusBadge?: React.ReactNode;
}

// Memoized styles
const headerStyles = {
  base: 'flex items-center justify-between px-4 py-2 bg-monitor-app border-b border-gray-800 transition-colors hover:bg-gray-650',
  title: 'flex items-center gap-2',
  actions: 'flex items-center gap-2',
};

const buttonStyles = {
  base: 'p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-white cursor-pointer no-drag z-50',
};

const WidgetWrapper = ({
  id,
  children,
  className = '',
  customActions,
  statusBadge,
}: WidgetWrapperProps) => {
  const dispatch = useAppDispatch();
  const [isResizing, setIsResizing] = useState(false);

  // Get widget data from Redux
  const widget = useAppSelector((state) =>
    state.widgets.activeWidgets.find((w) => w.id === id),
  );

  // Get icon
  const iconDef = useMemo(() => {
    if (!widget?.type) return null;
    return widgetIcons[widget.type] || null;
  }, [widget?.type]);

  // Optimized resize hook
  const { ref: resizeRef } = useOptimizedResize({
    onResizeStart: () => setIsResizing(true),
    onResizeEnd: () => setIsResizing(false),
    debounce: 16, // ~60fps
    throttle: true,
  });

  // Memoized widget config selector
  const selectWidgetConfig = useMemo(() => makeSelectWidgetConfig(), []);
  const config = useAppSelector((state) => selectWidgetConfig(state, id));

  const { isMaximized, isMinimized } = config;

  // Memoized callbacks
  const handleMinimize = useCallback(() => {
    dispatch(minimizeWidget(id));
  }, [dispatch, id]);

  const handleMaximize = useCallback(() => {
    dispatch(maximizeWidget(id));
  }, [dispatch, id]);

  const handleRestore = useCallback(() => {
    dispatch(restoreWidget(id));
  }, [dispatch, id]);

  const handleClose = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      dispatch(removeWidget(id));
    },
    [dispatch, id],
  );

  //Memoized container classes with resize optimization
  const containerClasses = React.useMemo(() => {
    return [
      'flex flex-col bg-foreground/10 overflow-hidden rounded-sm widget-anim',
      isMaximized ? 'fixed inset-4 z-50 w-auto h-auto' : '',
      isMinimized ? 'h-12' : 'h-full',
      isResizing ? 'is-interacting pointer-events-none' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');
  }, [isMaximized, isMinimized, isResizing, className]);

  return (
    <div
      ref={resizeRef as React.RefObject<HTMLDivElement>}
      className={containerClasses}
    >
      <div
        className={`${headerStyles.base} cursor-grab widget-drag-handle bg-gray-900/70 flex justify-center`}
      >
        <div className={headerStyles.title}>
          {iconDef &&
            React.createElement(iconDef, {
              className: 'w-4 h-4 text-secondary font-ui',
            })}
          <h3 className="text-base font-medium font-ui text-secondary">
            {widget?.title}
          </h3>
          {statusBadge && <div className="min-w-32 ">{statusBadge}</div>}
        </div>

        <div className={`${headerStyles.actions} no-drag`}>
          {customActions && (
            <div className="flex items-center gap-2 mr-2 border-r border-gray-600 pr-2">
              {customActions}
            </div>
          )}

          {!isMaximized && !isMinimized && (
            <button
              onClick={handleMinimize}
              className={buttonStyles.base}
              title="Minimize"
              type="button"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                statusBadge
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 12H4"
                />
              </svg>
            </button>
          )}

          {!isMaximized && (
            <button
              onClick={handleMaximize}
              className={buttonStyles.base}
              title="Maximize"
              type="button"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
                />
              </svg>
            </button>
          )}

          {isMaximized && (
            <button
              onClick={handleRestore}
              className={buttonStyles.base}
              title="Restore"
              type="button"
            >
              <LuRotateCcw className="w-4 h-4" />
            </button>
          )}

          <button onClick={handleClose} title="Close widget" type="button">
            <LuX className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <OverlayScrollbarsComponent
          element="div"
          options={{ scrollbars: { autoHide: 'leave', autoHideDelay: 400 } }}
          className={`flex-1 bg-monitor-surface no-drag gpu-optimized ${isResizing ? 'contain-layout contain-style' : ''}`}
        >
          <WidgetErrorBoundary widgetTitle={widget?.title}>
            {children}
          </WidgetErrorBoundary>
        </OverlayScrollbarsComponent>
      )}
    </div>
  );
};

WidgetWrapper.displayName = 'WidgetWrapper';

export default React.memo(WidgetWrapper);
