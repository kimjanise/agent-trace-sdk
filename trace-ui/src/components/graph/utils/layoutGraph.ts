import dagre from "dagre";
import { Node, Edge } from "reactflow";
import { GraphNodeData, GraphEdgeData } from "./convertTreeToGraph";

export type LayoutDirection = "TB" | "LR";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 70;

/**
 * Calculates positions for nodes using Dagre layout algorithm
 */
export function layoutGraph(
  nodes: Node<GraphNodeData>[],
  edges: Edge<GraphEdgeData>[],
  direction: LayoutDirection = "TB"
): Node<GraphNodeData>[] {
  const g = new dagre.graphlib.Graph();

  g.setGraph({
    rankdir: direction,
    nodesep: 60, // Horizontal spacing between nodes
    ranksep: 80, // Vertical spacing between ranks
    marginx: 20,
    marginy: 20,
  });

  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes to the graph
  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  // Add edges to the graph
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(g);

  // Apply calculated positions to nodes
  return nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });
}

/**
 * Gets the bounds of the graph for fit-to-view calculations
 */
export function getGraphBounds(nodes: Node<GraphNodeData>[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  const minX = Math.min(...nodes.map((n) => n.position.x));
  const minY = Math.min(...nodes.map((n) => n.position.y));
  const maxX = Math.max(...nodes.map((n) => n.position.x + NODE_WIDTH));
  const maxY = Math.max(...nodes.map((n) => n.position.y + NODE_HEIGHT));

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export { NODE_WIDTH, NODE_HEIGHT };
