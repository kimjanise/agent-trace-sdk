"use client";

import { useState, useRef, useEffect } from "react";
import { AlertCircle, ChevronDown, X } from "lucide-react";
import { ErrorInfo } from "./utils/errorTrail";

interface ErrorIndicatorProps {
  errors: ErrorInfo[];
  onErrorSelect: (errorNodeId: string) => void;
}

export default function ErrorIndicator({
  errors,
  onErrorSelect,
}: ErrorIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Error badge button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors
          ${
            isOpen
              ? "bg-[#fee2e2] text-[#dc2626]"
              : "bg-[#fef2f2] text-[#dc2626] hover:bg-[#fee2e2]"
          }
        `}
      >
        <AlertCircle className="w-4 h-4" />
        <span className="text-[13px] font-medium">
          {errors.length} {errors.length === 1 ? "Error" : "Errors"}
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-[#e5e7eb] rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e5e7eb] bg-[#fef2f2]">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[#dc2626]">
                Errors in this trace
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-[#fee2e2] rounded transition-colors"
              >
                <X className="w-4 h-4 text-[#dc2626]" />
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {errors.map((error, index) => (
              <button
                key={error.nodeId}
                onClick={() => {
                  onErrorSelect(error.nodeId);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-[#f9fafb] border-b border-[#f3f4f6] last:border-b-0 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#fee2e2] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[11px] font-bold text-[#dc2626]">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-[#1f2937]">
                        {error.nodeName}
                      </span>
                      <span className="text-[11px] text-[#6b7280] bg-[#f3f4f6] px-1.5 py-0.5 rounded">
                        {error.nodeType}
                      </span>
                    </div>
                    {error.error && (
                      <p className="text-[12px] text-[#dc2626] mt-1 line-clamp-2">
                        {error.error}
                      </p>
                    )}
                    <p className="text-[11px] text-[#9ca3af] mt-1">
                      {error.trailIds.length} steps in path
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="px-4 py-2 border-t border-[#e5e7eb] bg-[#f9fafb]">
            <p className="text-[11px] text-[#6b7280]">
              Click an error to focus on it in the graph
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Floating error badge for the corner of the graph
 */
export function FloatingErrorBadge({
  errorCount,
  onClick,
}: {
  errorCount: number;
  onClick: () => void;
}) {
  if (errorCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 bg-[#dc2626] text-white rounded-lg shadow-lg hover:bg-[#b91c1c] transition-colors z-10"
    >
      <AlertCircle className="w-4 h-4" />
      <span className="text-[13px] font-medium">
        {errorCount} {errorCount === 1 ? "Error" : "Errors"}
      </span>
    </button>
  );
}
