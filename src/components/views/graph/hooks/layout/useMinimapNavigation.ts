import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

/**
 *
 *  handling minimap navigation interactions.
 *
 */
export const useMinimapNavigation = () => {
  const { setViewport, getZoom } = useReactFlow();

  const handleMiniMapClick = useCallback(
    (
      event: React.MouseEvent<Element, MouseEvent>,
      position: { x: number; y: number },
    ) => {
      // Cast currentTarget to SVGSVGElement for correct typing
      const svgElement = event.currentTarget as SVGSVGElement;
      const svgRect = svgElement.getBoundingClientRect();

      // Use provided position from MiniMap
      const relativeX = position.x;
      const relativeY = position.y;

      // Convert to viewport coordinates
      const minimapScale = 150; // Adjust based on minimap size
      const newX = -relativeX * minimapScale + svgRect.width / 2;
      const newY = -relativeY * minimapScale + svgRect.height / 2;

      setViewport(
        {
          x: newX,
          y: newY,
          zoom: getZoom(),
        },
        { duration: 200 }, // Smooth transition
      );
    },
    [setViewport, getZoom],
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
