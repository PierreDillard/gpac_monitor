import type { CSSProperties } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { GraphInputPid, GraphOutputPid } from '@/types/domain/gpac';
import { getBasename, truncateMiddle } from '../../utils/labelUtils';

interface PidListProps {
  direction: 'input' | 'output';
  count: number;
  pids: readonly (GraphInputPid | GraphOutputPid)[];
  handleStyle: CSSProperties;
}

export default function PidList({
  direction,
  count,
  pids,
  handleStyle,
}: PidListProps) {
  const isInput = direction === 'input';
  const alignmentClass = isInput ? 'text-left' : 'text-right';
  const labelPaddingClass = isInput ? 'pl-4 pr-2' : 'pl-2 pr-4';

  return (
    <div className={`flex-1 min-w-0 text-xs ${alignmentClass}`}>
      {count > 0 && (
        <>
          <span className="font-medium text-white block px-4">
            {isInput ? 'INPUTS' : 'OUTPUTS'}
          </span>
          <div className="mt-1">
            {pids.map((pid) => (
              <div
                key={pid.pid_index}
                className="relative text-xs text-gray-100"
                title={pid.name}
              >
                <span className={`block truncate ${labelPaddingClass}`}>
                  {truncateMiddle(getBasename(pid.name), 18)}
                </span>
                <Handle
                  id={`${isInput ? 'ipid' : 'opid'}-${pid.pid_index}`}
                  type={isInput ? 'target' : 'source'}
                  position={isInput ? Position.Left : Position.Right}
                  style={handleStyle}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
