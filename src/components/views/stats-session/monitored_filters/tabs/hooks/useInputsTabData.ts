import { useMemo } from 'react';
import type { FilterStatsResponse } from '@/types/domain/gpac/filter-stats';
import type { PIDWithIndex } from '../../../types';
import { getGlobalStatus } from '@/utils/gpac';

/**
 * Hook to transform and organize input PIDs data
 */
export const useInputsTabData = (filterData: FilterStatsResponse) => {
  // Convert ipids to array with position indices (0, 1, 2...)
  const inputPidsWithIndices = useMemo((): PIDWithIndex[] => {
    if (!filterData?.ipids) return [];

    return Object.entries(filterData.ipids).map(([_pidName, pid], pidIdx) => ({
      ...pid,
      pidIdx,
    }));
  }, [filterData?.ipids]);

  // Group PIDs by input source and media type
  const groupedInputs = useMemo(() => {
    return inputPidsWithIndices.reduce<
      Record<string, Record<string, PIDWithIndex[]>>
    >((acc, pid) => {
      // Use full PID name as input identifier (each PID is a distinct input)
      const inputName = pid.name;

      if (!acc[inputName]) {
        acc[inputName] = {};
      }

      // Group by actual PID type
      const pidType = pid.type || 'Unknown';
      if (!acc[inputName][pidType]) {
        acc[inputName][pidType] = [];
      }
      acc[inputName][pidType].push(pid);

      return acc;
    }, {});
  }, [inputPidsWithIndices]);

  const inputNames = useMemo(() => Object.keys(groupedInputs), [groupedInputs]);

  const globalStatus = useMemo(
    () => getGlobalStatus(inputPidsWithIndices, inputNames.length),
    [inputPidsWithIndices, inputNames.length],
  );

  return {
    inputPidsWithIndices,
    groupedInputs,
    inputNames,
    globalStatus,
  };
};
