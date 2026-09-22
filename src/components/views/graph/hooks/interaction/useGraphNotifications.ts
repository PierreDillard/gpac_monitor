import { useEffect, useRef } from 'react';
import { Node } from '@xyflow/react';
import type { ToasterToast } from '@/shared/hooks/ui/useToast';

interface UseGraphNotificationsProps {
  nodes: Node[];
  error: string | null;
  isLoading: boolean;
  toast: (props: Omit<ToasterToast, 'id'>) => void;
  disabled?: boolean;
}

/**
 * Hook for managing notification system for graph events
 * Displays toast notifications for important events
 */
export const useGraphNotifications = ({
  nodes,
  error,
  isLoading,
  toast,
  disabled = false,
}: UseGraphNotificationsProps) => {
  // Notification for successful graph loading (once per session — the graph
  // can keep growing afterwards, e.g. a DASH pipeline spawning muxers)
  const hasNotifiedGraphLoadRef = useRef(false);
  useEffect(() => {
    if (disabled) return;
    if (nodes.length === 0) {
      hasNotifiedGraphLoadRef.current = false;
      return;
    }
    if (isLoading || hasNotifiedGraphLoadRef.current) return;
    hasNotifiedGraphLoadRef.current = true;
    toast({
      title: 'Graph loaded',
      description: `${nodes.length} node${nodes.length !== 1 ? 's' : ''} have been loaded`,
      variant: 'default',
    });
  }, [nodes.length, isLoading, toast, disabled]);

  // Notification for errors
  useEffect(() => {
    if (disabled) return;
    if (error) {
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      });
    }
  }, [error, toast, disabled]);

  return {};
};
