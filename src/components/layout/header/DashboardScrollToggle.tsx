import { RefObject, useEffect, useRef, useState } from 'react';
import { OverlayScrollbarsComponentRef } from 'overlayscrollbars-react';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import {
  ScrollDirection,
  readScrollDirection,
} from '@/utils/layout/scrollDirection';

interface DashboardScrollToggleProps {
  scrollAreaRef: RefObject<OverlayScrollbarsComponentRef<'main'>>;
}

const DashboardScrollToggle = ({
  scrollAreaRef,
}: DashboardScrollToggleProps) => {
  const [direction, setDirection] = useState<ScrollDirection | null>(null);
  const directionRef = useRef<ScrollDirection | null>(null);

  useEffect(() => {
    const instance = scrollAreaRef.current?.osInstance();
    if (!instance) return;
    const { viewport } = instance.elements();
    const updateDirection = () => {
      const nextDirection = readScrollDirection(
        viewport.scrollTop,
        viewport.scrollHeight,
        viewport.clientHeight,
      );
      if (nextDirection === directionRef.current) return;
      directionRef.current = nextDirection;
      setDirection(nextDirection);
    };
    updateDirection();
    const removeScrollListener = instance.on('scroll', updateDirection);
    const removeUpdatedListener = instance.on('updated', updateDirection);
    return () => {
      removeScrollListener();
      removeUpdatedListener();
    };
  }, [scrollAreaRef]);

  if (!direction) return null;

  const isDown = direction === ScrollDirection.Down;

  const handleClick = () => {
    const viewport = scrollAreaRef.current?.osInstance()?.elements().viewport;
    viewport?.scrollTo({ top: isDown ? viewport.scrollHeight : 0 });
  };

  return (
    <Button
      variant="ghost"
      aria-label={isDown ? 'Scroll to bottom' : 'Scroll to top'}
      title={isDown ? 'Scroll to bottom' : 'Scroll to top'}
      onClick={handleClick}
      className="absolute left-2 top-1/4 z-[5] h-9 w-9 rounded-full p-0 border border-gray-600 bg-gray-900/80 text-gray-200 shadow-md hover:bg-gray-700 active:bg-gray-600"
    >
      {isDown ? <LuChevronDown size={18} /> : <LuChevronUp size={18} />}
    </Button>
  );
};

export default DashboardScrollToggle;
