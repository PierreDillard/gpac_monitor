import React, { useMemo, memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { GraphFilterData } from '@/types/domain/gpac';
import { determineFilterSessionType } from '../../utils/filterType';
import { useGraphColors } from '../../hooks/layout/useGraphColors';
import FilterChangeBadges from '@/components/common/FilterChangeBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useFilterAlerts } from '@/shared/hooks';
import { getBasename, truncateMiddle } from '../../utils/labelUtils';
import { arePidListsEqual } from '../../utils/pidComparator';
import NodeToolbarActions from './NodeToolbarActions';

interface CustomNodeProps extends NodeProps {
  data: GraphFilterData & {
    label: string;
    filterType: string;
    isStalled?: boolean;
  } & Record<string, unknown>;
}

const CustomNodeBase: React.FC<CustomNodeProps> = ({
  data,
  selected,
  ...nodeProps
}) => {
  const { label, nb_ipid, nb_opid } = data;
  const ipid = data.ipid ?? [];
  const opid = data.opid ?? [];
  const { hasError, hasWarning } = useFilterAlerts(data.idx);
  const sessionType = useMemo(() => determineFilterSessionType(data), [data]);
  const [textColor, backgroundColor] = useGraphColors({
    id: nodeProps.id,
    data,
  } as unknown as Parameters<typeof useGraphColors>[0]);

  // Compute display label (basename + truncate)
  const { fullLabel, displayLabel } = useMemo(() => {
    const full = label;
    const base = getBasename(full);
    const display = truncateMiddle(base, 26);
    return { fullLabel: full, displayLabel: display };
  }, [label]);

  // Helper to format PID labels
  const formatPidLabel = (pidId: string): string => {
    const base = getBasename(pidId);
    return truncateMiddle(base, 18);
  };

  const isMonitored = data.isMonitored;
  const borderClass = isMonitored
    ? 'ring-4 ring-red-700/90'
    : selected
      ? 'ring-2 ring-sky-400'
      : 'ring-1 ring-monitor-line';

  const STREAM_TYPE_ORDER: Record<string, number> = {
    Visual: 0,
    Audio: 1,
    Text: 2,
    File: 3,
  };

  const sortPidsByStreamType = <T extends { stream_type: string }>(
    pids: T[],
  ): T[] =>
    [...pids].sort(
      (a, b) =>
        (STREAM_TYPE_ORDER[a.stream_type] ?? 99) -
        (STREAM_TYPE_ORDER[b.stream_type] ?? 99),
    );

  const inputHandles =
    nb_ipid > 0
      ? sortPidsByStreamType(ipid).map((pid, index) => ({
          id: `ipid-${pid.pid_index}`,
          type: 'target' as const,
          position: Position.Left,
          index,
        }))
      : [];

  const outputHandles =
    nb_opid > 0
      ? sortPidsByStreamType(opid).map((pid, index) => ({
          id: `opid-${pid.pid_index}`,
          type: 'source' as const,
          position: Position.Right,
          index,
        }))
      : [];

  const getHandleY = (index: number, total: number): string => {
    if (total === 1) return '50%';
    return `${(index / (total - 1)) * 100}%`;
  };
  // Memoize style objects
  const containerStyle = useMemo(
    () => ({
      borderColor: backgroundColor,
      backgroundColor: backgroundColor + '40',
      borderWidth: '2px',
    }),
    [backgroundColor],
  );

  const headerStyle = useMemo(
    () => ({
      backgroundColor,
    }),
    [backgroundColor],
  );

  const handleStyle = useMemo(
    () => ({
      background: backgroundColor,
      width: '10px',
      height: '10px',
      border: '2px solid white',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    }),
    [backgroundColor],
  );

  const textStyle = useMemo(
    () => ({
      color: textColor,
    }),
    [textColor],
  );

  return (
    <>
      <NodeToolbarActions filterIdx={data.idx} filterName={data.name} />
      <div
        className={`
          border-2 rounded-md p-4 
          ${borderClass}
        `}
        style={containerStyle}
      >
        {inputHandles.map(({ id, type, position, index }) => (
          <Handle
            key={`input-${id}`}
            id={id}
            type={type}
            position={position}
            style={{
              ...handleStyle,
              top: getHandleY(index, inputHandles.length),
              transform: 'translateY(-50%)',
            }}
          />
        ))}

        <div
          className="rounded-t-xl -m-4 mb-2 px-4 py-3 shadow-sm"
          style={headerStyle}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h3
                className="font-bold text-sm truncate"
                style={textStyle}
                title={fullLabel}
              >
                {displayLabel}
              </h3>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span
                className="text-xs font-medium px-2 py-1 bg-white/60 rounded-full"
                style={textStyle}
                title={
                  sessionType === 'source'
                    ? 'Source Filter'
                    : sessionType === 'sink'
                      ? 'Sink Filter'
                      : 'Processing Filter'
                }
              >
                {sessionType.toUpperCase()}
              </span>
              <FilterChangeBadges filterIdx={data.idx} />
              <StatusBadge
                label="ERR"
                colorScheme="red"
                visible={hasError}
                title="Error(s) in logs"
              />
              <StatusBadge
                label="WARN"
                colorScheme="amber"
                visible={hasWarning}
                title="Warning(s) in logs"
              />
            </div>
          </div>
        </div>

        {/* Node content */}
        <div className="node-drag-handle ">
          <div className="flex justify-between items-start mb-2">
            {/* INPUTS on the left */}
            <div className="flex-1 text-xs text-gray-600 pr-2">
              {nb_ipid > 0 && (
                <>
                  <span className="font-medium text-white block text-left">
                    INPUTS
                  </span>
                  <div className="mt-1">
                    {ipid.map((pid) => (
                      <div
                        key={`ipid-${pid.pid_index}`}
                        className="text-xs text-gray-100 truncate"
                        title={pid.name}
                      >
                        {formatPidLabel(pid.name)}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* OUTPUTS on the right */}
            <div className="flex-1 text-xs text-gray-800 pl-2">
              {nb_opid > 0 && (
                <>
                  <span className="font-medium text-white block text-right">
                    OUTPUTS
                  </span>
                  <div className="mt-1">
                    {opid.map((pid) => (
                      <div
                        key={`opid-${pid.pid_index}`}
                        className="text-xs text-gray-100 text-right truncate"
                        title={pid.name}
                      >
                        {formatPidLabel(pid.name)}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Statistics */}
          <div className="text-xs text-gray-100 pt-2 border-t border-gray-300 text-center">
            IPIDs: {nb_ipid} | OPIDs: {nb_opid}
          </div>
        </div>

        {/* Output handles */}
        {outputHandles.map(({ id, type, position, index }) => (
          <Handle
            key={`output-${id}`}
            id={id}
            type={type}
            position={position}
            style={{
              ...handleStyle,
              top: getHandleY(index, outputHandles.length),
              transform: 'translateY(-50%)',
            }}
          />
        ))}
      </div>
    </>
  );
};
const CustomNode = memo(CustomNodeBase, (prevProps, nextProps) => {
  return (
    prevProps.data.idx === nextProps.data.idx &&
    prevProps.data.name === nextProps.data.name &&
    prevProps.data.nb_ipid === nextProps.data.nb_ipid &&
    prevProps.data.nb_opid === nextProps.data.nb_opid &&
    prevProps.selected === nextProps.selected &&
    prevProps.data.isMonitored === nextProps.data.isMonitored &&
    prevProps.data.isStalled === nextProps.data.isStalled &&
    arePidListsEqual(prevProps.data.ipid ?? [], nextProps.data.ipid ?? []) &&
    arePidListsEqual(prevProps.data.opid ?? [], nextProps.data.opid ?? [])
  );
});

export default CustomNode;
