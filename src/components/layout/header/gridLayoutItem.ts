import { Layout } from 'react-grid-layout';
import { Widget } from '@/types/ui/widget';
import { getWidgetDefinition } from '../../widget/registry';

const DETACHED_MIN_WIDTH = 8;
const MIN_HEIGHT = 2;

export const toGridLayoutItem = (widget: Widget): Layout => {
  const minWidth = widget.isDetached
    ? DETACHED_MIN_WIDTH
    : getWidgetDefinition(widget.type).minWidth;

  return {
    i: widget.id,
    x: widget.x,
    y: widget.y,
    w: Math.max(widget.w, minWidth),
    h: widget.h,
    minW: minWidth,
    minH: MIN_HEIGHT,
  };
};
