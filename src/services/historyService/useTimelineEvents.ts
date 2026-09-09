import { useMemo } from 'react';
import { useDataSource } from '@/services/dataSource/DataSourceContext';
import { historyController } from './historyController';
import type { TimelineEvent } from './types';

export function useTimelineEvents(): TimelineEvent[] {
  const { sessionLoaded } = useDataSource();

  return useMemo(
    () => (sessionLoaded ? historyController.getTimelineEvents() : []),
    [sessionLoaded],
  );
}
