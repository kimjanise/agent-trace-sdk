"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeProps,
  EdgeLabelRenderer,
  getBezierPath,
} from "reactflow";
import { GraphEdgeData } from "./utils/convertTreeToGraph";

function formatTimeElapsed(ms: number | undefined): string {
  if (ms === undefined) return "";
  if (ms < 1000) return `+${ms}ms`;
  return `+${(ms / 1000).toFixed(2)}s`;
}

function GraphEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<GraphEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isErrorTrail = data?.isErrorTrail ?? false;
  const timeElapsed = data?.timeElapsed;

  // Edge styling based on state
  let strokeColor = "#d1d5db"; // Default gray
  let strokeWidth = 1.5;
  let strokeDasharray = "none";

  if (selected) {
    strokeColor = "#6366f1"; // Indigo when selected
    strokeWidth = 2;
  } else if (isErrorTrail) {
    strokeColor = "#f87171"; // Red for error trail
    strokeWidth = 2;
    strokeDasharray = "5,5";
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray,
        }}
      />

      {/* Show time elapsed label when edge is selected */}
      {selected && timeElapsed !== undefined && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            className="px-2 py-1 bg-white border border-[#e5e7eb] rounded-md shadow-sm text-[11px] text-[#6b7280] font-medium"
          >
            {formatTimeElapsed(timeElapsed)}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Arrow marker */}
      <defs>
        <marker
          id={`arrow-${id}`}
          markerWidth="12"
          markerHeight="12"
          refX="10"
          refY="6"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path
            d="M0,0 L0,12 L12,6 z"
            fill={strokeColor}
          />
        </marker>
      </defs>
    </>
  );
}

export default memo(GraphEdgeComponent);
