import { useEffect, useRef, useCallback } from 'react';
import { useResizeOptimization, ResizeNotification } from '@/utils/performance';
import { useTransformResize } from '@/utils/performance';

interface UseOptimizedResizeOptions {
  onResize?: (width: number, height: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  debounce?: number;
  throttle?: boolean;
  useTransform?: boolean;
}

export const useOptimizedResize = (options: UseOptimizedResizeOptions = {}) => {
  const {
    onResize,
    onResizeStart,
    onResizeEnd,
    debounce = 16,
    throttle = true,
    useTransform = false,
  } = options;

  const elementRef = useRef<HTMLElement>(null);
  const { observeElement, unobserveElement, subscribe } =
    useResizeOptimization();
  const { startTransform, updateTransform, commitResize } =
    useTransformResize();
  const isResizingRef = useRef(false);
  const initialSizeRef = useRef<{ width: number; height: number } | null>(null);
  const callbacksRef = useRef({ onResize, onResizeStart, onResizeEnd });

  useEffect(() => {
    callbacksRef.current = { onResize, onResizeStart, onResizeEnd };
  });

  const handleResize = useCallback(
    (
      data: { width: number; height: number; timestamp: number },
      types?: ResizeNotification[],
    ) => {
      if (!types) return;

      if (types.includes('resize_start')) {
        isResizingRef.current = true;
        if (useTransform && elementRef.current) {
          initialSizeRef.current = { width: data.width, height: data.height };
          startTransform(elementRef.current);
        }
        callbacksRef.current.onResizeStart?.();
      }

      if (types.includes('resize_update')) {
        const { onResize } = callbacksRef.current;
        if (useTransform && elementRef.current && initialSizeRef.current) {
          // Use GPU transform instead of DOM resize
          const scaleX = data.width / initialSizeRef.current.width;
          const scaleY = data.height / initialSizeRef.current.height;
          updateTransform(elementRef.current, scaleX, scaleY);
        } else if (onResize) {
          if (throttle && isResizingRef.current) {
            onResize(data.width, data.height);
          } else if (!throttle) {
            onResize(data.width, data.height);
          }
        }
      }

      if (types.includes('resize_end')) {
        isResizingRef.current = false;
        if (useTransform && elementRef.current) {
          // Commit real dimensions
          commitResize(elementRef.current, data.width, data.height);
          initialSizeRef.current = null;
        }
        const { onResize, onResizeEnd } = callbacksRef.current;
        onResizeEnd?.();
        if (onResize && !useTransform) {
          onResize(data.width, data.height);
        }
      }
    },
    [throttle, useTransform, startTransform, updateTransform, commitResize],
  );

  useEffect(() => {
    if (!elementRef.current) return;

    const element = elementRef.current;
    const unsubscribe = subscribe(handleResize, debounce);

    return () => {
      unobserveElement(element);
      unsubscribe();
    };
  }, [observeElement, unobserveElement, subscribe, handleResize, debounce]);

  return {
    ref: elementRef,
    isResizing: isResizingRef.current,
  };
};
