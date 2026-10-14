import { useState, useEffect, useRef, useCallback } from 'react';
import type { PlayerState } from './replay/eventPlayer';
import { historyController } from './historyController';

export interface PlayerSnapshot {
  state: PlayerState;
  currentTimeUs: number;
  durationUs: number;
  sessionStartUs: number;
}

function getSnapshot(): PlayerSnapshot {
  return {
    state: historyController.getState(),
    currentTimeUs: historyController.currentTimeUs(),
    durationUs: historyController.durationUs(),
    sessionStartUs: historyController.getSessionStartUs(),
  };
}

/**
 * Subscribes to historyController and exposes reactive player state.
 * currentTimeUs updates at 60fps during playback via requestAnimationFrame.
 */
export function usePlayerState() {
  const [snap, setSnap] = useState<PlayerSnapshot>(getSnapshot);
  const animationFrameIdRef = useRef<number | null>(null);

  const cancelPlaybackLoop = useCallback(() => {
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
  }, []);

  const startPlaybackLoop = useCallback(() => {
    cancelPlaybackLoop();
    const loop = () => {
      setSnap(getSnapshot());
      animationFrameIdRef.current = requestAnimationFrame(loop);
    };
    animationFrameIdRef.current = requestAnimationFrame(loop);
  }, [cancelPlaybackLoop]);

  useEffect(() => {
    historyController.setListener((state) => {
      setSnap(getSnapshot());
      if (state === 'playing') {
        startPlaybackLoop();
      } else {
        cancelPlaybackLoop();
      }
    });

    return () => {
      historyController.setListener(() => {});
      cancelPlaybackLoop();
    };
  }, [startPlaybackLoop, cancelPlaybackLoop]);

  return {
    ...snap,
    play: () => historyController.play(),
    pause: () => historyController.pause(),
    seek: (targetTimestampUs: number) => {
      historyController.seek(targetTimestampUs).catch(console.error);
    },
    playFrom: (targetTimestampUs: number) => {
      historyController
        .seek(targetTimestampUs)
        .then(() => historyController.play())
        .catch(console.error);
    },
  };
}
