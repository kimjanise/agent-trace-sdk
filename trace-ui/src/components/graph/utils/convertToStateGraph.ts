import { Node, Edge } from "reactflow";
import { TreeNode, LLMCall, ToolExecution, Trace, STTCall, TTSCall } from "@/types/trace";
import { StateGraphNodeData } from "../StateGraphNode";
import { StateGraphEdgeData } from "../StateGraphEdge";

/**
 * Flattens a tree into an array of nodes sorted by started_at timestamp
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
 * Gets the started_at timestamp from a TreeNode
 */
function getStartedAt(node: TreeNode): string | undefined {
  if (node.type === "agent") {
    return (node.data as Trace)?.started_at;
  } else if (node.type === "llm") {
    return (node.data as LLMCall)?.started_at;
  } else if (node.type === "tool") {
    return (node.data as ToolExecution)?.started_at;
  } else if (node.type === "stt") {
    return (node.data as STTCall)?.started_at;
  } else if (node.type === "tts") {
    return (node.data as TTSCall)?.started_at;
  }
  return undefined;
}

/**
 * Truncates a string to a maximum length
 */
function truncateString(str: string | null | undefined, maxLen: number): string | undefined {
  if (!str) return undefined;
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}

/**
 * Extracts preview data for an agent node
 */
function extractAgentPreview(data: Trace) {
  return {
    inputPreview: truncateString(data.input, 100),
    outputPreview: truncateString(data.output, 100),
  };
}

/**
 * Extracts preview data for an LLM node
 */
function extractLLMPreview(data: LLMCall) {
  return {
    model: data.model,
    messageCount: data.request_messages?.length || 0,
    responsePreview: truncateString(data.response_content, 100),
    tokens: data.total_tokens || 0,
  };
}

/**
 * Extracts preview data for a tool node
 */
function extractToolPreview(data: ToolExecution) {
  let argsPreview: string | undefined;
  try {
    const argsStr = JSON.stringify(data.arguments);
    argsPreview = truncateString(argsStr, 100);
  } catch {
    argsPreview = "[complex object]";
  }

  return {
    argsPreview,
    resultPreview: truncateString(data.result, 100),
  };
}

/**
 * Extracts preview data for an STT node
 */
function extractSTTPreview(data: STTCall) {
  return {
    model: data.model,
    transcript: truncateString(data.transcript, 100),
  };
}

/**
 * Extracts preview data for a TTS node
 */
function extractTTSPreview(data: TTSCall) {
  return {
    model: data.model,
    voice: data.voice || undefined,
    textPreview: truncateString(data.input_text, 100),
  };
}

/**
 * Converts a TreeNode to StateGraphNodeData
 */
function convertNodeData(node: TreeNode): StateGraphNodeData {
  const isError = node.status === "error";

  let preview = {};

  if (node.type === "agent" && node.data) {
    preview = extractAgentPreview(node.data as Trace);
  } else if (node.type === "llm" && node.data) {
    preview = extractLLMPreview(node.data as LLMCall);
  } else if (node.type === "tool" && node.data) {
    preview = extractToolPreview(node.data as ToolExecution);
  } else if (node.type === "stt" && node.data) {
    preview = extractSTTPreview(node.data as STTCall);
  } else if (node.type === "tts" && node.data) {
    preview = extractTTSPreview(node.data as TTSCall);
  }

  return {
    id: node.id,
    type: node.type,
    name: node.name,
    status: node.status || "unknown",
    duration_ms: node.duration_ms,
    isError,
    preview,
    originalNode: node,
  };
}

export interface StateGraphResult {
  nodes: Node<StateGraphNodeData>[];
  edges: Edge<StateGraphEdgeData>[];
}

/**
 * Converts a TreeNode structure to React Flow state graph nodes and edges.
 *
 * The graph shows all nodes in chronological order (expanded, no collapsing)
 * with sequential edges connecting them based on execution timeline.
 */
export function convertToStateGraph(tree: TreeNode): StateGraphResult {
  const nodes: Node<StateGraphNodeData>[] = [];
  const edges: Edge<StateGraphEdgeData>[] = [];

  // Flatten and sort by start time
  const flatNodes = flattenTree(tree);
  const sortedNodes = flatNodes.sort((a, b) => {
    const aTime = getStartedAt(a);
    const bTime = getStartedAt(b);
    if (!aTime && !bTime) return 0;
    if (!aTime) return 1;
    if (!bTime) return -1;
    return new Date(aTime).getTime() - new Date(bTime).getTime();
  });

  // Create graph nodes
  sortedNodes.forEach((node) => {
    const graphNode: Node<StateGraphNodeData> = {
      id: node.id,
      type: "stateNode",
      position: { x: 0, y: 0 }, // Will be set by layout
      data: convertNodeData(node),
    };
    nodes.push(graphNode);
  });

  // Create sequential edges
  for (let i = 0; i < nodes.length - 1; i++) {
    const sourceNode = nodes[i];
    const targetNode = nodes[i + 1];

    // Calculate time elapsed between nodes
    const sourceData = sortedNodes[i];
    const targetData = sortedNodes[i + 1];
    const sourceTime = getStartedAt(sourceData);
    const targetTime = getStartedAt(targetData);

    let timeElapsed: number | undefined;
    if (sourceTime && targetTime) {
      timeElapsed =
        new Date(targetTime).getTime() - new Date(sourceTime).getTime();
    }

    edges.push({
      id: `${sourceNode.id}-${targetNode.id}`,
      source: sourceNode.id,
      target: targetNode.id,
      type: "stateEdge",
      data: {
        timeElapsed,
      },
    });
  }

  return { nodes, edges };
}
