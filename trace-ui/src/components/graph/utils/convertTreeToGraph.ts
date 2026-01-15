import { Node, Edge } from "reactflow";
import { TreeNode, LLMCall, ToolExecution, Trace } from "@/types/trace";

export type LayoutMode = "parent-child" | "sequential";

export interface GraphNodeData {
  label: string;
  type: "agent" | "llm" | "tool";
  duration_ms: number | null;
  tokens?: number;
  status?: string;
  isError: boolean;
  isErrorTrail: boolean;
  originalNode: TreeNode;
  startedAt?: string;
}

export interface GraphEdgeData {
  timeElapsed?: number;
  isErrorTrail: boolean;
  sourceType?: string;
  targetType?: string;
}

function getStartedAt(node: TreeNode): string | undefined {
  if (node.type === "agent") {
    return (node.data as Trace)?.started_at;
  } else if (node.type === "llm") {
    return (node.data as LLMCall)?.started_at;
  } else if (node.type === "tool") {
    return (node.data as ToolExecution)?.started_at;
  }
  return undefined;
}

/**
 * Flattens a tree into an array of nodes for sequential processing
 */
function flattenTree(tree: TreeNode): TreeNode[] {
  const result: TreeNode[] = [];

  function traverse(node: TreeNode) {
    result.push(node);
    node.children.forEach(traverse);
  }

  traverse(tree);
  return result;
}

/**
 * Converts a TreeNode structure to React Flow nodes and edges (Parent-Child layout)
 */
