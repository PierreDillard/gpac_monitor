import { useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useAppSelector } from '@/shared/hooks/redux';
import { selectSelectedNodeId } from '@/shared/store/selectors/graph/graphSelectors';

const FocusSelectedNode = () => {
  const { fitView, getNodes, setNodes } = useReactFlow();
  const targetId = useAppSelector(selectSelectedNodeId);
  const lastFocusedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (targetId === lastFocusedIdRef.current) return;

    if (!targetId) {
      lastFocusedIdRef.current = null;
      setNodes((nodes) =>
        nodes.map((node) =>
          node.selected ? { ...node, selected: false } : node,
        ),
      );
      void fitView({ padding: 0.2, minZoom: 0.01, maxZoom: 1 });
      return;
    }

    const nodeExists = getNodes().some((node) => node.id === targetId);
    if (!nodeExists) return;

    lastFocusedIdRef.current = targetId;

    setNodes((nodes) =>
      nodes.map((node) => {
        const shouldBeSelected = node.id === targetId;
        return node.selected === shouldBeSelected
          ? node
          : { ...node, selected: shouldBeSelected };
      }),
    );

    void fitView({
      nodes: [{ id: targetId }],
      padding: 0.5,
      minZoom: 0.7,
      maxZoom: 0.7,
    });
  }, [targetId, fitView, getNodes, setNodes]);

  return null;
};

export default FocusSelectedNode;
