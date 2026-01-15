"use client";

import { useReactFlow } from "reactflow";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  ArrowDown,
  ArrowRight,
} from "lucide-react";

export type LayoutDirection = "TB" | "LR";

interface StateGraphControlsProps {
  direction: LayoutDirection;
  onDirectionChange: (direction: LayoutDirection) => void;
}

export default function StateGraphControls({
  direction,
  onDirectionChange,
}: StateGraphControlsProps) {
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

  return (
    <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-white border border-gray-200 rounded-xl shadow-sm p-1.5 z-10">
      {/* Zoom controls */}
      <button
        onClick={() => zoomIn({ duration: 200 })}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-900"
        title="Zoom in"
      >
        <ZoomIn className="w-4 h-4" />
      </button>
      <button
        onClick={() => zoomOut({ duration: 200 })}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-900"
        title="Zoom out"
      >
        <ZoomOut className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Fit and reset */}
      <button
        onClick={handleFitView}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-900"
        title="Fit to screen"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
      <button
        onClick={handleReset}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-900"
        title="Reset view"
      >
        <RotateCcw className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Direction toggle */}
      <button
        onClick={toggleDirection}
        className="flex items-center gap-1.5 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-900"
        title={`Switch to ${direction === "TB" ? "horizontal" : "vertical"} layout`}
      >
        {direction === "TB" ? (
          <>
            <ArrowDown className="w-4 h-4" />
            <span className="text-[12px] font-medium">Vertical</span>
          </>
        ) : (
          <>
            <ArrowRight className="w-4 h-4" />
            <span className="text-[12px] font-medium">Horizontal</span>
          </>
        )}
      </button>
    </div>
  );
}
