"use client";

import { Trace, ToolExecution, TreeNode, LLMCall } from "@/types/trace";
import {
  X,
  ChevronUp,
  ChevronDown,
  Copy,
  Download,
  Search,
  Check,
} from "lucide-react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { getLLMCalls, getToolExecutions } from "@/lib/supabase";
import TraceTree from "./TraceTree";
import StepDetail from "./StepDetail";
import StateGraph from "./graph/StateGraph";
import ErrorIndicator from "./graph/ErrorIndicator";
import { computeErrorTrails } from "./graph/utils/errorTrail";

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
  const sortedLLMCalls = [...llmCalls].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  );

  const sortedTools = [...toolExecutions].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  );

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

// Helper to find a node by ID in the tree
function findNodeById(tree: TreeNode, id: string): TreeNode | null {
  if (tree.id === id) return tree;
  for (const child of tree.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
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
  const [panelWidth, setPanelWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth * (2 / 3) : 900
  );
  const [isResizing, setIsResizing] = useState(false);
  const [activeTab, setActiveTab] = useState<"trace" | "graph">("trace");
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [llmCalls, setLlmCalls] = useState<LLMCall[]>([]);
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);

  const minWidth = 600;
  const maxWidth =
    typeof window !== "undefined" ? window.innerWidth * 0.75 : 1200;

  // Compute errors for the error indicator in header
  const errors = useMemo(() => {
    if (!tree) return [];
    return computeErrorTrails(tree).errors;
  }, [tree]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      setPanelWidth(Math.min(Math.max(newWidth, minWidth), maxWidth));
    },
    [isResizing, maxWidth]
  );

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
        const [llmCallsData, toolExecutionsData] = await Promise.all([
          getLLMCalls(trace.trace_id),
          getToolExecutions(trace.trace_id),
        ]);

        setLlmCalls(llmCallsData);
        setToolExecutions(toolExecutionsData);

        const treeData = buildTree(trace, llmCallsData, toolExecutionsData);
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

  const handleCopyTraceId = async () => {
    await navigator.clipboard.writeText(trace.trace_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTrace = () => {
    const traceData = {
      trace,
      llm_calls: llmCalls,
      tool_executions: toolExecutions,
    };
    const blob = new Blob([JSON.stringify(traceData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trace-${trace.trace_id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter tree nodes based on search query
  const filterTree = (node: TreeNode, query: string): TreeNode | null => {
    if (!query) return node;

    const matchesQuery =
      node.name.toLowerCase().includes(query.toLowerCase()) ||
      node.type.toLowerCase().includes(query.toLowerCase());

    const filteredChildren = node.children
      .map((child) => filterTree(child, query))
      .filter((child): child is TreeNode => child !== null);

    if (matchesQuery || filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }

    return null;
  };

  const filteredTree = tree ? filterTree(tree, searchQuery) : null;

  const shortTraceId = trace.trace_id.slice(0, 8);

  // Handle error selection from header - switch to graph and focus on error
  const handleErrorSelectFromHeader = (errorNodeId: string) => {
    setActiveTab("graph");
    if (tree) {
      const errorNode = findNodeById(tree, errorNodeId);
      if (errorNode) {
        setSelectedNode(errorNode);
      }
    }
  };

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

        {/* Top Header */}
        <header className="flex items-center justify-between px-4 h-12 border-b border-[#e5e7eb] bg-white">
          <div className="flex items-center gap-2">
            {/* Navigation */}
            <div className="flex items-center border border-[#e5e7eb] rounded-md">
              <button
                onClick={() => onNavigate("prev")}
                disabled={traceIndex === 0}
                className="p-1.5 hover:bg-[#f3f4f6] disabled:opacity-30 disabled:cursor-not-allowed border-r border-[#e5e7eb]"
                title="Previous trace"
              >
                <ChevronUp className="w-4 h-4 text-[#6b7280]" />
              </button>
              <button
                onClick={() => onNavigate("next")}
                disabled={traceIndex === totalTraces - 1}
                className="p-1.5 hover:bg-[#f3f4f6] disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next trace"
              >
                <ChevronDown className="w-4 h-4 text-[#6b7280]" />
              </button>
            </div>

            {/* Trace ID */}
            <button
              onClick={handleCopyTraceId}
              className="flex items-center gap-2 px-2 py-1 hover:bg-[#f3f4f6] rounded-md transition-colors"
              title="Copy trace ID"
            >
              <code className="text-[13px] font-mono text-[#1f2937]">
                {shortTraceId}
              </code>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-[#059669]" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-[#9ca3af]" />
              )}
            </button>

            {/* Error indicator in header */}
            {errors.length > 0 && (
              <ErrorIndicator
                errors={errors}
                onErrorSelect={handleErrorSelectFromHeader}
              />
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Search toggle */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-md transition-colors ${
                showSearch
                  ? "bg-[#eef2ff] text-[#6366f1]"
                  : "hover:bg-[#f3f4f6] text-[#6b7280]"
              }`}
              title="Search trace"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Download */}
            <button
              onClick={handleDownloadTrace}
              className="p-2 hover:bg-[#f3f4f6] rounded-md transition-colors text-[#6b7280]"
              title="Download trace as JSON"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#f3f4f6] rounded-md transition-colors text-[#6b7280]"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 h-11 border-b border-[#e5e7eb] bg-white">
          <button
            onClick={() => setActiveTab("trace")}
            className={`flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
              activeTab === "trace"
                ? "bg-[#f3f4f6] text-[#1f2937]"
                : "text-[#6b7280] hover:text-[#1f2937] hover:bg-[#f9fafb]"
            }`}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 12h4l3-9 4 18 3-9h4" />
            </svg>
            Trace
          </button>
          <button
            onClick={() => setActiveTab("graph")}
            className={`flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
              activeTab === "graph"
                ? "bg-[#f3f4f6] text-[#1f2937]"
                : "text-[#6b7280] hover:text-[#1f2937] hover:bg-[#f9fafb]"
            }`}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="5" cy="12" r="2" />
              <circle cx="19" cy="6" r="2" />
              <circle cx="19" cy="18" r="2" />
              <path d="M7 12h8M17 7l-8 4M17 17l-8-4" />
            </svg>
            Graph
          </button>
        </div>

        {/* Search bar (conditional - only for trace view) */}
        {showSearch && activeTab === "trace" && (
          <div className="px-4 py-2 border-b border-[#e5e7eb] bg-[#f9fafb]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
              <input
                type="text"
                placeholder="Search nodes by name or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#e5e7eb] rounded-md focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-transparent"
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#e5e7eb] border-t-[#6366f1]"></div>
            </div>
          ) : activeTab === "trace" ? (
            filteredTree ? (
              <>
                {/* Left Sidebar - Tree View */}
                <div className="w-[320px] border-r border-[#e5e7eb] flex flex-col bg-white">
                  <div className="px-4 py-2 border-b border-[#e5e7eb]">
                    <span className="text-[12px] font-medium text-[#6b7280] uppercase tracking-wide">
                      Trace tree
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <TraceTree
                      tree={filteredTree}
                      selectedNodeId={selectedNode?.id || null}
                      onSelectNode={setSelectedNode}
                    />
                  </div>
                </div>

                {/* Main Content - Step Detail */}
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="px-4 py-2 border-b border-[#e5e7eb]">
                    <span className="text-[12px] font-medium text-[#6b7280] uppercase tracking-wide">
                      {selectedNode?.type === "agent"
                        ? "Root span"
                        : selectedNode?.type === "llm"
                        ? "LLM call"
                        : "Tool execution"}
                    </span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {selectedNode ? (
                      <StepDetail node={selectedNode} />
                    ) : (
                      <div className="flex items-center justify-center h-full text-[13px] text-[#6b7280]">
                        Select a step to view details
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[14px] text-[#6b7280]">
                No matching nodes found
              </div>
            )
          ) : tree ? (
            /* State Graph View - has its own built-in detail panel */
            <div className="flex-1">
              <StateGraph tree={tree} />
            </div>
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
