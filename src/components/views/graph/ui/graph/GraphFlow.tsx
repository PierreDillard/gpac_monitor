import React, { memo, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Background,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  NodeMouseHandler,
  EdgeMouseHandler,
  Controls,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import CustomNode from '../nodes/CustomNode';
import GraphLegend from './GraphLegend';
import FitGraphOnLoad from './utils/FitGraphOnLoad';
import FocusSelectedNode from './utils/FocusSelectedNode';
import { useMinimapNavigation } from '../../hooks/layout/useMinimapNavigation';
import { getImmediateGraphColor } from '../../hooks/layout/useGraphColors';
import { useAppDispatch } from '@/shared/hooks/redux';
import { closeSidebar } from '@/shared/store/slices/layoutSlice';

interface GraphFlowProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onNodeClick?: NodeMouseHandler;
  onEdgeClick?: EdgeMouseHandler;
  isResizing?: boolean;
}

const flowStyles = {
  surface: '#101722',
  background: '',
  width: '100%',
  height: '100%',
};
const nodeTypes = {
  gpac: CustomNode,
};
const defaultEdgeOptions = {
  type: 'simplebezier' as const,
  style: { stroke: '#6b7280', strokeWidth: 3 },
  ariaLabel: 'Clickable edge to see IPID properties',
  interactionWidth: 20,
};
const minimapStyle = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
};

const GraphFlow: React.FC<GraphFlowProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onEdgeClick,
  isResizing = false,
}) => {
  const dispatch = useAppDispatch();
  const { handleMiniMapClick, handleMiniMapDrag } = useMinimapNavigation();

  // Close sidebar when clicking on empty area of the graph
  const handlePaneClick = useCallback(() => {
    dispatch(closeSidebar());
  }, [dispatch]);

  return (
    <div style={flowStyles} className={isResizing ? 'resize-optimized' : ''}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesConnectable={false}
        onNodesChange={isResizing ? () => {} : onNodesChange}
        onEdgesChange={isResizing ? () => {} : onEdgesChange}
        onNodeClick={isResizing ? undefined : onNodeClick}
        onEdgeClick={isResizing ? undefined : onEdgeClick}
        onPaneClick={isResizing ? undefined : handlePaneClick}
        minZoom={0.01}
        maxZoom={2}
        defaultEdgeOptions={defaultEdgeOptions}
        defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
        proOptions={{ hideAttribution: true }}
        selectionKeyCode={null}
      >
        <FitGraphOnLoad nodeCount={nodes.length} disabled={isResizing} />
        <FocusSelectedNode />
        <Background color="#4b5563" gap={16} />
        <MiniMap
          nodeColor={getImmediateGraphColor}
          nodeStrokeWidth={2}
          nodeStrokeColor="#374151"
          maskColor="rgba(0, 0, 0, 0.5)"
          className="bg-gray-900 border border-gray-900 rounded-md w-52 h-36"
          style={minimapStyle}
          onClick={isResizing ? undefined : handleMiniMapClick}
          onDrag={isResizing ? undefined : handleMiniMapDrag}
          pannable={!isResizing}
          zoomable={!isResizing}
          position="bottom-left"
          ariaLabel="Minimap for graph navigation"
        />
        <Controls
          showInteractive={false}
          className="[&_button]:bg-gray-800 [&_button]:border-gray-700 [&_button]:text-white [&_button:hover]:bg-gray-700"
          position="center-left"
        />

        <GraphLegend />
      </ReactFlow>
    </div>
  );
};

export default memo(GraphFlow);
