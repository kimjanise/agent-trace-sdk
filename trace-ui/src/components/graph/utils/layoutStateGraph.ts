import dagre from "dagre";
import { Node, Edge } from "reactflow";
import { StateGraphNodeData } from "../StateGraphNode";
import { StateGraphEdgeData } from "../StateGraphEdge";

export type LayoutDirection = "TB" | "LR";

// Node dimensions for state graph cards
const NODE_WIDTH = 280;
const NODE_HEIGHT = 120;

/**
 * Calculates positions for state graph nodes using Dagre layout algorithm
 */
export function layoutStateGraph(
  nodes: Node<StateGraphNodeData>[],
  edges: Edge<StateGraphEdgeData>[],
  direction: LayoutDirection = "TB"
): Node<StateGraphNodeData>[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();

  g.setGraph({
    rankdir: direction,
    nodesep: direction === "TB" ? 40 : 60, // Horizontal spacing
    ranksep: direction === "TB" ? 60 : 80, // Vertical spacing
    marginx: 40,
    marginy: 40,
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

export { NODE_WIDTH, NODE_HEIGHT };
