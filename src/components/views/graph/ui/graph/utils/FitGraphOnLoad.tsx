import { useEffect, useRef } from 'react';
import { useReactFlow, useNodesInitialized } from '@xyflow/react';

interface FitGraphOnLoadProps {
  nodeCount: number;
  disabled: boolean;
}

const FitGraphOnLoad = ({ nodeCount, disabled }: FitGraphOnLoadProps) => {
  const { fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (disabled || !nodesInitialized || nodeCount === 0) return;
    if (hasFittedRef.current) return;

    hasFittedRef.current = true;
    requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 300, minZoom: 0.01, maxZoom: 1 });
    });
  }, [disabled, nodesInitialized, nodeCount, fitView]);

  return null;
};

export default FitGraphOnLoad;
