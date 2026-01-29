"use client";

import { TreeNode } from "@/types/trace";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface TraceTreeProps {
  tree: TreeNode;
  selectedNodeId: string | null;
  onSelectNode: (node: TreeNode) => void;
}

function getIcon(type: string, hasError: boolean = false) {
  switch (type) {
    case "agent":
      return (
        <div className="w-6 h-6 rounded bg-[#eef2ff] flex items-center justify-center flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-[#6366f1]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>
      );
    case "llm":
      return (
        <div className="w-6 h-6 rounded bg-[#fef3c7] flex items-center justify-center flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-[#d97706]" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
          </svg>
        </div>
      );
    case "tool":
      return (
        <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${hasError ? "bg-[#fee2e2]" : "bg-[#d1fae5]"}`}>
          <svg className={`w-3.5 h-3.5 ${hasError ? "text-[#dc2626]" : "text-[#059669]"}`} viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
          </svg>
        </div>
      );
    case "stt":
      return (
        <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${hasError ? "bg-[#fee2e2]" : "bg-[#fce7f3]"}`}>
          <svg className={`w-3.5 h-3.5 ${hasError ? "text-[#dc2626]" : "text-[#db2777]"}`} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
          </svg>
        </div>
      );
    case "tts":
      return (
        <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${hasError ? "bg-[#fee2e2]" : "bg-[#e0e7ff]"}`}>
          <svg className={`w-3.5 h-3.5 ${hasError ? "text-[#dc2626]" : "text-[#4f46e5]"}`} viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        </div>
      );
    default:
      return null;
  }
}

function formatDuration(ms: number | null) {
  if (ms === null) return "";
  return `${ms} ms`;
}

function formatCost(tokens: number | undefined) {
  if (!tokens) return "";
  const cost = tokens * 0.000002;
  return `$${cost.toFixed(4)}`;
}

interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  selectedNodeId: string | null;
  onSelectNode: (node: TreeNode) => void;
  isLast: boolean;
}

function TreeNodeItem({ node, depth, selectedNodeId, onSelectNode, isLast }: TreeNodeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedNodeId === node.id;
  const hasError = node.status === "error";

  return (
    <div className="relative">
      {/* Vertical connector line */}
      {depth > 0 && (
        <div
          className="absolute left-[19px] top-0 w-px bg-[#e5e7eb]"
          style={{
            height: isLast ? "20px" : "100%",
          }}
        />
      )}

      {/* Horizontal connector line */}
      {depth > 0 && (
        <div
          className="absolute left-[19px] top-[20px] h-px bg-[#e5e7eb]"
          style={{ width: "12px" }}
        />
      )}

      <div
        onClick={() => onSelectNode(node)}
        className={`
          relative flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
          ${isSelected ? "bg-[#eef2ff]" : hasError ? "bg-[#fef2f2] hover:bg-[#fee2e2]" : "hover:bg-[#f9fafb]"}
        `}
        style={{ paddingLeft: depth > 0 ? `${depth * 28 + 16}px` : "16px" }}
      >
        {/* Expand/collapse button */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-1 hover:bg-[#e5e7eb] rounded flex-shrink-0"
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-[#6b7280]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[#6b7280]" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}

        {/* Icon */}
        {getIcon(node.type, hasError)}

        {/* Name and type */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[14px] font-medium truncate ${hasError ? "text-[#dc2626]" : "text-[#1f2937]"}`}>
              {node.type === "agent" ? "Session" : node.type === "llm" ? "llm" : node.type === "stt" ? "stt" : node.type === "tts" ? "tts" : node.name}
            </span>
            {(node.type === "llm" || node.type === "stt" || node.type === "tts") && (
              <span className="text-[13px] text-[#6b7280]">{node.name}</span>
            )}
            {hasError && (
              <span className="text-[11px] font-medium text-[#dc2626] bg-[#fee2e2] px-1.5 py-0.5 rounded">
                ERROR
              </span>
            )}
          </div>
        </div>

        {/* Duration badge */}
        {node.duration_ms !== null && (
          <span className="text-[12px] text-[#6b7280] bg-[#f3f4f6] px-2 py-1 rounded flex-shrink-0">
            {formatDuration(node.duration_ms)}
          </span>
        )}

        {/* Cost badge (only for nodes with tokens) */}
        {node.tokens !== undefined && node.tokens > 0 && (
          <span className="text-[12px] text-[#6b7280] bg-[#f3f4f6] px-2 py-1 rounded flex-shrink-0">
            {formatCost(node.tokens)}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="relative">
          {node.children.map((child, index) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              isLast={index === node.children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TraceTree({ tree, selectedNodeId, onSelectNode }: TraceTreeProps) {
  return (
    <div className="py-2">
      <TreeNodeItem
        node={tree}
        depth={0}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
        isLast={true}
      />
    </div>
  );
}
