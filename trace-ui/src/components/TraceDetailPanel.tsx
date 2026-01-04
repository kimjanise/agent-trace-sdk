"use client";

import { Trace, ToolExecution, TreeNode, LLMCall } from "@/types/trace";
import { X, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { getLLMCalls, getToolExecutions } from "@/lib/supabase";
import TraceTree from "./TraceTree";
import StepDetail from "./StepDetail";

interface TraceDetailPanelProps {
  trace: Trace;
  onClose: () => void;
  traceIndex: number;
  totalTraces: number;
  onNavigate: (direction: "prev" | "next") => void;
}

function buildTree(
  trace: Trace,
  llmCalls: LLMCall[],
  toolExecutions: ToolExecution[]
): TreeNode {
  // Sort LLM calls chronologically
  const sortedLLMCalls = [...llmCalls].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  );

  // Sort tool executions chronologically
  const sortedTools = [...toolExecutions].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  );

  // Group tools by their parent LLM call
  const toolsByLLMCall = new Map<string, ToolExecution[]>();
  const orphanTools: ToolExecution[] = [];

  sortedTools.forEach((tool) => {
    if (tool.llm_call_id) {
      const existing = toolsByLLMCall.get(tool.llm_call_id) || [];
      existing.push(tool);
      toolsByLLMCall.set(tool.llm_call_id, existing);
    } else {
      orphanTools.push(tool);
    }
  });

  const children: TreeNode[] = [];

  sortedLLMCalls.forEach((llm) => {
    const llmNode: TreeNode = {
      id: llm.call_id,
      type: "llm",
      name: llm.model,
      duration_ms: llm.duration_ms,
      tokens: llm.total_tokens,
      data: llm,
      children: [],
    };

    // Tools are already sorted chronologically
    const tools = toolsByLLMCall.get(llm.call_id) || [];
    tools.forEach((tool) => {
      llmNode.children.push({
        id: tool.execution_id,
        type: "tool",
        name: tool.tool_name,
        duration_ms: tool.duration_ms,
        status: tool.status,
        data: tool,
        children: [],
      });
    });

    children.push(llmNode);
  });

  // Add orphan tools (tools without a parent LLM call)
  orphanTools.forEach((tool) => {
    children.push({
      id: tool.execution_id,
      type: "tool",
      name: tool.tool_name,
      duration_ms: tool.duration_ms,
      status: tool.status,
      data: tool,
      children: [],
    });
  });

  return {
    id: trace.trace_id,
    type: "agent",
    name: trace.agent_name,
    duration_ms: trace.duration_ms,
    tokens: trace.total_tokens,
    data: trace,
    children,
  };
}

export default function TraceDetailPanel({
  trace,
  onClose,
  traceIndex,
  totalTraces,
  onNavigate,
}: TraceDetailPanelProps) {
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [panelWidth, setPanelWidth] = useState(typeof window !== "undefined" ? window.innerWidth * (2/3) : 900);
  const [isResizing, setIsResizing] = useState(false);

  const minWidth = 600;
  const maxWidth = typeof window !== "undefined" ? window.innerWidth * 0.75 : 1200;

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    setPanelWidth(Math.min(Math.max(newWidth, minWidth), maxWidth));
  }, [isResizing, maxWidth]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    async function loadTraceDetails() {
      setLoading(true);
      try {
        const [llmCalls, toolExecutions] = await Promise.all([
          getLLMCalls(trace.trace_id),
          getToolExecutions(trace.trace_id),
        ]);

        const treeData = buildTree(trace, llmCalls, toolExecutions);
        setTree(treeData);
        setSelectedNode(treeData);
      } catch (error) {
        console.error("Error loading trace details:", error);
      } finally {
        setLoading(false);
      }
    }

    loadTraceDetails();
  }, [trace]);

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40 fade-overlay"
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        className="fixed inset-y-0 right-0 bg-white z-50 flex flex-col shadow-2xl slide-panel"
        style={{ width: `${panelWidth}px` }}
      >
        {/* Resize handle */}
        <div
          onMouseDown={() => setIsResizing(true)}
          className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize transition-colors z-10 ${
            isResizing ? "bg-[#6366f1]" : "hover:bg-[#6366f1]/50"
          }`}
        />
        {/* Top Header - Galileo style */}
        <header className="flex items-center justify-between px-5 h-14 border-b border-[#e5e7eb] bg-white">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-[14px] text-[#6b7280] hover:text-[#1f2937]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-[14px] text-[#6b7280]">/</span>
          <svg className="w-5 h-5 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
          <span className="text-[14px] font-medium text-[#1f2937]">TRACE</span>
          <span className="text-[14px] text-[#6b7280]">
            Session {traceIndex + 1} of {totalTraces}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onNavigate("prev")}
              disabled={traceIndex === 0}
              className="p-1.5 hover:bg-[#f3f4f6] rounded disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5 text-[#6b7280]" />
            </button>
            <button
              onClick={() => onNavigate("next")}
              disabled={traceIndex === totalTraces - 1}
              className="p-1.5 hover:bg-[#f3f4f6] rounded disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5 text-[#6b7280]" />
            </button>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-[#f3f4f6] rounded transition-colors"
        >
          <X className="w-5 h-5 text-[#6b7280]" />
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#e5e7eb] border-t-[#6366f1]"></div>
          </div>
        ) : tree ? (
          <>
            {/* Left Sidebar - Tree View */}
            <div className="w-[320px] border-r border-[#e5e7eb] flex flex-col bg-white">
              <div className="flex-1 overflow-y-auto">
                <TraceTree
                  tree={tree}
                  selectedNodeId={selectedNode?.id || null}
                  onSelectNode={setSelectedNode}
                />
              </div>
            </div>

            {/* Main Content - Step Detail */}
            <div className="flex-1 overflow-hidden">
              {selectedNode ? (
                <StepDetail node={selectedNode} />
              ) : (
                <div className="flex items-center justify-center h-full text-[13px] text-[#6b7280]">
                  Select a step to view details
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[14px] text-[#6b7280]">
            No data available
          </div>
        )}
      </div>
      </div>
    </>
  );
}
