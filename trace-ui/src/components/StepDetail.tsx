"use client";

import { TreeNode, Trace, LLMCall, ToolExecution, STTCall, TTSCall } from "@/types/trace";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface StepDetailProps {
  node: TreeNode;
}

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ title, icon, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-[#e5e7eb]">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 w-full px-5 py-4 text-left hover:bg-[#f9fafb] transition-colors"
      >
        {open ? (
          <ChevronDown className="w-5 h-5 text-[#9ca3af]" />
        ) : (
          <ChevronRight className="w-5 h-5 text-[#9ca3af]" />
        )}
        {icon}
        <span className="text-[15px] font-medium text-[#1f2937]">{title}</span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

type ViewMode = "json" | "text";

function DataViewer({ data, defaultMode = "json" }: { data: unknown; defaultMode?: ViewMode }) {
  const [mode, setMode] = useState<ViewMode>(defaultMode);

  const jsonString = JSON.stringify(data, null, 2);

  // Extract text content for text mode
  const textContent = (() => {
    if (typeof data === "string") return data;
    if (data === null || data === undefined) return "";
    if (typeof data === "object") {
      // Handle common patterns like { content: "..." }
      const obj = data as Record<string, unknown>;
      if ("content" in obj && typeof obj.content === "string") {
        return obj.content;
      }
      if ("result" in obj && typeof obj.result === "string") {
        return obj.result;
      }
      // For arrays of messages, extract content
      if (Array.isArray(data)) {
        return data
          .map((item) => {
            if (typeof item === "object" && item && "content" in item) {
              const role = "role" in item ? `[${item.role}] ` : "";
              return `${role}${item.content}`;
            }
            return JSON.stringify(item);
          })
          .join("\n\n");
      }
      return JSON.stringify(data, null, 2);
    }
    return String(data);
  })();

  // Simple syntax highlighting for JSON
  const highlighted = jsonString
    .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
    .replace(/: "([^"]*)"([,\n])/g, ': <span class="json-string">"$1"</span>$2')
    .replace(/: (\d+)([,\n])/g, ': <span class="json-number">$1</span>$2')
    .replace(/: (true|false)([,\n])/g, ': <span class="json-boolean">$1</span>$2')
    .replace(/: (null)([,\n])/g, ': <span class="json-null">$1</span>$2');

  return (
    <div>
      <select
        className="galileo-select text-[12px] mb-3"
        value={mode}
        onChange={(e) => setMode(e.target.value as ViewMode)}
      >
        <option value="json">JSON</option>
        <option value="text">Text</option>
      </select>
      {mode === "json" ? (
        <pre
          className="code-block text-[13px] text-[#1f2937]"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      ) : (
        <div className="code-block text-[14px] text-[#1f2937] whitespace-pre-wrap">
          {textContent || <span className="text-[#9ca3af]">(empty)</span>}
        </div>
      )}
    </div>
  );
}

function getIcon(type: string) {
  switch (type) {
    case "agent":
      return (
        <div className="w-7 h-7 rounded bg-[#eef2ff] flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[#6366f1]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>
      );
    case "llm":
      return (
        <div className="w-7 h-7 rounded bg-[#fef3c7] flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[#d97706]" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
          </svg>
        </div>
      );
    case "tool":
      return (
        <div className="w-7 h-7 rounded bg-[#d1fae5] flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[#059669]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
          </svg>
        </div>
      );
    case "stt":
      return (
        <div className="w-7 h-7 rounded bg-[#fce7f3] flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[#db2777]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
          </svg>
        </div>
      );
    case "tts":
      return (
        <div className="w-7 h-7 rounded bg-[#e0e7ff] flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[#4f46e5]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        </div>
      );
    default:
      return null;
  }
}

function MetricsRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[13px] text-[#6b7280]">{label}</span>
      <span className="text-[13px] text-[#1f2937] font-medium">{value}</span>
    </div>
  );
}

