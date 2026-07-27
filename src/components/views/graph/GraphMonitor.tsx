import { memo } from 'react';
import { WidgetProps } from '../../../types/ui/widget';
import useGraphMonitor from './hooks/state/useGraphMonitor';
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

  return (
    <>
      <GraphMonitorUI
        id={id}
        isLoading={isLoading}
        connectionError={connectionError}
        retryConnection={retryConnection}
        nodes={localNodes}
        edges={localEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
      />
    </>
  );
};

export default memo(GraphMonitor);
