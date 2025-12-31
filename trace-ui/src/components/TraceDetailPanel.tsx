"use client";

import { Trace, LLMCall, ToolExecution, TreeNode } from "@/types/trace";
import { X, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
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
  const toolsByLLMCall = new Map<string, ToolExecution[]>();
  const orphanTools: ToolExecution[] = [];

  toolExecutions.forEach((tool) => {
    if (tool.llm_call_id) {
      const existing = toolsByLLMCall.get(tool.llm_call_id) || [];
      existing.push(tool);
      toolsByLLMCall.set(tool.llm_call_id, existing);
    } else {
      orphanTools.push(tool);
    }
  });

  const children: TreeNode[] = [];

  llmCalls.forEach((llm) => {
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
  const [activeTab, setActiveTab] = useState<"metrics" | "parameters" | "insights">("metrics");

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
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Top Header - Galileo style */}
      <header className="flex items-center justify-between px-4 h-12 border-b border-[#e5e7eb] bg-white">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-[13px] text-[#6b7280] hover:text-[#1f2937]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-[13px] text-[#6b7280]">/</span>
          <svg className="w-4 h-4 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
          <span className="text-[13px] font-medium text-[#1f2937]">Messages</span>
          <span className="text-[13px] text-[#6b7280]">
            Session {traceIndex + 1} of {totalTraces}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onNavigate("prev")}
              disabled={traceIndex === 0}
              className="p-1 hover:bg-[#f3f4f6] rounded disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4 text-[#6b7280]" />
            </button>
            <button
              onClick={() => onNavigate("next")}
              disabled={traceIndex === totalTraces - 1}
              className="p-1 hover:bg-[#f3f4f6] rounded disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4 text-[#6b7280]" />
            </button>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-[#f3f4f6] rounded transition-colors"
        >
          <X className="w-4 h-4 text-[#6b7280]" />
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
            <div className="w-[280px] border-r border-[#e5e7eb] flex flex-col bg-white">
              {/* Condense steps toggle */}
              <div className="px-4 py-3 border-b border-[#e5e7eb]">
                <div className="flex items-center gap-2">
                  <div className="toggle-switch" />
                  <span className="text-[13px] text-[#6b7280]">Condense steps</span>
                </div>
              </div>

              {/* Filters */}
              <div className="px-4 py-3 border-b border-[#e5e7eb] flex items-center gap-2">
                <select className="galileo-select text-[12px] py-1.5 px-2">
                  <option>Type...</option>
                </select>
                <select className="galileo-select text-[12px] py-1.5 px-2">
                  <option>Lat...</option>
                </select>
                <button className="p-1.5 hover:bg-[#f3f4f6] rounded">
                  <svg className="w-4 h-4 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                </button>
              </div>

              {/* Tree */}
              <div className="flex-1 overflow-y-auto">
                <TraceTree
                  tree={tree}
                  selectedNodeId={selectedNode?.id || null}
                  onSelectNode={setSelectedNode}
                />
              </div>
            </div>

            {/* Middle Content - Step Detail */}
            <div className="flex-1 overflow-hidden border-r border-[#e5e7eb]">
              {selectedNode ? (
                <StepDetail node={selectedNode} />
              ) : (
                <div className="flex items-center justify-center h-full text-[13px] text-[#6b7280]">
                  Select a step to view details
                </div>
              )}
            </div>

            {/* Right Sidebar - Metrics */}
            <div className="w-[280px] bg-white flex flex-col">
              {/* Tabs */}
              <div className="flex border-b border-[#e5e7eb]">
                <button
                  onClick={() => setActiveTab("metrics")}
                  className={`flex-1 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                    activeTab === "metrics"
                      ? "text-[#1f2937] border-[#6366f1]"
                      : "text-[#6b7280] border-transparent hover:text-[#1f2937]"
                  }`}
                >
                  Metrics
                </button>
                <button
                  onClick={() => setActiveTab("parameters")}
                  className={`flex-1 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                    activeTab === "parameters"
                      ? "text-[#1f2937] border-[#6366f1]"
                      : "text-[#6b7280] border-transparent hover:text-[#1f2937]"
                  }`}
                >
                  Parameters
                </button>
                <button
                  onClick={() => setActiveTab("insights")}
                  className={`flex-1 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                    activeTab === "insights"
                      ? "text-[#1f2937] border-[#6366f1]"
                      : "text-[#6b7280] border-transparent hover:text-[#1f2937]"
                  }`}
                >
                  Insights
                </button>
              </div>

              {/* Metrics Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {activeTab === "metrics" && selectedNode && (
                  <div className="space-y-4">
                    <h3 className="text-[13px] font-medium text-[#1f2937]">System Metrics</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-2 border-b border-[#f3f4f6]">
                        <span className="text-[13px] text-[#6b7280]">Cost</span>
                        <span className="text-[13px] text-[#1f2937] font-medium">
                          ${((selectedNode.tokens || 0) * 0.000002).toFixed(4)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-[#f3f4f6]">
                        <span className="text-[13px] text-[#6b7280]">Latency</span>
                        <span className="text-[13px] text-[#1f2937] font-medium">
                          {selectedNode.duration_ms
                            ? selectedNode.duration_ms < 1000
                              ? `${selectedNode.duration_ms} ms`
                              : `${(selectedNode.duration_ms / 1000).toFixed(2)} sec`
                            : "—"}
                        </span>
                      </div>
                      {selectedNode.type === "llm" && (
                        <>
                          <div className="flex items-center justify-between py-2 border-b border-[#f3f4f6]">
                            <span className="text-[13px] text-[#6b7280]">Num Input Tokens</span>
                            <span className="text-[13px] text-[#1f2937] font-medium">
                              {(selectedNode.data as LLMCall).prompt_tokens || 0}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b border-[#f3f4f6]">
                            <span className="text-[13px] text-[#6b7280]">Num Output Tokens</span>
                            <span className="text-[13px] text-[#1f2937] font-medium">
                              {(selectedNode.data as LLMCall).completion_tokens || 0}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex items-center justify-between py-2 border-b border-[#f3f4f6]">
                        <span className="text-[13px] text-[#6b7280]">Num Total Tokens</span>
                        <span className="text-[13px] text-[#1f2937] font-medium">
                          {selectedNode.tokens || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === "parameters" && (
                  <div className="text-[13px] text-[#6b7280]">
                    No parameters available
                  </div>
                )}
                {activeTab === "insights" && (
                  <div className="text-[13px] text-[#6b7280]">
                    No insights available
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[13px] text-[#6b7280]">
            No data available
          </div>
        )}
      </div>
    </div>
  );
}
