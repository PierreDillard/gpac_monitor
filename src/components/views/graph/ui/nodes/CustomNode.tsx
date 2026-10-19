import React, { useMemo, memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { GraphFilterData } from '@/types/domain/gpac';
import { determineFilterSessionType } from '../../utils/filterType';
import { useGraphColors } from '../../hooks/layout/useGraphColors';
import { useFilterAlerts } from '@/shared/hooks';
import { getBasename, truncateMiddle } from '../../utils/labelUtils';
import { arePidListsEqual } from '../../utils/pidComparator';
import NodeToolbarActions from './NodeToolbarActions';
import NodeHeader from './NodeHeader';
import PidList from './PidList';

interface CustomNodeProps extends NodeProps {
  data: GraphFilterData & {
    label: string;
    filterType: string;
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

  const isMonitored = data.isMonitored;
  const borderClass = isMonitored
    ? 'ring-4 ring-red-700/90'
    : selected
      ? 'ring-2 ring-sky-400'
      : 'ring-1 ring-monitor-line';

  // Memoize style objects
  const containerStyle = useMemo(
    () => ({
      borderColor: backgroundColor,
      backgroundColor: `color-mix(in srgb, ${backgroundColor} 50%, #101722)`,
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
        <NodeHeader
          filterIdx={data.idx}
          fullLabel={fullLabel}
          displayLabel={displayLabel}
          sessionType={sessionType}
          hasError={hasError}
          hasWarning={hasWarning}
          headerStyle={headerStyle}
          textStyle={textStyle}
        />

        {/* Node content */}
        <div className="node-drag-handle ">
          <div className="flex justify-between items-start mb-2 -mx-4">
            <PidList
              direction="input"
              count={nb_ipid}
              pids={ipid}
              handleStyle={handleStyle}
            />
            <PidList
              direction="output"
              count={nb_opid}
              pids={opid}
              handleStyle={handleStyle}
            />
          </div>

          {/* Statistics */}
          <div className="text-xs text-gray-100 pt-2 border-t border-gray-300 text-center">
            IPIDs: {nb_ipid} | OPIDs: {nb_opid}
          </div>
        </div>
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
    arePidListsEqual(prevProps.data.ipid ?? [], nextProps.data.ipid ?? []) &&
    arePidListsEqual(prevProps.data.opid ?? [], nextProps.data.opid ?? [])
  );
});

export default CustomNode;
