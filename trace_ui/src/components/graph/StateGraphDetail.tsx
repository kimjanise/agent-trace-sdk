"use client";

import { useEffect, useRef } from "react";
import { X, Clock, Zap, Workflow, Sparkles, Wrench, AlertCircle, Mic, Volume2, DollarSign } from "lucide-react";
import { TreeNode, Trace, LLMCall, ToolExecution, STTCall, TTSCall, StepType } from "@/types/trace";
import {
  calculateLLMCost,
  calculateSTTCost,
  calculateTTSCost,
  formatCost,
} from "@/lib/pricing";

interface StateGraphDetailProps {
  node: TreeNode | null;
  onClose: () => void;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function JsonBlock({ data, maxHeight = "200px" }: { data: unknown; maxHeight?: string }) {
  const jsonString = JSON.stringify(data, null, 2);

  return (
    <pre
      className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-[12px] font-mono text-gray-700 overflow-auto"
      style={{ maxHeight }}
    >
      {jsonString}
    </pre>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
        {title}
      </h4>
      {children}
    </div>
  );
}

function MetricBadge({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
      <Icon className="w-4 h-4 text-gray-400" />
      <div>
        <div className="text-[10px] text-gray-400 uppercase">{label}</div>
        <div className="text-[13px] font-medium text-gray-900">{value}</div>
      </div>
    </div>
  );
}

function AgentContent({ data }: { data: Trace }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <MetricBadge icon={Clock} label="Duration" value={formatDuration(data.duration_ms)} />
        <MetricBadge icon={Zap} label="Tokens" value={data.total_tokens?.toLocaleString() || "0"} />
      </div>

      <Section title="Input">
        <JsonBlock data={{ content: data.input }} />
      </Section>

      <Section title="Output">
        <JsonBlock data={{ content: data.output }} maxHeight="300px" />
      </Section>

      {data.error && (
        <Section title="Error">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-[13px] text-red-700">
            {data.error}
          </div>
        </Section>
      )}
    </>
  );
}

function LLMContent({ data }: { data: LLMCall }) {
  const cost = calculateLLMCost(
    data.provider,
    data.model,
    data.prompt_tokens || 0,
    data.completion_tokens || 0
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <MetricBadge icon={Clock} label="Duration" value={formatDuration(data.duration_ms)} />
        <MetricBadge icon={Zap} label="Tokens" value={data.total_tokens?.toLocaleString() || "0"} />
        <MetricBadge icon={DollarSign} label="Cost" value={formatCost(cost)} />
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
          <div>
            <div className="text-[10px] text-gray-400 uppercase">Model</div>
            <div className="text-[12px] font-medium text-gray-900">{data.model}</div>
          </div>
        </div>
      </div>

      <Section title={`Messages (${data.request_messages?.length || 0})`}>
        <JsonBlock data={data.request_messages || []} maxHeight="250px" />
      </Section>

      <Section title="Response">
        {data.response_content ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-[13px] text-gray-700 whitespace-pre-wrap max-h-[300px] overflow-auto">
            {data.response_content}
          </div>
        ) : data.response_tool_calls && data.response_tool_calls.length > 0 ? (
          <JsonBlock data={data.response_tool_calls} maxHeight="250px" />
        ) : (
          <div className="text-[13px] text-gray-400 italic">No response content</div>
        )}
      </Section>

      {data.request_tools && data.request_tools.length > 0 && (
        <Section title={`Tools Available (${data.request_tools.length})`}>
          <JsonBlock data={data.request_tools} maxHeight="200px" />
        </Section>
      )}
    </>
  );
}

function ToolContent({ data }: { data: ToolExecution }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <MetricBadge icon={Clock} label="Duration" value={formatDuration(data.duration_ms)} />
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
          <div
            className={`w-2 h-2 rounded-full ${
              data.status === "success" ? "bg-emerald-500" : data.status === "error" ? "bg-red-500" : "bg-gray-400"
            }`}
          />
          <div>
            <div className="text-[10px] text-gray-400 uppercase">Status</div>
            <div className="text-[13px] font-medium text-gray-900 capitalize">{data.status}</div>
          </div>
        </div>
      </div>

      <Section title="Arguments">
        <JsonBlock data={data.arguments || {}} />
      </Section>

      <Section title="Result">
        {data.error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-[13px] text-red-700">
            {data.error}
          </div>
        ) : (
          <JsonBlock data={{ result: data.result }} maxHeight="300px" />
        )}
      </Section>
    </>
  );
}

