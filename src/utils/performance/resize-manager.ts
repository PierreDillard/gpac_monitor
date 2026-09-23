import { Subscribable } from '../../services/utils/subscribable';

interface ResizeData {
  width: number;
  height: number;
  timestamp: number;
  transform?: {
    scale: number;
    translateX: number;
    translateY: number;
  };
}

export type ResizeNotification =
  | 'resize_start'
  | 'resize_end'
  | 'resize_update';

class ResizeManager extends Subscribable<ResizeData, ResizeNotification> {
  private resizeObserver: ResizeObserver | null = null;
  private activeElements = new Map<Element, string>();
  private isResizing = false;
  private resizeEndTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super({ width: 0, height: 0, timestamp: 0 });
    this.initializeResizeObserver();
  }

  private initializeResizeObserver() {
    this.resizeObserver = new ResizeObserver((entries) => {
      if (!this.isResizing) {
        this.isResizing = true;
        this.notify('resize_start');
      }

      // Clear existing timer
      if (this.resizeEndTimer) {
        clearTimeout(this.resizeEndTimer);
      }

      // Process resize entries with debounced updates
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.updateData({
          width,
          height,
          timestamp: Date.now(),
        });
        this.notify('resize_update');
      }

      // Set end timer
      this.resizeEndTimer = setTimeout(() => {
        this.isResizing = false;
        this.notify('resize_end');
        this.resizeEndTimer = null;
      }, 150);
    });
  }

  public observeElement(element: Element, id?: string): string {
    if (!this.resizeObserver) return '';

    const elementId = id || `element_${Date.now()}_${Math.random()}`;
    this.activeElements.set(element, elementId);
    this.resizeObserver.observe(element);

    return elementId;
  }

  public unobserveElement(element: Element) {
    if (!this.resizeObserver) return;

    this.resizeObserver.unobserve(element);
    this.activeElements.delete(element);
  }

  public subscribeToResize(
    callback: (data: ResizeData, type?: ResizeNotification[]) => void,
    debounceTime: number = 16, // ~60fps for smooth updates
  ) {
    return this.subscribe(callback, { debounce: debounceTime });
  }

  public destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.resizeEndTimer) {
      clearTimeout(this.resizeEndTimer);
      this.resizeEndTimer = null;
    }
    this.activeElements.clear();
  }

  private updateData(newData: Partial<ResizeData>) {
    this.data = { ...this.data, ...newData };
  }
}

// Global instance
export const resizeManager = new ResizeManager();

const observeElement = (element: Element, id?: string) =>
  resizeManager.observeElement(element, id);

const unobserveElement = (element: Element) =>
  resizeManager.unobserveElement(element);

const subscribe = (
  callback: (data: ResizeData, type?: ResizeNotification[]) => void,
  debounce?: number,
) => resizeManager.subscribeToResize(callback, debounce);

// Hook for React components
export const useResizeOptimization = () => {
  return { observeElement, unobserveElement, subscribe };
};
