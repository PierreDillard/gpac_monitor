import { useMemo, useCallback, useRef } from 'react';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/redux';
import { useDataMode } from '@/shared/hooks/data/useDataMode';
import {
  HISTORY_HEADER_HEIGHT_PX,
  TIMELINE_DOCK_HEIGHT_PX,
} from '@/components/history/historyLayout';
import {
  Responsive,
  WidthProvider,
  Layout,
  Layouts as RGLLayouts,
} from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import '@/styles/grid-selection.css';
import { updateWidgetPosition } from '@/shared/store/slices/widgetsSlice';
import { closeSidebar } from '@/shared/store/slices/layoutSlice';
import Header from './Header';
import Sidebar from '../sidebar/Sidebar';
import SessionPicker from '@/components/history/SessionPicker';
import HistoryControls from '@/components/history/timeline/HistoryControls';
import { Widget } from '@/types/ui/widget';
import { getWidgetDefinition } from '../../widget/registry';
import SidebarCloseButton from '../sidebar/SidebarCloseButton';
import { toGridLayoutItem } from './gridLayoutItem';

const ResponsiveGridLayout = WidthProvider(Responsive);

const EMPTY_WIDGET_CONFIG = {
  isMaximized: false,
  isMinimized: false,
  settings: {},
};

const DashboardLayout = () => {
  const dispatch = useAppDispatch();
  const activeWidgets = useAppSelector((state) => state.widgets.activeWidgets);
  const configs = useAppSelector((state) => state.widgets.configs);
  const isSidebarOpen = useAppSelector((state) => state.layout.isSidebarOpen);
  const isDraggingRef = useRef(false);
  const { isHistory } = useDataMode();
  const rowHeight = useMemo(() => {
    const headerHeight = isHistory ? HISTORY_HEADER_HEIGHT_PX : 64;
    const dockHeight = isHistory ? TIMELINE_DOCK_HEIGHT_PX : 0;
    const availableHeight = window.innerHeight - headerHeight - dockHeight;
    return Math.floor(availableHeight / 14.8);
  }, [isHistory]);

  // Memoize layouts object - only recreate if widget positions/sizes change
  const layouts: RGLLayouts = useMemo(
    () => ({
      lg: activeWidgets.map(toGridLayoutItem),
    }),
    [activeWidgets], // Only recreate when activeWidgets reference changes
  );

  const renderWidget = useCallback(
    (widget: Widget) => {
      const definition = getWidgetDefinition(widget.type);

      if (!definition) {
        console.warn(`No definition found for widget type: ${widget.type}`);
        return null;
      }

      const Component = definition.component;

      return (
        <div key={widget.id} tabIndex={-1}>
          <Component
            id={widget.id}
            config={configs[widget.id] || EMPTY_WIDGET_CONFIG}
            isDetached={widget.isDetached}
            detachedFilterIdx={widget.detachedFilterIdx}
          />
        </div>
      );
    },
    [configs],
  );

  return (
    <div className="grid grid-rows-[auto_1fr_auto] h-screen bg-main overflow-x-hidden">
      <Header />
      <SessionPicker />
      <div className="flex relative min-h-0 overflow-hidden">
        <div
          id="app-sidebar"
          className="fixed top-14 left-0 w-72 z-10 bg-slate-800/95 transition-transform duration-300 ease-in-out will-change-transform"
          style={{
            transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            bottom: isHistory ? TIMELINE_DOCK_HEIGHT_PX : 0,
          }}
        >
          <Sidebar />
        </div>
        {isSidebarOpen && (
          <SidebarCloseButton onClose={() => dispatch(closeSidebar())} />
        )}

        <OverlayScrollbarsComponent
          element="main"
          options={{ scrollbars: { autoHide: 'leave', autoHideDelay: 400 } }}
          className="flex-1 h-full min-h-0 pb-4 pt-2 pl-0 transition-transform duration-300 will-change-transform"
          style={{
            transform: isSidebarOpen ? 'translateX(256px)' : 'translateX(0)',
            paddingRight: isSidebarOpen ? '272px' : '16px',
            opacity: isDraggingRef.current ? 0.2 : 1,
          }}
        >
          <ResponsiveGridLayout
            className="layout h-full"
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 24, md: 24, sm: 12, xs: 6, xxs: 2 }}
            rowHeight={rowHeight}
            onDragStart={() => {
              isDraggingRef.current = true;
            }}
            onDragStop={(
              _layout: Layout[],
              _oldItem: Layout,
              newItem: Layout,
            ) => {
              isDraggingRef.current = false;
              dispatch(
                updateWidgetPosition({
                  id: newItem.i,
                  x: newItem.x,
                  y: newItem.y,
                  w: newItem.w,
                  h: newItem.h,
                }),
              );
            }}
            onResizeStart={() => {
              isDraggingRef.current = true;
            }}
            onResizeStop={(
              _layout: Layout[],
              _oldItem: Layout,
              newItem: Layout,
            ) => {
              isDraggingRef.current = false;
              dispatch(
                updateWidgetPosition({
                  id: newItem.i,
                  x: newItem.x,
                  y: newItem.y,
                  w: newItem.w,
                  h: newItem.h,
                }),
              );
            }}
            isDraggable={true}
            isResizable={true}
            margin={[16, 16]}
            containerPadding={[16, 16]}
            draggableCancel=".no-drag"
            useCSSTransforms={true}
          >
            {activeWidgets.map(renderWidget)}
          </ResponsiveGridLayout>
        </OverlayScrollbarsComponent>
      </div>
      <HistoryControls />
    </div>
  );
};

export default DashboardLayout;