function convertToParentChildGraph(
  tree: TreeNode,
  errorTrailIds: Set<string>
): { nodes: Node<GraphNodeData>[]; edges: Edge<GraphEdgeData>[] } {
  const nodes: Node<GraphNodeData>[] = [];
  const edges: Edge<GraphEdgeData>[] = [];

  function traverse(node: TreeNode, parentId: string | null) {
    const isError = node.status === "error";
    const isErrorTrail = errorTrailIds.has(node.id);

    const graphNode: Node<GraphNodeData> = {
      id: node.id,
      type: "graphNode",
      position: { x: 0, y: 0 },
      data: {
        label: node.name,
        type: node.type as "agent" | "llm" | "tool",
        duration_ms: node.duration_ms,
        tokens: node.tokens,
        status: node.status,
        isError,
        isErrorTrail: isErrorTrail && !isError,
        originalNode: node,
        startedAt: getStartedAt(node),
      },
    };

    nodes.push(graphNode);

    if (parentId) {
      const parentNode = nodes.find((n) => n.id === parentId);
      const parentStartedAt = parentNode?.data.startedAt;
      const currentStartedAt = graphNode.data.startedAt;

      let timeElapsed: number | undefined;
      if (parentStartedAt && currentStartedAt) {
        timeElapsed =
          new Date(currentStartedAt).getTime() -
          new Date(parentStartedAt).getTime();
      }

      const isEdgeErrorTrail =
        errorTrailIds.has(parentId) && errorTrailIds.has(node.id);

      edges.push({
        id: `${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        type: "graphEdge",
        data: {
          timeElapsed,
          isErrorTrail: isEdgeErrorTrail,
          sourceType: parentNode?.data.type || "agent",
          targetType: node.type,
        },
      });
    }

    node.children.forEach((child) => {
      traverse(child, node.id);
    });
  }

  traverse(tree, null);

  return { nodes, edges };
}

interface NodeTimeInfo {
  node: TreeNode;
  startTime: number;
  endTime: number;
  graphNode: Node<GraphNodeData>;
}

/**
 * Gets the end time of a node (started_at + duration_ms)
 */
function getEndTime(node: TreeNode): number | undefined {
  const startedAt = getStartedAt(node);
  if (!startedAt) return undefined;
  const startTime = new Date(startedAt).getTime();
  // If no duration, assume node ends when it starts (instant)
  const duration = node.duration_ms ?? 0;
  return startTime + duration;
}

/**
 * Detects parallel execution groups based on:
 * 1. Time overlap (one starts before another ends), OR
 * 2. Close start times (started within threshold of any node in the group)
 *
 * The second condition catches parallel execution where durations are small
 * or timestamps lack millisecond precision.
 */
function detectParallelGroups(nodeInfos: NodeTimeInfo[]): NodeTimeInfo[][] {
  if (nodeInfos.length === 0) return [];

  // Threshold for considering nodes as "started together" (in ms)
  // Nodes starting within this window of each other are considered parallel
  const PARALLEL_START_THRESHOLD_MS = 500;

  const groups: NodeTimeInfo[][] = [];
  let currentGroup: NodeTimeInfo[] = [nodeInfos[0]];
  let groupLatestStartTime = nodeInfos[0].startTime;
  let groupEndTime = nodeInfos[0].endTime;

  for (let i = 1; i < nodeInfos.length; i++) {
    const current = nodeInfos[i];

    // Check if this node is parallel with the current group:
    // 1. Time overlap: starts before the group ends, OR
    // 2. Close start: started within threshold of the latest node in the group
    const hasTimeOverlap = current.startTime < groupEndTime;
    const hasCloseStart =
      current.startTime - groupLatestStartTime < PARALLEL_START_THRESHOLD_MS;

    if (hasTimeOverlap || hasCloseStart) {
      // Parallel - add to current group
      currentGroup.push(current);
      // Extend group boundaries
      groupLatestStartTime = Math.max(groupLatestStartTime, current.startTime);
      groupEndTime = Math.max(groupEndTime, current.endTime);
    } else {
      // Sequential - start new group
      groups.push(currentGroup);
      currentGroup = [current];
      groupLatestStartTime = current.startTime;
      groupEndTime = current.endTime;
    }
  }

  // Don't forget the last group
  groups.push(currentGroup);

  return groups;
}

/**
 * Converts a TreeNode structure to React Flow nodes and edges (Sequential layout)
 * Properly handles parallel execution by detecting time overlaps and creating
 * fork-join patterns for concurrent nodes
 */
function convertToSequentialGraph(
  tree: TreeNode,
  errorTrailIds: Set<string>
): { nodes: Node<GraphNodeData>[]; edges: Edge<GraphEdgeData>[] } {
  const nodes: Node<GraphNodeData>[] = [];
  const edges: Edge<GraphEdgeData>[] = [];

  // Flatten tree and create node info with timing
  const flatNodes = flattenTree(tree);

  // Create graph nodes and timing info
  const nodeInfos: NodeTimeInfo[] = flatNodes
    .map((node) => {
      const startedAt = getStartedAt(node);
      const startTime = startedAt ? new Date(startedAt).getTime() : 0;
      const endTime = getEndTime(node) ?? startTime;

      const isError = node.status === "error";
      const isErrorTrail = errorTrailIds.has(node.id);

      const graphNode: Node<GraphNodeData> = {
        id: node.id,
        type: "graphNode",
        position: { x: 0, y: 0 },
        data: {
          label: node.name,
          type: node.type as "agent" | "llm" | "tool",
          duration_ms: node.duration_ms,
          tokens: node.tokens,
          status: node.status,
          isError,
          isErrorTrail: isErrorTrail && !isError,
          originalNode: node,
          startedAt,
        },
      };

      return { node, startTime, endTime, graphNode };
    })
    .sort((a, b) => a.startTime - b.startTime);

  // Add all graph nodes
  nodeInfos.forEach((info) => nodes.push(info.graphNode));

  // Detect parallel groups
  const groups = detectParallelGroups(nodeInfos);

  // Create edges based on groups
  for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
    const currentGroup = groups[groupIdx];
    const nextGroup = groups[groupIdx + 1];

    if (currentGroup.length === 1 && nextGroup) {
      // Single node in group - connect to all nodes in next group
      const sourceNode = currentGroup[0].graphNode;

      if (nextGroup.length === 1) {
        // Simple sequential connection
        const targetNode = nextGroup[0].graphNode;
        const timeElapsed =
          sourceNode.data.startedAt && targetNode.data.startedAt
            ? new Date(targetNode.data.startedAt).getTime() -
              new Date(sourceNode.data.startedAt).getTime()
            : undefined;

        const isEdgeErrorTrail =
          errorTrailIds.has(sourceNode.id) && errorTrailIds.has(targetNode.id);

        edges.push({
          id: `${sourceNode.id}-${targetNode.id}`,
          source: sourceNode.id,
          target: targetNode.id,
          type: "graphEdge",
          data: {
            timeElapsed,
            isErrorTrail: isEdgeErrorTrail,
            sourceType: sourceNode.data.type,
            targetType: targetNode.data.type,
          },
        });
      } else {
        // Fork: single node connects to multiple parallel nodes
        nextGroup.forEach((targetInfo) => {
          const targetNode = targetInfo.graphNode;
          const timeElapsed =
            sourceNode.data.startedAt && targetNode.data.startedAt
              ? new Date(targetNode.data.startedAt).getTime() -
                new Date(sourceNode.data.startedAt).getTime()
              : undefined;

          const isEdgeErrorTrail =
            errorTrailIds.has(sourceNode.id) &&
            errorTrailIds.has(targetNode.id);

          edges.push({
            id: `${sourceNode.id}-${targetNode.id}`,
            source: sourceNode.id,
            target: targetNode.id,
            type: "graphEdge",
            data: {
              timeElapsed,
              isErrorTrail: isEdgeErrorTrail,
              sourceType: sourceNode.data.type,
              targetType: targetNode.data.type,
            },
          });
        });
      }
    } else if (currentGroup.length > 1 && nextGroup) {
      // Multiple nodes in group (parallel) - all connect to next group
      if (nextGroup.length === 1) {
        // Join: multiple parallel nodes converge to single node
        const targetNode = nextGroup[0].graphNode;

        currentGroup.forEach((sourceInfo) => {
          const sourceNode = sourceInfo.graphNode;
          const timeElapsed =
            sourceNode.data.startedAt && targetNode.data.startedAt
              ? new Date(targetNode.data.startedAt).getTime() -
                new Date(sourceNode.data.startedAt).getTime()
              : undefined;

          const isEdgeErrorTrail =
            errorTrailIds.has(sourceNode.id) &&
            errorTrailIds.has(targetNode.id);

          edges.push({
            id: `${sourceNode.id}-${targetNode.id}`,
            source: sourceNode.id,
            target: targetNode.id,
            type: "graphEdge",
            data: {
              timeElapsed,
              isErrorTrail: isEdgeErrorTrail,
              sourceType: sourceNode.data.type,
              targetType: targetNode.data.type,
            },
          });
        });
      } else {
        // Parallel to parallel: connect based on end time ordering
        // Sort current group by end time, next group by start time
        const sortedCurrent = [...currentGroup].sort(
          (a, b) => a.endTime - b.endTime
        );
        const sortedNext = [...nextGroup].sort(
          (a, b) => a.startTime - b.startTime
        );

        // Connect last finishing node to all nodes in next parallel group
        const lastFinishing = sortedCurrent[sortedCurrent.length - 1];
        sortedNext.forEach((targetInfo) => {
          const sourceNode = lastFinishing.graphNode;
          const targetNode = targetInfo.graphNode;
          const timeElapsed =
            sourceNode.data.startedAt && targetNode.data.startedAt
              ? new Date(targetNode.data.startedAt).getTime() -
                new Date(sourceNode.data.startedAt).getTime()
              : undefined;

          const isEdgeErrorTrail =
            errorTrailIds.has(sourceNode.id) &&
            errorTrailIds.has(targetNode.id);

          edges.push({
            id: `${sourceNode.id}-${targetNode.id}`,
            source: sourceNode.id,
            target: targetNode.id,
            type: "graphEdge",
            data: {
              timeElapsed,
              isErrorTrail: isEdgeErrorTrail,
              sourceType: sourceNode.data.type,
              targetType: targetNode.data.type,
            },
          });
        });
      }
    }
  }

  return { nodes, edges };
}

/**
 * Converts a TreeNode structure to React Flow nodes and edges
 */
export function convertTreeToGraph(
  tree: TreeNode,
  errorTrailIds: Set<string>,
  layoutMode: LayoutMode = "parent-child"
): { nodes: Node<GraphNodeData>[]; edges: Edge<GraphEdgeData>[] } {
  if (layoutMode === "sequential") {
    return convertToSequentialGraph(tree, errorTrailIds);
  }
  return convertToParentChildGraph(tree, errorTrailIds);
}

/**
 * Counts total nodes by type for summary display
 */
export function countNodesByType(nodes: Node<GraphNodeData>[]): {
  agents: number;
  llmCalls: number;
  toolCalls: number;
  errors: number;
} {
  return nodes.reduce(
    (acc, node) => {
      if (node.data.type === "agent") acc.agents++;
      else if (node.data.type === "llm") acc.llmCalls++;
      else if (node.data.type === "tool") acc.toolCalls++;
      if (node.data.isError) acc.errors++;
      return acc;
    },
    { agents: 0, llmCalls: 0, toolCalls: 0, errors: 0 }
  );
}
