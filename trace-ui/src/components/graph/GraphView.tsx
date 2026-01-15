"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
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
import GraphNodeComponent from "./GraphNode";
import GraphEdgeComponent from "./GraphEdge";
import GraphControls from "./GraphControls";
import ErrorIndicator, { FloatingErrorBadge } from "./ErrorIndicator";
import {
  convertTreeToGraph,
  GraphNodeData,
  GraphEdgeData,
  LayoutMode,
} from "./utils/convertTreeToGraph";
import { computeErrorTrails, getErrorTrail } from "./utils/errorTrail";
import { layoutGraph, LayoutDirection } from "./utils/layoutGraph";

// Register custom node and edge types
const nodeTypes = {
  graphNode: GraphNodeComponent,
};

const edgeTypes = {
  graphEdge: GraphEdgeComponent,
};

interface GraphViewInnerProps {
  tree: TreeNode;
  selectedNodeId: string | null;
  onSelectNode: (node: TreeNode) => void;
  direction: LayoutDirection;
  onDirectionChange: (direction: LayoutDirection) => void;
  layoutMode: LayoutMode;
  onLayoutModeChange: (mode: LayoutMode) => void;
}

function GraphViewInner({
  tree,
  selectedNodeId,
  onSelectNode,
  direction,
  onDirectionChange,
  layoutMode,
  onLayoutModeChange,
}: GraphViewInnerProps) {
  const { fitView, setCenter, getZoom } = useReactFlow();
  const [showErrorPanel, setShowErrorPanel] = useState(false);

  // Compute error trails
  const { errorTrailIds, errors } = useMemo(
    () => computeErrorTrails(tree),
    [tree]
  );

  // Convert tree to graph nodes and edges
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const { nodes, edges } = convertTreeToGraph(tree, errorTrailIds, layoutMode);
    const layoutedNodes = layoutGraph(nodes, edges, direction);
    return { nodes: layoutedNodes, edges };
  }, [tree, errorTrailIds, direction, layoutMode]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes and edges when tree, direction, or layoutMode changes
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = convertTreeToGraph(
      tree,
      errorTrailIds,
      layoutMode
    );
    const layoutedNodes = layoutGraph(newNodes, newEdges, direction);
    setNodes(layoutedNodes);
    setEdges(newEdges);

    // Fit view after layout change
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 300 });
    }, 50);
  }, [tree, direction, layoutMode, errorTrailIds, setNodes, setEdges, fitView]);

  // Update selection state when selectedNodeId changes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
      }))
    );
  }, [selectedNodeId, setNodes]);

  // Handle node click
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<GraphNodeData>) => {
      onSelectNode(node.data.originalNode);
    },
    [onSelectNode]
  );

  // Handle error selection - focus on error node and highlight trail
  const handleErrorSelect = useCallback(
    (errorNodeId: string) => {
      // Get the error trail
      const trailIds = getErrorTrail(tree, errorNodeId);

      // Update nodes to highlight error trail
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          selected: node.id === errorNodeId,
          data: {
            ...node.data,
            isErrorTrail: trailIds.includes(node.id) && node.id !== errorNodeId,
          },
        }))
      );

      // Update edges to highlight error trail
      setEdges((eds) =>
        eds.map((edge) => ({
          ...edge,
          data: {
            timeElapsed: edge.data?.timeElapsed,
            sourceType: edge.data?.sourceType || "",
            targetType: edge.data?.targetType || "",
            isErrorTrail:
              trailIds.includes(edge.source) && trailIds.includes(edge.target),
          },
        }))
      );

      // Find the error node and center on it
      const errorNode = nodes.find((n) => n.id === errorNodeId);
      if (errorNode) {
        setCenter(
          errorNode.position.x + 110, // Center of node (width/2)
          errorNode.position.y + 35, // Center of node (height/2)
          { zoom: getZoom(), duration: 500 }
        );

        // Also select the node in the parent
        const originalNode = errorNode.data.originalNode;
        onSelectNode(originalNode);
      }
    },
    [tree, nodes, setNodes, setEdges, setCenter, getZoom, onSelectNode]
  );

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Only handle if graph is focused
      if (
        document.activeElement?.closest(".react-flow") === null &&
        document.activeElement?.tagName !== "BODY"
      ) {
        return;
      }

      switch (e.key) {
        case "+":
        case "=":
          e.preventDefault();
          // Zoom in handled by React Flow
          break;
        case "-":
          e.preventDefault();
          // Zoom out handled by React Flow
          break;
        case "0":
          e.preventDefault();
          fitView({ padding: 0.2, duration: 300 });
          break;
        case "e":
        case "E":
          e.preventDefault();
          if (errors.length > 0) {
            // Jump to next error
            const currentIndex = selectedNodeId
              ? errors.findIndex((err) => err.nodeId === selectedNodeId)
              : -1;
            const nextIndex = (currentIndex + 1) % errors.length;
            handleErrorSelect(errors[nextIndex].nodeId);
          }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [errors, selectedNodeId, fitView, handleErrorSelect]);

  // Custom minimap node color
  const minimapNodeColor = (node: Node<GraphNodeData>) => {
    if (node.data.isError) return "#dc2626";
    if (node.data.isErrorTrail) return "#fca5a5";
    switch (node.data.type) {
      case "agent":
        return "#6366f1";
      case "llm":
        return "#d97706";
      case "tool":
        return "#059669";
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
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: "graphEdge",
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#e5e7eb"
        />
        <MiniMap
          nodeColor={minimapNodeColor}
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bg-white !border-[#e5e7eb]"
        />
      </ReactFlow>

      {/* Controls */}
      <GraphControls
        direction={direction}
        onDirectionChange={onDirectionChange}
        layoutMode={layoutMode}
        onLayoutModeChange={onLayoutModeChange}
      />

      {/* Floating error badge */}
      {errors.length > 0 && (
        <FloatingErrorBadge
          errorCount={errors.length}
          onClick={() => setShowErrorPanel(!showErrorPanel)}
        />
      )}

      {/* Error panel (shown when floating badge is clicked) */}
      {showErrorPanel && errors.length > 0 && (
        <div className="absolute top-16 right-4 z-20">
          <ErrorIndicator errors={errors} onErrorSelect={handleErrorSelect} />
        </div>
      )}
    </div>
  );
}

// Main export with ReactFlowProvider wrapper
interface GraphViewProps {
  tree: TreeNode;
  selectedNodeId: string | null;
  onSelectNode: (node: TreeNode) => void;
}

export default function GraphView({
  tree,
  selectedNodeId,
  onSelectNode,
}: GraphViewProps) {
  const [direction, setDirection] = useState<LayoutDirection>("TB");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("parent-child");

  return (
    <ReactFlowProvider>
      <GraphViewInner
        tree={tree}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
        direction={direction}
        onDirectionChange={setDirection}
        layoutMode={layoutMode}
        onLayoutModeChange={setLayoutMode}
      />
    </ReactFlowProvider>
  );
}
