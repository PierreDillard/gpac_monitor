import React, { useState } from 'react';
import WidgetWrapper from '@/components/widget/WidgetWrapper';
import { useOptimizedResize } from '@/shared/hooks/ui/useOptimizedResize';
import LoadingState from '@/components/common/LoadingState';
import ConnectionErrorState from '@/components/common/ConnectionErrorState';
import GraphFlow from './GraphFlow';
import { WidgetProps } from '@/types/ui/widget';
import {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  NodeMouseHandler,
  EdgeMouseHandler,
} from '@xyflow/react';

interface GraphMonitorUIProps extends Omit<WidgetProps, 'config'> {
  isLoading: boolean;
  connectionError: string | null;
  retryConnection: () => void;
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onNodeClick?: NodeMouseHandler;
  onEdgeClick?: EdgeMouseHandler;
}

const GraphMonitorUI: React.FC<GraphMonitorUIProps> = ({
  id,
  isLoading,
  connectionError,
  retryConnection,
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onEdgeClick,
}) => {
  const [isResizing, setIsResizing] = useState(false);

  // Optimize ReactFlow during resize
  const { ref } = useOptimizedResize({
    onResizeStart: () => setIsResizing(true),
    onResizeEnd: () => setIsResizing(false),
    debounce: 24, // Slightly higher for heavy graph operations
    throttle: true,
  }) as { ref: React.RefObject<HTMLElement> };
  const containerRef = ref as React.RefObject<HTMLDivElement>;
  if (isLoading) {
    return <LoadingState id={id} message="Connecting to GPAC..." />;
  }

  if (connectionError) {
    return (
      <ConnectionErrorState
        id={id}
        errorMessage={connectionError}
        onRetry={retryConnection}
      />
    );
  }

  return (
    <WidgetWrapper id={id}>
      <div
        ref={containerRef}
        className={`relative h-full w-full ${isResizing ? 'contain-layout contain-style pointer-events-none' : ''}`}
      >
        <GraphFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          isResizing={isResizing}
        />
      </div>
    </WidgetWrapper>
  );
};

export default React.memo(GraphMonitorUI);
