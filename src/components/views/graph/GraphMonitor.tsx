import { memo } from 'react';
import { WidgetProps } from '../../../types/ui/widget';
import useGraphMonitor from './hooks/state/useGraphMonitor';
import { useMonitoredPidEdges } from './hooks/state/useMonitoredPidEdges';
import { GraphMonitorUI } from './ui';

const GraphMonitor = ({ id }: WidgetProps) => {
  const {
    isLoading,
    connectionError,
    retryConnection,
    localNodes,
    localEdges,
    handleNodesChange,
    handleEdgesChange,
    handleNodeClick,
    handleEdgeClick,
  } = useGraphMonitor();
  const monitoredPidEdges = useMonitoredPidEdges(localEdges);

  return (
    <>
      <GraphMonitorUI
        id={id}
        isLoading={isLoading}
        connectionError={connectionError}
        retryConnection={retryConnection}
        nodes={localNodes}
        edges={monitoredPidEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
      />
    </>
  );
};

export default memo(GraphMonitor);
