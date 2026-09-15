import { useCallback } from 'react';
import { useReactFlow, XYPosition } from '@xyflow/react';

/**
 *
 *  handling minimap navigation interactions.
 *
 */
export const useMinimapNavigation = () => {
  const { setViewport, getZoom, setCenter } = useReactFlow();

  const handleMiniMapClick = useCallback(
    (_event: React.MouseEvent<Element, MouseEvent>, position: XYPosition) => {
      // `position` is already in flow coordinates (confirmed at runtime),
      // so let React Flow own the viewport math instead of reimplementing it.
      void setCenter(position.x, position.y, {
        zoom: getZoom(),
        duration: 300,
      });
    },
    [setCenter, getZoom],
  );

  const handleMiniMapDrag = useCallback(
    (event: React.DragEvent<SVGSVGElement>) => {
      const svgElement = event.currentTarget;
      const svgRect = svgElement.getBoundingClientRect();

      // More precise coordinate calculation
      const relativeX = (event.clientX - svgRect.left) / svgRect.width;
      const relativeY = (event.clientY - svgRect.top) / svgRect.height;

      // Clamp values to prevent out-of-bounds
      const clampedX = Math.max(0, Math.min(1, relativeX));
      const clampedY = Math.max(0, Math.min(1, relativeY));

      const minimapScale = 150;
      const newX = -clampedX * minimapScale + svgRect.width / 2;
      const newY = -clampedY * minimapScale + svgRect.height / 2;

      setViewport(
        {
          x: newX,
          y: newY,
          zoom: getZoom(),
        },
        { duration: 0 }, // No animation for drag
      );
    },
    [setViewport, getZoom],
  );

  return {
    handleMiniMapClick,
    handleMiniMapDrag,
  };
};
