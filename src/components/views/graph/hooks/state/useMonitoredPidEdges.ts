import { useMemo } from 'react';
import type { Edge } from '@xyflow/react';
import { useAppSelector } from '@/shared/hooks/redux';
import { selectSelectedPidTargets } from '@/shared/store/selectors';
import { applyMonitoredPidEdges } from '../../utils/monitoredPidEdges';

export const useMonitoredPidEdges = (edges: Edge[]): Edge[] => {
  const selectedPidTargets = useAppSelector(selectSelectedPidTargets);
  return useMemo(
    () => applyMonitoredPidEdges(edges, selectedPidTargets),
    [edges, selectedPidTargets],
  );
};
