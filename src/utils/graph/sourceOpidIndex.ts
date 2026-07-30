import { GraphFilterData, GraphInputPid } from '@/types/domain/gpac';

export function sourceOpidIndex(
  sourceFilter: GraphFilterData,
  consumerPid: GraphInputPid,
): number | undefined {
  if (sourceFilter.opid.length === 0) return undefined;

  const exactIndex = consumerPid.source_opid_idx;
  if (exactIndex !== undefined && exactIndex >= 0) {
    return exactIndex < sourceFilter.opid.length ? exactIndex : undefined;
  }

  const matchingOpid =
    sourceFilter.opid.find((opid) => opid.ID === consumerPid.ID) ??
    sourceFilter.opid.find(
      (opid) => opid.stream_type === consumerPid.stream_type,
    ) ??
    sourceFilter.opid[0];

  return matchingOpid.pid_index;
}
