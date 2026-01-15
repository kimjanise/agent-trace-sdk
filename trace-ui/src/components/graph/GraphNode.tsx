"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { GraphNodeData } from "./utils/convertTreeToGraph";

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTokens(tokens: number | undefined): string {
  if (!tokens) return "—";
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${tokens}`;
}

function getNodeIcon(type: "agent" | "llm" | "tool", isError: boolean) {
  switch (type) {
    case "agent":
      return (
        <div className="w-8 h-8 rounded-lg bg-[#eef2ff] flex items-center justify-center flex-shrink-0">
          <svg
            className="w-4 h-4 text-[#6366f1]"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        </div>
      );
    case "llm":
      return (
        <div className="w-8 h-8 rounded-lg bg-[#fef3c7] flex items-center justify-center flex-shrink-0">
          <svg
            className="w-4 h-4 text-[#d97706]"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
        </div>
      );
    case "tool":
      return (
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isError ? "bg-[#fee2e2]" : "bg-[#d1fae5]"
          }`}
        >
          <svg
            className={`w-4 h-4 ${isError ? "text-[#dc2626]" : "text-[#059669]"}`}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
          </svg>
        </div>
      );
  }
}

function GraphNodeComponent({ data, selected }: NodeProps<GraphNodeData>) {
  const { label, type, duration_ms, tokens, isError, isErrorTrail } = data;

  // Determine border and background styles
  let borderClass = "border-[#e5e7eb]";
  let bgClass = "bg-white";

  if (selected) {
    borderClass = "border-[#6366f1] ring-2 ring-[#6366f1]/20";
    bgClass = "bg-[#fafafa]";
  } else if (isError) {
    borderClass = "border-[#dc2626] border-2";
    bgClass = "bg-[#fef2f2]";
  } else if (isErrorTrail) {
    borderClass = "border-[#fca5a5] border-dashed border-2";
    bgClass = "bg-[#fff5f5]";
  }

  return (
    <>
      {/* Input handle (top for TB, left for LR) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-[#9ca3af] !border-2 !border-white"
      />

      <div
        className={`
          px-3 py-2.5 rounded-lg border shadow-sm cursor-pointer
          transition-all duration-150 hover:shadow-md
          ${borderClass} ${bgClass}
          min-w-[200px]
        `}
      >
        <div className="flex items-center gap-2.5">
          {getNodeIcon(type, isError)}

          <div className="flex-1 min-w-0">
            {/* Node name */}
            <div className="flex items-center gap-2">
              <span
                className={`text-[13px] font-medium truncate ${
                  isError ? "text-[#dc2626]" : "text-[#1f2937]"
                }`}
              >
                {type === "agent" ? "Agent" : type === "llm" ? "LLM" : label}
              </span>
              {isError && (
                <span className="text-[10px] font-semibold text-white bg-[#dc2626] px-1.5 py-0.5 rounded">
                  ERROR
                </span>
              )}
            </div>

            {/* Metadata row */}
            <div className="flex items-center gap-3 mt-1">
              {type === "llm" && (
                <span className="text-[11px] text-[#6b7280] truncate max-w-[100px]">
                  {label}
                </span>
              )}
              <span className="text-[11px] text-[#9ca3af]">
                {formatDuration(duration_ms)}
              </span>
              {tokens !== undefined && tokens > 0 && (
                <span className="text-[11px] text-[#9ca3af]">
                  {formatTokens(tokens)} tok
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Output handle (bottom for TB, right for LR) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-[#9ca3af] !border-2 !border-white"
      />
    </>
  );
}

export default memo(GraphNodeComponent);
