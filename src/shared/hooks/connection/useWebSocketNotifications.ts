import { useEffect } from 'react';
import { gpacService } from '@/services/gpacService';
import type { ProtocolVersionMismatch } from '@/services/ws/protocolVersion';
import type { ToasterToast } from '../ui/useToast';

interface UseWebSocketNotificationsProps {
  toast: (props: Omit<ToasterToast, 'id'>) => void;
  disabled?: boolean;
}

function formatProtocolVersionMismatchToast(
  mismatch: ProtocolVersionMismatch,
): Omit<ToasterToast, 'id'> {
  const gpacVersionSuffix = mismatch.gpacVersion
    ? ` (GPAC ${mismatch.gpacVersion})`
    : '';

  if (mismatch.kind === 'server_too_old') {
    return {
      title: 'GPAC version too old',
      description:
        mismatch.receivedVersion === undefined
          ? `This monitor page expects protocol v${mismatch.expectedVersion}. Your GPAC server${gpacVersionSuffix} does not recognize it. Update GPAC to restore full compatibility.`
          : `This monitor page expects protocol v${mismatch.expectedVersion}, your GPAC server announces v${mismatch.receivedVersion}${gpacVersionSuffix}. Update GPAC to restore full compatibility.`,
      variant: 'destructive',
      duration: Infinity,
    };
  }

  return {
    title: 'Monitor page out of date',
    description: `Your GPAC server announces protocol v${mismatch.receivedVersion}${gpacVersionSuffix}, this page only knows v${mismatch.expectedVersion}. Reload the page to get the latest version.`,
    variant: 'destructive',
    duration: Infinity,
  };
}

export const useWebSocketNotifications = ({
  toast,
  disabled = false,
}: UseWebSocketNotificationsProps) => {
  useEffect(() => {
    if (disabled) return;
    gpacService.setNotificationHandlers({
      onConnectionStatus: (connected: boolean) => {
        toast({
          title: connected ? 'Connection established' : 'Connection closed',
          variant: connected ? 'default' : 'destructive',
        });
      },
      onError: () => {
        toast({
          title: 'WebSocket error',
          description: 'An error occurred',
          variant: 'destructive',
        });
      },
      onBackendNotification: (title: string, description: string) => {
        toast({ title, description });
      },
      onProtocolVersionMismatch: (mismatch: ProtocolVersionMismatch) => {
        toast(formatProtocolVersionMismatchToast(mismatch));
      },
    });

    return () => {
      gpacService.setNotificationHandlers({});
    };
  }, [toast, disabled]);
};
