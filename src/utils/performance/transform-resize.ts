// Simple transform-based resize optimization
const startTransform = (element: HTMLElement) => {
  element.style.willChange = 'transform';
  element.style.transformOrigin = 'top left';
};

const updateTransform = (
  element: HTMLElement,
  scaleX: number,
  scaleY: number,
) => {
  element.style.transform = `scale(${scaleX}, ${scaleY})`;
};

const commitResize = (element: HTMLElement, width: number, height: number) => {
  element.style.transform = '';
  element.style.willChange = '';
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
};

export const useTransformResize = () => {
  return { startTransform, updateTransform, commitResize };
};