function AgentDetail({ data }: { data: Trace }) {
  const cost = ((data.total_tokens || 0) * 0.000002).toFixed(4);

  return (
    <>
      <CollapsibleSection title="Metrics">
        <div className="divide-y divide-[#f3f4f6]">
          <MetricsRow label="Cost" value={`$${cost}`} />
          <MetricsRow label="Latency" value={data.duration_ms !== null ? `${data.duration_ms} ms` : "—"} />
          <MetricsRow label="Total Tokens" value={data.total_tokens || 0} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Input">
        <DataViewer data={{ content: data.input }} />
      </CollapsibleSection>

      <CollapsibleSection title="Output">
        <DataViewer data={{ content: data.output }} />
      </CollapsibleSection>

      {data.error && (
        <CollapsibleSection title="Error">
          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-md p-3 text-[13px] text-[#dc2626]">
            {data.error}
          </div>
        </CollapsibleSection>
      )}
    </>
  );
}

function LLMDetail({ data }: { data: LLMCall }) {
  const cost = ((data.total_tokens || 0) * 0.000002).toFixed(4);

  return (
    <>
      <CollapsibleSection title="Metrics">
        <div className="divide-y divide-[#f3f4f6]">
          <MetricsRow label="Cost" value={`$${cost}`} />
          <MetricsRow label="Latency" value={data.duration_ms !== null ? `${data.duration_ms} ms` : "—"} />
          <MetricsRow label="Input Tokens" value={data.prompt_tokens || 0} />
          <MetricsRow label="Output Tokens" value={data.completion_tokens || 0} />
          <MetricsRow label="Total Tokens" value={data.total_tokens || 0} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Input">
        <DataViewer data={data.request_messages || []} />
      </CollapsibleSection>

      <CollapsibleSection title="Output">
        {data.response_content ? (
          <DataViewer data={{ content: data.response_content }} defaultMode="text" />
        ) : data.response_tool_calls && data.response_tool_calls.length > 0 ? (
          <DataViewer data={data.response_tool_calls} />
        ) : (
          <div className="text-[14px] text-[#6b7280]">No output</div>
        )}
      </CollapsibleSection>
    </>
  );
}

function ToolDetail({ data }: { data: ToolExecution }) {
  return (
    <>
      <CollapsibleSection title="Metrics">
        <div className="divide-y divide-[#f3f4f6]">
          <MetricsRow label="Latency" value={data.duration_ms !== null ? `${data.duration_ms} ms` : "—"} />
          <MetricsRow label="Status" value={data.status} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Input">
        <DataViewer data={data.arguments || {}} />
      </CollapsibleSection>

      <CollapsibleSection title="Output">
        {data.error ? (
          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-md p-3 text-[13px] text-[#dc2626]">
            {data.error}
          </div>
        ) : (
          <DataViewer data={{ result: data.result }} />
        )}
      </CollapsibleSection>
    </>
  );
}

function STTDetail({ data }: { data: STTCall }) {
  return (
    <>
      <CollapsibleSection title="Metrics">
        <div className="divide-y divide-[#f3f4f6]">
          <MetricsRow label="Provider" value={data.provider} />
          <MetricsRow label="Model" value={data.model} />
          <MetricsRow label="Latency" value={data.duration_ms !== null ? `${data.duration_ms} ms` : "—"} />
          <MetricsRow label="Status" value={data.status} />
          {data.audio_duration_ms && (
            <MetricsRow label="Audio Duration" value={`${data.audio_duration_ms} ms`} />
          )}
          {data.audio_format && <MetricsRow label="Audio Format" value={data.audio_format} />}
          {data.language && <MetricsRow label="Language" value={data.language} />}
          {data.confidence !== null && (
            <MetricsRow label="Confidence" value={`${(data.confidence * 100).toFixed(1)}%`} />
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Transcript">
        {data.error ? (
          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-md p-3 text-[13px] text-[#dc2626]">
            {data.error}
          </div>
        ) : (
          <DataViewer data={{ transcript: data.transcript }} defaultMode="text" />
        )}
      </CollapsibleSection>
    </>
  );
}

function TTSDetail({ data }: { data: TTSCall }) {
  return (
    <>
      <CollapsibleSection title="Metrics">
        <div className="divide-y divide-[#f3f4f6]">
          <MetricsRow label="Provider" value={data.provider} />
          <MetricsRow label="Model" value={data.model} />
          {data.voice && <MetricsRow label="Voice" value={data.voice} />}
          <MetricsRow label="Latency" value={data.duration_ms !== null ? `${data.duration_ms} ms` : "—"} />
          <MetricsRow label="Status" value={data.status} />
          <MetricsRow label="Input Characters" value={data.input_chars} />
          {data.output_format && <MetricsRow label="Output Format" value={data.output_format} />}
          {data.output_audio_duration_ms && (
            <MetricsRow label="Output Duration" value={`${data.output_audio_duration_ms} ms`} />
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Input Text">
        <DataViewer data={{ text: data.input_text }} defaultMode="text" />
      </CollapsibleSection>

      {data.voice_settings && Object.keys(data.voice_settings).length > 0 && (
        <CollapsibleSection title="Voice Settings" defaultOpen={false}>
          <DataViewer data={data.voice_settings} />
        </CollapsibleSection>
      )}

      {data.error && (
        <CollapsibleSection title="Error">
          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-md p-3 text-[13px] text-[#dc2626]">
            {data.error}
          </div>
        </CollapsibleSection>
      )}
    </>
  );
}

export default function StepDetail({ node }: StepDetailProps) {
  const getTitle = () => {
    switch (node.type) {
      case "agent":
        return "Session";
      case "llm":
        return "llm";
      case "stt":
        return "Speech-to-Text";
      case "tts":
        return "Text-to-Speech";
      default:
        return node.name;
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-[#e5e7eb] px-5 py-4 z-10">
        <div className="flex items-center gap-3">
          {getIcon(node.type)}
          <span className="text-[16px] font-semibold text-[#1f2937]">
            {getTitle()}
          </span>
          {(node.type === "llm" || node.type === "stt" || node.type === "tts") && (
            <span className="text-[14px] text-[#6b7280]">{node.name}</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div>
        {node.type === "agent" && <AgentDetail data={node.data as Trace} />}
        {node.type === "llm" && <LLMDetail data={node.data as LLMCall} />}
        {node.type === "tool" && <ToolDetail data={node.data as ToolExecution} />}
        {node.type === "stt" && <STTDetail data={node.data as STTCall} />}
        {node.type === "tts" && <TTSDetail data={node.data as TTSCall} />}
      </div>
    </div>
  );
}
