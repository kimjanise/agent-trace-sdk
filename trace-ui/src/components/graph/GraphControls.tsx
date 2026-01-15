"use client";

import { useReactFlow } from "reactflow";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  ArrowDown,
  ArrowRight,
  GitBranch,
  List,
} from "lucide-react";
import { LayoutDirection } from "./utils/layoutGraph";
import { LayoutMode } from "./utils/convertTreeToGraph";

interface GraphControlsProps {
  direction: LayoutDirection;
  onDirectionChange: (direction: LayoutDirection) => void;
  layoutMode: LayoutMode;
  onLayoutModeChange: (mode: LayoutMode) => void;
}

export default function GraphControls({
  direction,
  onDirectionChange,
  layoutMode,
  onLayoutModeChange,
}: GraphControlsProps) {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow();

  const handleReset = () => {
    setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 });
  };

  const handleFitView = () => {
    fitView({ padding: 0.2, duration: 300 });
  };

  const toggleDirection = () => {
    onDirectionChange(direction === "TB" ? "LR" : "TB");
  };

  const toggleLayoutMode = () => {
    onLayoutModeChange(layoutMode === "parent-child" ? "sequential" : "parent-child");
  };

  return (
    <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-white border border-[#e5e7eb] rounded-lg shadow-sm p-1 z-10">
      {/* Layout mode toggle */}
      <div className="flex items-center bg-[#f3f4f6] rounded-md p-0.5">
        <button
          onClick={() => onLayoutModeChange("parent-child")}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded transition-colors ${
            layoutMode === "parent-child"
              ? "bg-white text-[#1f2937] shadow-sm"
              : "text-[#6b7280] hover:text-[#1f2937]"
          }`}
          title="Parent-child layout (hierarchical)"
        >
          <GitBranch className="w-4 h-4" />
          <span className="text-[11px] font-medium">Hierarchy</span>
        </button>
        <button
          onClick={() => onLayoutModeChange("sequential")}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded transition-colors ${
            layoutMode === "sequential"
              ? "bg-white text-[#1f2937] shadow-sm"
              : "text-[#6b7280] hover:text-[#1f2937]"
          }`}
          title="Sequential layout (chronological)"
        >
          <List className="w-4 h-4" />
          <span className="text-[11px] font-medium">Sequential</span>
        </button>
      </div>

      <div className="w-px h-6 bg-[#e5e7eb] mx-1" />

      {/* Zoom controls */}
      <button
        onClick={() => zoomIn({ duration: 200 })}
        className="p-2 hover:bg-[#f3f4f6] rounded-md transition-colors text-[#6b7280] hover:text-[#1f2937]"
        title="Zoom in (+)"
      >
        <ZoomIn className="w-4 h-4" />
      </button>
      <button
        onClick={() => zoomOut({ duration: 200 })}
        className="p-2 hover:bg-[#f3f4f6] rounded-md transition-colors text-[#6b7280] hover:text-[#1f2937]"
        title="Zoom out (-)"
      >
        <ZoomOut className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-[#e5e7eb] mx-1" />

      {/* Fit and reset */}
      <button
        onClick={handleFitView}
        className="p-2 hover:bg-[#f3f4f6] rounded-md transition-colors text-[#6b7280] hover:text-[#1f2937]"
        title="Fit to screen (0)"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
      <button
        onClick={handleReset}
        className="p-2 hover:bg-[#f3f4f6] rounded-md transition-colors text-[#6b7280] hover:text-[#1f2937]"
        title="Reset view"
      >
        <RotateCcw className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-[#e5e7eb] mx-1" />

      {/* Direction toggle */}
      <button
        onClick={toggleDirection}
        className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-[#f3f4f6] rounded-md transition-colors text-[#6b7280] hover:text-[#1f2937]"
        title={`Switch to ${direction === "TB" ? "horizontal" : "vertical"} layout`}
      >
        {direction === "TB" ? (
          <>
            <ArrowDown className="w-4 h-4" />
            <span className="text-[11px] font-medium">Vertical</span>
          </>
        ) : (
          <>
            <ArrowRight className="w-4 h-4" />
            <span className="text-[11px] font-medium">Horizontal</span>
          </>
        )}
      </button>
    </div>
  );
}