function STTContent({ data }: { data: STTCall }) {
  const cost = calculateSTTCost(data.provider, data.model, data.audio_duration_ms);

  return (
    <>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <MetricBadge icon={Clock} label="Duration" value={formatDuration(data.duration_ms)} />
        <MetricBadge icon={DollarSign} label="Cost" value={formatCost(cost)} />
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
          <div>
            <div className="text-[10px] text-gray-400 uppercase">Model</div>
            <div className="text-[12px] font-medium text-gray-900">{data.model}</div>
          </div>
        </div>
        {data.audio_duration_ms && (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
            <div>
              <div className="text-[10px] text-gray-400 uppercase">Audio</div>
              <div className="text-[12px] font-mono font-medium text-gray-900">
                {(data.audio_duration_ms / 1000).toFixed(1)}s
              </div>
            </div>
          </div>
        )}
      </div>

      <Section title="Transcript">
        {data.error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-[13px] text-red-700">
            {data.error}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-[13px] text-gray-700 whitespace-pre-wrap">
            {data.transcript || "(no transcript)"}
          </div>
        )}
      </Section>
    </>
  );
}

function TTSContent({ data }: { data: TTSCall }) {
  const cost = calculateTTSCost(data.provider, data.model, data.input_chars);

  return (
    <>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <MetricBadge icon={Clock} label="Duration" value={formatDuration(data.duration_ms)} />
        <MetricBadge icon={DollarSign} label="Cost" value={formatCost(cost)} />
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
          <div>
            <div className="text-[10px] text-gray-400 uppercase">Voice</div>
            <div className="text-[12px] font-medium text-gray-900">{data.voice || data.model || "—"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
          <div>
            <div className="text-[10px] text-gray-400 uppercase">Characters</div>
            <div className="text-[12px] font-mono font-medium text-gray-900">{data.input_chars || 0}</div>
          </div>
        </div>
      </div>

      <Section title="Input Text">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-[13px] text-gray-700 whitespace-pre-wrap max-h-[300px] overflow-auto">
          {data.input_text || "(no text)"}
        </div>
      </Section>

      {data.error && (
        <Section title="Error">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-[13px] text-red-700">
            {data.error}
          </div>
        </Section>
      )}
    </>
  );
}

export default function StateGraphDetail({ node, onClose }: StateGraphDetailProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Delay adding listener to avoid immediate close
    const timer = setTimeout(() => {
      window.addEventListener("mousedown", handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  if (!node) return null;

  const isError = node.status === "error";

  // Get icon and colors based on type
  const typeConfig: Record<StepType, { Icon: typeof Workflow; bg: string; color: string }> = {
    agent: { Icon: Workflow, bg: "bg-indigo-100", color: "text-indigo-600" },
    llm: { Icon: Sparkles, bg: "bg-amber-100", color: "text-amber-600" },
    tool: { Icon: Wrench, bg: "bg-emerald-100", color: "text-emerald-600" },
    stt: { Icon: Mic, bg: "bg-pink-100", color: "text-pink-600" },
    tts: { Icon: Volume2, bg: "bg-indigo-100", color: "text-indigo-600" },
  };

  const config = isError
    ? { Icon: AlertCircle, bg: "bg-red-100", color: "text-red-600" }
    : typeConfig[node.type];

  return (
    <div
      ref={panelRef}
      className="absolute top-0 right-0 h-full w-[380px] bg-white border-l border-gray-200 shadow-xl z-30 flex flex-col animate-slide-in-right"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${config.bg}`}>
            <config.Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900">{node.name}</h3>
            <p className="text-[12px] text-gray-500 capitalize">{node.type}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {node.type === "agent" && <AgentContent data={node.data as Trace} />}
        {node.type === "llm" && <LLMContent data={node.data as LLMCall} />}
        {node.type === "tool" && <ToolContent data={node.data as ToolExecution} />}
        {node.type === "stt" && <STTContent data={node.data as STTCall} />}
        {node.type === "tts" && <TTSContent data={node.data as TTSCall} />}
      </div>
    </div>
  );
}
