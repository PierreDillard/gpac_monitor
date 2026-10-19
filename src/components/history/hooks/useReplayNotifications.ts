import { useEffect } from 'react';
import { historyController } from '@/services/historyService/historyController';
import { toast } from '@/shared/hooks/ui/useToast';

export const useReplayNotifications = () => {
  useEffect(() => {
    historyController.setNotificationHandlers({
      onChunkUnreadable: (position: number) => {
        toast({
          title: 'Replay data missing',
          description: `Chunk ${position} could not be read; this part of the session is shown empty.`,
          variant: 'destructive',
        });
      },
    });

    return () => {
      historyController.setNotificationHandlers({});
    };
  }, []);
};
