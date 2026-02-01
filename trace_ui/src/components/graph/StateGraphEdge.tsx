"use client";

import { memo, useState } from "react";
import {
  BaseEdge,
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
} from "reactflow";

export interface StateGraphEdgeData {
  timeElapsed?: number;
}

function formatTimeElapsed(ms: number | undefined): string {
  if (ms === undefined) return "";
  if (ms < 1000) return `+${ms}ms`;
  return `+${(ms / 1000).toFixed(2)}s`;
}

function StateGraphEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<StateGraphEdgeData>) {
  const [isHovered, setIsHovered] = useState(false);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const timeElapsed = data?.timeElapsed;
  const showLabel = (isHovered || selected) && timeElapsed !== undefined;

  // Edge styling
  const strokeColor = selected ? "#6366f1" : "#d1d5db";
  const strokeWidth = selected || isHovered ? 2 : 1.5;

  return (
    <>
      {/* Invisible wider path for easier hover detection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Visible edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          transition: "stroke 0.2s, stroke-width 0.2s",
        }}
        markerEnd={`url(#arrow-${selected ? "selected" : "default"})`}
      />

      {/* Time elapsed tooltip on hover */}
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "none",
            }}
            className="px-2 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-md shadow-lg"
          >
            {formatTimeElapsed(timeElapsed)}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Arrow markers */}
      <defs>
        <marker
          id="arrow-default"
          markerWidth="12"
          markerHeight="12"
          refX="8"
          refY="6"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M2,2 L2,10 L10,6 z" fill="#d1d5db" />
        </marker>
        <marker
          id="arrow-selected"
          markerWidth="12"
          markerHeight="12"
          refX="8"
          refY="6"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M2,2 L2,10 L10,6 z" fill="#6366f1" />
        </marker>
      </defs>
    </>
  );
}

export default memo(StateGraphEdgeComponent);
