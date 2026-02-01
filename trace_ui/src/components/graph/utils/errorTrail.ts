import { TreeNode, ToolExecution, Trace } from "@/types/trace";

export interface ErrorInfo {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  error?: string;
  trailIds: string[]; // IDs of nodes in the path leading to this error
}

/**
 * Computes error trails - the paths leading to each error in the tree
 * Returns a Set of node IDs that are part of any error trail, plus detailed error info
 */
export function computeErrorTrails(tree: TreeNode): {
  errorTrailIds: Set<string>;
  errors: ErrorInfo[];
} {
  const errorTrailIds = new Set<string>();
  const errors: ErrorInfo[] = [];

  function traverse(node: TreeNode, pathIds: string[]): boolean {
    const currentPath = [...pathIds, node.id];

    // Check if this node is an error
    const isError = node.status === "error";

    // Check if any children lead to errors
    const childHasError = node.children.some((child) =>
      traverse(child, currentPath)
    );

    // If this node is an error, record it
    if (isError) {
      // Extract error message from the node data (only Trace and ToolExecution have error)
      let errorMessage: string | undefined;
      if (node.type === "tool" && node.data) {
        errorMessage = (node.data as ToolExecution).error || undefined;
      } else if (node.type === "agent" && node.data) {
        errorMessage = (node.data as Trace).error || undefined;
      }

      errors.push({
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        error: errorMessage,
        trailIds: currentPath,
      });
      currentPath.forEach((id) => errorTrailIds.add(id));
      return true;
    }

    // If any descendant has error, mark this node as part of trail
    if (childHasError) {
      errorTrailIds.add(node.id);
      return true;
    }

    return false;
  }

  traverse(tree, []);
  return { errorTrailIds, errors };
}

/**
 * Gets the trail IDs for a specific error
 */
export function getErrorTrail(
  tree: TreeNode,
  errorNodeId: string
): string[] {
  const trail: string[] = [];

  function findPath(node: TreeNode, path: string[]): boolean {
    const currentPath = [...path, node.id];

    if (node.id === errorNodeId) {
      trail.push(...currentPath);
      return true;
    }

    for (const child of node.children) {
      if (findPath(child, currentPath)) {
        return true;
      }
    }

    return false;
  }

  findPath(tree, []);
  return trail;
}
