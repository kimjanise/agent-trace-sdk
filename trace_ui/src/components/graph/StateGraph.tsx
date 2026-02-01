"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Node,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MiniMap,
  Background,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";

import { TreeNode } from "@/types/trace";
import StateGraphNodeComponent, { StateGraphNodeData } from "./StateGraphNode";
import StateGraphEdgeComponent from "./StateGraphEdge";
import StateGraphControls, { LayoutDirection } from "./StateGraphControls";
import StateGraphDetail from "./StateGraphDetail";
import { convertToStateGraph } from "./utils/convertToStateGraph";
import { layoutStateGraph } from "./utils/layoutStateGraph";

// Register custom node and edge types
const nodeTypes = {
  stateNode: StateGraphNodeComponent,
};

const edgeTypes = {
  stateEdge: StateGraphEdgeComponent,
};

interface StateGraphInnerProps {
  tree: TreeNode;
  direction: LayoutDirection;
  onDirectionChange: (direction: LayoutDirection) => void;
}

function StateGraphInner({
  tree,
  direction,
  onDirectionChange,
}: StateGraphInnerProps) {
  const { fitView } = useReactFlow();
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);

  // Convert tree to state graph
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const { nodes, edges } = convertToStateGraph(tree);
    const layoutedNodes = layoutStateGraph(nodes, edges, direction);
    return { nodes: layoutedNodes, edges };
  }, [tree, direction]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update graph when tree or direction changes
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = convertToStateGraph(tree);
    const layoutedNodes = layoutStateGraph(newNodes, newEdges, direction);
    setNodes(layoutedNodes);
    setEdges(newEdges);

    // Fit view after layout change
    setTimeout(() => {
      fitView({ padding: 0.15, duration: 300 });
    }, 50);
  }, [tree, direction, setNodes, setEdges, fitView]);

  // Update selection state
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        selected: selectedNode ? node.id === selectedNode.id : false,
      }))
    );
  }, [selectedNode, setNodes]);

  // Handle node click
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<StateGraphNodeData>) => {
      setSelectedNode(node.data.originalNode as TreeNode);
    },
    []
  );

  // Handle closing detail panel
  const handleCloseDetail = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Custom minimap node color
  const minimapNodeColor = (node: Node<StateGraphNodeData>) => {
    if (node.data.isError) return "#ef4444";
    switch (node.data.type) {
      case "agent":
        return "#6366f1";
      case "llm":
        return "#f59e0b";
      case "tool":
        return "#10b981";
      default:
        return "#6b7280";
    }
  };

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: "stateEdge",
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#e5e7eb"
        />
        <MiniMap
          nodeColor={minimapNodeColor}
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bg-white !border-gray-200 !rounded-lg"
          style={{ width: 150, height: 100 }}
        />
      </ReactFlow>

      {/* Controls */}
      <StateGraphControls
        direction={direction}
        onDirectionChange={onDirectionChange}
      />

      {/* Detail panel */}
      <StateGraphDetail node={selectedNode} onClose={handleCloseDetail} />
    </div>
  );
}

// Main export with ReactFlowProvider wrapper
interface StateGraphProps {
  tree: TreeNode;
}

export default function StateGraph({ tree }: StateGraphProps) {
  const [direction, setDirection] = useState<LayoutDirection>("TB");

  return (
    <ReactFlowProvider>
      <StateGraphInner
        tree={tree}
        direction={direction}
        onDirectionChange={setDirection}
      />
    </ReactFlowProvider>
  );
}
