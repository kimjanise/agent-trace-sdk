"use client";

import { TreeNode, Trace, LLMCall, ToolExecution, STTCall, TTSCall } from "@/types/trace";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  calculateLLMCost,
  calculateSTTCost,
  calculateTTSCost,
  formatCost,
} from "@/lib/pricing";

/**
 * Capitalize provider and model names appropriately
 */
function formatProviderName(name: string | null): string {
  if (!name) return "Unknown";

  // Known provider capitalizations
  const providerMap: Record<string, string> = {
    "openai": "OpenAI",
    "anthropic": "Anthropic",
    "google": "Google",
    "deepgram": "Deepgram",
    "elevenlabs": "ElevenLabs",
    "assemblyai": "AssemblyAI",
    "amazon": "Amazon",
    "azure": "Azure",
    "cohere": "Cohere",
    "mistral": "Mistral",
  };

  // Known model capitalizations
  const modelMap: Record<string, string> = {
    "gpt-4o": "GPT-4o",
    "gpt-4o-mini": "GPT-4o Mini",
    "gpt-4-turbo": "GPT-4 Turbo",
    "gpt-4": "GPT-4",
    "gpt-3.5-turbo": "GPT-3.5 Turbo",
    "claude-3-opus": "Claude 3 Opus",
    "claude-3-sonnet": "Claude 3 Sonnet",
    "claude-3-haiku": "Claude 3 Haiku",
    "claude-3.5-sonnet": "Claude 3.5 Sonnet",
    "claude-3.5-haiku": "Claude 3.5 Haiku",
    "nova-2": "Nova-2",
    "nova": "Nova",
    "whisper-1": "Whisper",
    "eleven_multilingual_v2": "Multilingual v2",
    "eleven_monolingual_v1": "Monolingual v1",
    "tts-1": "TTS-1",
    "tts-1-hd": "TTS-1 HD",
  };

  const lower = name.toLowerCase();

  // Check exact matches first
  if (providerMap[lower]) return providerMap[lower];
  if (modelMap[lower]) return modelMap[lower];

  // Check if it contains a known name
  for (const [key, value] of Object.entries(providerMap)) {
    if (lower.includes(key)) {
      return name.replace(new RegExp(key, 'i'), value);
    }
  }
  for (const [key, value] of Object.entries(modelMap)) {
    if (lower === key) {
      return value;
    }
  }

  // Default: capitalize first letter of each word
  return name
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Capitalize status values properly (e.g., "success" -> "Success")
 */
function capitalizeStatus(status: string | null | undefined): string {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

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
        className="flex items-center gap-2 w-full px-4 py-2.5 text-left hover:bg-[#f9fafb] transition-colors"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-[#9ca3af]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[#9ca3af]" />
        )}
        {icon}
        <span className="text-[14px] font-medium text-[#1f2937]">{title}</span>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

type ViewMode = "json" | "text";

interface DataViewerProps {
  data: unknown;
  defaultMode?: ViewMode;
  label?: string;
}

function DataViewer({ data, defaultMode = "json", label }: DataViewerProps) {
  const [mode, setMode] = useState<ViewMode>(defaultMode);

  // Handle null/undefined
  if (data === null || data === undefined) {
    return (
      <div className="code-block text-[14px] text-[#9ca3af]">
        (no data)
      </div>
    );
  }

  const jsonString = JSON.stringify(data, null, 2);

  // Extract text content for text mode
  const textContent = (() => {
    if (typeof data === "string") return data;
    if (typeof data === "number" || typeof data === "boolean") return String(data);
    if (typeof data === "object") {
      const obj = data as Record<string, unknown>;

      // Handle common patterns
      if ("content" in obj && typeof obj.content === "string") {
        return obj.content;
      }
      if ("text" in obj && typeof obj.text === "string") {
        return obj.text;
      }
      if ("transcript" in obj && typeof obj.transcript === "string") {
        return obj.transcript;
      }
      if ("result" in obj) {
        if (typeof obj.result === "string") return obj.result;
        return JSON.stringify(obj.result, null, 2);
      }
      if ("message" in obj && typeof obj.message === "string") {
        return obj.message;
      }

      // For arrays of messages, extract content
      if (Array.isArray(data)) {
        return data
          .map((item) => {
            if (typeof item === "string") return item;
            if (typeof item === "object" && item && "content" in item) {
              const role = "role" in item ? `[${item.role}] ` : "";
              return `${role}${item.content}`;
            }
            return JSON.stringify(item, null, 2);
          })
          .join("\n\n");
      }

      // Fallback: try to extract any string value
      const stringValues = Object.values(obj).filter(v => typeof v === "string");
      if (stringValues.length === 1) {
        return stringValues[0] as string;
      }

      return JSON.stringify(data, null, 2);
    }
    return String(data);
  })();

  // Simple syntax highlighting for JSON
  const highlighted = jsonString
    .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
    .replace(/: "([^"]*)"([,\n\}])/g, ': <span class="json-string">"$1"</span>$2')
    .replace(/: (\d+\.?\d*)([,\n\}])/g, ': <span class="json-number">$1</span>$2')
    .replace(/: (true|false)([,\n\}])/g, ': <span class="json-boolean">$1</span>$2')
    .replace(/: (null)([,\n\}])/g, ': <span class="json-null">$1</span>$2');

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {label && <span className="text-[12px] text-[#6b7280] uppercase tracking-wide">{label}</span>}
        <select
          className="galileo-select text-[12px]"
          value={mode}
          onChange={(e) => setMode(e.target.value as ViewMode)}
        >
          <option value="json">JSON</option>
          <option value="text">Text</option>
        </select>
      </div>
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
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[13px] text-[#6b7280]">{label}</span>
      <span className="text-[13px] text-[#1f2937] font-medium">{value}</span>
    </div>
  );
}

interface ProviderMetrics {
  provider: string;
  type: "llm" | "stt" | "tts";
  count: number;
  totalLatency: number;
  avgLatency: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalCost: number;
}

interface ConversationTurn {
  index: number;
  userInput?: { type: "stt"; data: STTCall } | { type: "text"; content: string };
  llmCalls: LLMCall[];
  toolCalls: ToolExecution[];
  systemOutput?: { type: "tts"; data: TTSCall } | { type: "text"; content: string };
}

function collectAllNodes(node: TreeNode): TreeNode[] {
  const result: TreeNode[] = [node];
  for (const child of node.children) {
    result.push(...collectAllNodes(child));
  }
  return result;
}

function computeProviderMetrics(nodes: TreeNode[]): ProviderMetrics[] {
  const metricsMap = new Map<string, ProviderMetrics>();

  for (const node of nodes) {
    if (node.type === "llm") {
      const llm = node.data as LLMCall;
      const key = `llm:${llm.provider}/${llm.model}`;
      const existing = metricsMap.get(key) || {
        provider: `${formatProviderName(llm.provider)} / ${formatProviderName(llm.model)}`,
        type: "llm" as const,
        count: 0,
        totalLatency: 0,
        avgLatency: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
      };
      existing.count++;
      existing.totalLatency += llm.duration_ms || 0;
      existing.totalTokens = (existing.totalTokens || 0) + (llm.total_tokens || 0);
      existing.inputTokens = (existing.inputTokens || 0) + (llm.prompt_tokens || 0);
      existing.outputTokens = (existing.outputTokens || 0) + (llm.completion_tokens || 0);
      existing.totalCost += calculateLLMCost(llm.provider, llm.model, llm.prompt_tokens || 0, llm.completion_tokens || 0);
      existing.avgLatency = existing.totalLatency / existing.count;
      metricsMap.set(key, existing);
    } else if (node.type === "stt") {
      const stt = node.data as STTCall;
      const key = `stt:${stt.provider}/${stt.model}`;
      const existing = metricsMap.get(key) || {
        provider: `${formatProviderName(stt.provider)} / ${formatProviderName(stt.model)}`,
        type: "stt" as const,
        count: 0,
        totalLatency: 0,
        avgLatency: 0,
        totalCost: 0,
      };
      existing.count++;
      existing.totalLatency += stt.duration_ms || 0;
      existing.totalCost += calculateSTTCost(stt.provider, stt.model, stt.audio_duration_ms);
      existing.avgLatency = existing.totalLatency / existing.count;
      metricsMap.set(key, existing);
    } else if (node.type === "tts") {
      const tts = node.data as TTSCall;
      const key = `tts:${tts.provider}/${tts.model}`;
      const existing = metricsMap.get(key) || {
        provider: `${formatProviderName(tts.provider)} / ${formatProviderName(tts.model)}`,
        type: "tts" as const,
        count: 0,
        totalLatency: 0,
        avgLatency: 0,
        totalCost: 0,
      };
      existing.count++;
      existing.totalLatency += tts.duration_ms || 0;
      existing.totalCost += calculateTTSCost(tts.provider, tts.model, tts.input_chars);
      existing.avgLatency = existing.totalLatency / existing.count;
      metricsMap.set(key, existing);
    }
  }

  return Array.from(metricsMap.values());
}

function extractConversationTurns(nodes: TreeNode[]): ConversationTurn[] {
  // Get all nodes sorted by start time
  const timelineNodes = nodes
    .filter(n => n.type !== "agent")
    .map(n => ({
      node: n,
      startTime: new Date(
        (n.data as LLMCall | STTCall | TTSCall | ToolExecution).started_at
      ).getTime(),
    }))
    .sort((a, b) => a.startTime - b.startTime);

  const turns: ConversationTurn[] = [];
  let currentTurn: ConversationTurn | null = null;

  for (const { node } of timelineNodes) {
    if (node.type === "stt") {
      // STT marks the start of a new turn
      if (currentTurn) {
        turns.push(currentTurn);
      }
      currentTurn = {
        index: turns.length + 1,
        userInput: { type: "stt", data: node.data as STTCall },
        llmCalls: [],
        toolCalls: [],
      };
    } else if (node.type === "llm") {
      if (!currentTurn) {
        // LLM without preceding STT (text-based input)
        currentTurn = {
          index: turns.length + 1,
          llmCalls: [],
          toolCalls: [],
        };
      }
      currentTurn.llmCalls.push(node.data as LLMCall);
      // Also collect tools from children
      for (const child of node.children) {
        if (child.type === "tool") {
          currentTurn.toolCalls.push(child.data as ToolExecution);
        }
      }
    } else if (node.type === "tool" && currentTurn) {
      // Standalone tool (not under LLM)
      currentTurn.toolCalls.push(node.data as ToolExecution);
    } else if (node.type === "tts") {
      if (currentTurn) {
        currentTurn.systemOutput = { type: "tts", data: node.data as TTSCall };
        turns.push(currentTurn);
        currentTurn = null;
      }
    }
  }

  // Push any remaining turn
  if (currentTurn && (currentTurn.llmCalls.length > 0 || currentTurn.userInput)) {
    turns.push(currentTurn);
  }

  return turns;
}

function ProviderMetricsTable({ metrics }: { metrics: ProviderMetrics[] }) {
  const llmMetrics = metrics.filter(m => m.type === "llm");
  const sttMetrics = metrics.filter(m => m.type === "stt");
  const ttsMetrics = metrics.filter(m => m.type === "tts");

  const totalCost = metrics.reduce((sum, m) => sum + m.totalCost, 0);

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#f9fafb] rounded-lg p-2">
          <div className="text-[11px] text-[#6b7280] uppercase">Total Cost</div>
          <div className="text-[14px] font-semibold text-[#1f2937]">{formatCost(totalCost)}</div>
        </div>
        <div className="bg-[#f9fafb] rounded-lg p-2">
          <div className="text-[11px] text-[#6b7280] uppercase">LLM Calls</div>
          <div className="text-[14px] font-semibold text-[#1f2937]">
            {llmMetrics.reduce((sum, m) => sum + m.count, 0)}
          </div>
        </div>
        <div className="bg-[#f9fafb] rounded-lg p-2">
          <div className="text-[11px] text-[#6b7280] uppercase">Total Tokens</div>
          <div className="text-[14px] font-semibold text-[#1f2937]">
            {llmMetrics.reduce((sum, m) => sum + (m.totalTokens || 0), 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* LLM breakdown */}
      {llmMetrics.length > 0 && (
        <div>
          <div className="text-[12px] font-medium text-[#6b7280] mb-2">LLM Usage</div>
          <div className="bg-[#f9fafb] rounded-lg divide-y divide-[#e5e7eb]">
            {llmMetrics.map((m, i) => (
              <div key={i} className="px-3 py-2">
                <div className="flex justify-between items-center">
                  <span className="text-[12px] font-medium text-[#374151]">{m.provider}</span>
                  <span className="text-[12px] text-[#6b7280]">{m.count}x</span>
                </div>
                <div className="flex gap-4 mt-1 text-[11px] text-[#6b7280]">
                  <span>{m.inputTokens?.toLocaleString()} in / {m.outputTokens?.toLocaleString()} out</span>
                  <span>avg {Math.round(m.avgLatency)}ms</span>
                  <span>{formatCost(m.totalCost)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STT breakdown */}
      {sttMetrics.length > 0 && (
        <div>
          <div className="text-[12px] font-medium text-[#6b7280] mb-2">Speech-to-Text</div>
          <div className="bg-[#f9fafb] rounded-lg divide-y divide-[#e5e7eb]">
            {sttMetrics.map((m, i) => (
              <div key={i} className="px-3 py-2 flex justify-between items-center">
                <span className="text-[12px] font-medium text-[#374151]">{m.provider}</span>
                <div className="flex gap-4 text-[11px] text-[#6b7280]">
                  <span>{m.count}x</span>
                  <span>avg {Math.round(m.avgLatency)}ms</span>
                  <span>{formatCost(m.totalCost)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TTS breakdown */}
      {ttsMetrics.length > 0 && (
        <div>
          <div className="text-[12px] font-medium text-[#6b7280] mb-2">Text-to-Speech</div>
          <div className="bg-[#f9fafb] rounded-lg divide-y divide-[#e5e7eb]">
            {ttsMetrics.map((m, i) => (
              <div key={i} className="px-3 py-2 flex justify-between items-center">
                <span className="text-[12px] font-medium text-[#374151]">{m.provider}</span>
                <div className="flex gap-4 text-[11px] text-[#6b7280]">
                  <span>{m.count}x</span>
                  <span>avg {Math.round(m.avgLatency)}ms</span>
                  <span>{formatCost(m.totalCost)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConversationTurnView({ turn }: { turn: ConversationTurn }) {
  const [expanded, setExpanded] = useState(false);

  // Extract user message
  let userMessage = "";
  if (turn.userInput?.type === "stt") {
    userMessage = turn.userInput.data.transcript || "(no transcript)";
  } else if (turn.userInput?.type === "text") {
    userMessage = turn.userInput.content;
  } else if (turn.llmCalls.length > 0) {
    // Try to get user message from first LLM call
    const firstLLM = turn.llmCalls[0];
    const userMsg = firstLLM.request_messages?.find(m => m.role === "user");
    userMessage = userMsg?.content || "(no input)";
  }

  // Extract assistant response
  let assistantMessage = "";
  if (turn.systemOutput?.type === "tts") {
    assistantMessage = turn.systemOutput.data.input_text || "(no output)";
  } else if (turn.systemOutput?.type === "text") {
    assistantMessage = turn.systemOutput.content;
  } else if (turn.llmCalls.length > 0) {
    // Get response from last LLM call
    const lastLLM = turn.llmCalls[turn.llmCalls.length - 1];
    assistantMessage = lastLLM.response_content || "(no response)";
  }

  const totalLatency = turn.llmCalls.reduce((sum, llm) => sum + (llm.duration_ms || 0), 0);
  const totalTokens = turn.llmCalls.reduce((sum, llm) => sum + (llm.total_tokens || 0), 0);

  return (
    <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
      {/* Turn header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 bg-[#f9fafb] flex items-center justify-between hover:bg-[#f3f4f6] transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-[#9ca3af]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#9ca3af]" />
          )}
          <span className="text-[12px] font-medium text-[#374151]">Turn {turn.index}</span>
          {turn.toolCalls.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[#e5e7eb] rounded text-[#6b7280]">
              {turn.toolCalls.length} tool{turn.toolCalls.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex gap-3 text-[11px] text-[#6b7280]">
          <span>{totalTokens} tokens</span>
          <span>{totalLatency}ms</span>
        </div>
      </button>

      {/* Turn content */}
      <div className="px-3 py-2 space-y-2">
        {/* User message */}
        <div>
          <div className="text-[10px] font-medium text-[#9ca3af] uppercase mb-1">User</div>
          <div className="text-[13px] text-[#374151] bg-[#eef2ff] rounded-lg px-3 py-2">
            {userMessage.length > 200 && !expanded
              ? userMessage.slice(0, 200) + "..."
              : userMessage}
          </div>
        </div>

        {/* Tools used (if expanded) */}
        {expanded && turn.toolCalls.length > 0 && (
          <div>
            <div className="text-[10px] font-medium text-[#9ca3af] uppercase mb-1">Tools</div>
            <div className="space-y-1">
              {turn.toolCalls.map((tool, i) => (
                <div
                  key={i}
                  className={`text-[12px] font-mono px-2 py-1 rounded ${
                    tool.status === "error"
                      ? "bg-[#fef2f2] text-[#dc2626]"
                      : "bg-[#f0fdf4] text-[#166534]"
                  }`}
                >
                  {tool.tool_name}({Object.keys(tool.arguments || {}).join(", ")})
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assistant message */}
        <div>
          <div className="text-[10px] font-medium text-[#9ca3af] uppercase mb-1">Assistant</div>
          <div className="text-[13px] text-[#374151] bg-[#f9fafb] rounded-lg px-3 py-2">
            {assistantMessage.length > 200 && !expanded
              ? assistantMessage.slice(0, 200) + "..."
              : assistantMessage}
          </div>
        </div>
      </div>
    </div>
  );
}

type ProviderType = "llm" | "stt" | "tts";

function ProviderStatsDropdown({ metrics }: { metrics: ProviderMetrics[] }) {
  const [selectedType, setSelectedType] = useState<ProviderType>("llm");

  const llmMetrics = metrics.filter(m => m.type === "llm");
  const sttMetrics = metrics.filter(m => m.type === "stt");
  const ttsMetrics = metrics.filter(m => m.type === "tts");

  // Get stats for the selected type
  const getStatsForType = (type: ProviderType) => {
    const typeMetrics = metrics.filter(m => m.type === type);
    const totalCost = typeMetrics.reduce((sum, m) => sum + m.totalCost, 0);
    const totalCalls = typeMetrics.reduce((sum, m) => sum + m.count, 0);
    return { totalCost, totalCalls };
  };

  const stats = getStatsForType(selectedType);

  // Build available options based on what data exists
  const options: { value: ProviderType; label: string }[] = [];
  if (llmMetrics.length > 0) options.push({ value: "llm", label: "LLM" });
  if (sttMetrics.length > 0) options.push({ value: "stt", label: "STT" });
  if (ttsMetrics.length > 0) options.push({ value: "tts", label: "TTS" });

  // If no options or selected type has no data, show placeholder
  if (options.length === 0) {
    return (
      <div className="text-[13px] text-[#6b7280]">No provider data available</div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Dropdown */}
      <div className="flex items-center gap-2">
        <span className="text-[13px] text-[#6b7280]">Provider</span>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as ProviderType)}
          className="px-2 py-1 text-[13px] border border-[#e5e7eb] rounded-md focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-transparent bg-white"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Stats for selected type */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[#f9fafb] rounded-lg p-2">
          <div className="text-[11px] text-[#6b7280] uppercase">Cost</div>
          <div className="text-[14px] font-semibold text-[#1f2937]">{formatCost(stats.totalCost)}</div>
        </div>
        <div className="bg-[#f9fafb] rounded-lg p-2">
          <div className="text-[11px] text-[#6b7280] uppercase"># of Calls</div>
          <div className="text-[14px] font-semibold text-[#1f2937]">{stats.totalCalls}</div>
        </div>
      </div>
    </div>
  );
}

function AgentDetail({ node }: { node: TreeNode }) {
  const data = node.data as Trace;
  const allNodes = collectAllNodes(node);
  const providerMetrics = computeProviderMetrics(allNodes);
  const turns = extractConversationTurns(allNodes);

  // Calculate total cost across all providers
  const totalCost = providerMetrics.reduce((sum, m) => sum + m.totalCost, 0);

  return (
    <>
      <CollapsibleSection title="Metrics">
        <div className="divide-y divide-[#f3f4f6] mb-3">
          <MetricsRow label="Total Duration" value={data.duration_ms !== null ? `${data.duration_ms} ms` : "—"} />
          <MetricsRow label="Total Cost" value={formatCost(totalCost)} />
          <MetricsRow label="Status" value={capitalizeStatus(data.status)} />
        </div>
        <ProviderStatsDropdown metrics={providerMetrics} />
      </CollapsibleSection>

      {turns.length > 0 && (
        <CollapsibleSection title={`Conversation (${turns.length} turn${turns.length > 1 ? "s" : ""})`}>
          <div className="space-y-2">
            {turns.map((turn, i) => (
              <ConversationTurnView key={i} turn={turn} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {turns.length === 0 && (
        <>
          <CollapsibleSection title="Input">
            <DataViewer data={data.input} defaultMode="text" />
          </CollapsibleSection>

          <CollapsibleSection title="Output">
            <DataViewer data={data.output} defaultMode="text" />
          </CollapsibleSection>
        </>
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

function LLMDetail({ data }: { data: LLMCall }) {
  const cost = calculateLLMCost(
    data.provider,
    data.model,
    data.prompt_tokens || 0,
    data.completion_tokens || 0
  );

  return (
    <>
      <CollapsibleSection title="Metrics">
        <div className="divide-y divide-[#f3f4f6]">
          <MetricsRow label="Cost" value={formatCost(cost)} />
          <MetricsRow label="Latency" value={data.duration_ms !== null ? `${data.duration_ms} ms` : "—"} />
          <MetricsRow label="Model" value={formatProviderName(data.model)} />
          <MetricsRow label="Input Tokens" value={data.prompt_tokens || 0} />
          <MetricsRow label="Output Tokens" value={data.completion_tokens || 0} />
          <MetricsRow label="Total Tokens" value={data.total_tokens || 0} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Input">
        <DataViewer data={data.request_messages || []} defaultMode="text" />
      </CollapsibleSection>

      <CollapsibleSection title="Output">
        {data.response_content ? (
          <DataViewer data={data.response_content} defaultMode="text" />
        ) : data.response_tool_calls && data.response_tool_calls.length > 0 ? (
          <DataViewer data={data.response_tool_calls} defaultMode="json" />
        ) : (
          <DataViewer data={null} />
        )}
      </CollapsibleSection>

      {data.response_tool_calls && data.response_tool_calls.length > 0 && data.response_content && (
        <CollapsibleSection title="Tool Calls">
          <DataViewer data={data.response_tool_calls} defaultMode="json" />
        </CollapsibleSection>
      )}
    </>
  );
}

function ToolDetail({ data }: { data: ToolExecution }) {
  return (
    <>
      <CollapsibleSection title="Metrics">
        <div className="divide-y divide-[#f3f4f6]">
          <MetricsRow label="Latency" value={data.duration_ms !== null ? `${data.duration_ms} ms` : "—"} />
          <MetricsRow label="Status" value={capitalizeStatus(data.status)} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Input">
        <DataViewer data={data.arguments || {}} defaultMode="json" />
      </CollapsibleSection>

      <CollapsibleSection title="Output">
        {data.error ? (
          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-md p-3 text-[13px] text-[#dc2626]">
            {data.error}
          </div>
        ) : (
          <DataViewer data={data.result} defaultMode="text" />
        )}
      </CollapsibleSection>
    </>
  );
}

function STTDetail({ data }: { data: STTCall }) {
  const cost = calculateSTTCost(data.provider, data.model, data.audio_duration_ms);

  return (
    <>
      <CollapsibleSection title="Metrics">
        <div className="divide-y divide-[#f3f4f6]">
          <MetricsRow label="Cost" value={formatCost(cost)} />
          <MetricsRow label="Provider" value={formatProviderName(data.provider)} />
          <MetricsRow label="Model" value={formatProviderName(data.model)} />
          <MetricsRow label="Latency" value={data.duration_ms !== null ? `${data.duration_ms} ms` : "—"} />
          <MetricsRow label="Status" value={capitalizeStatus(data.status)} />
          {data.audio_duration_ms && (
            <MetricsRow label="Audio Duration" value={`${(data.audio_duration_ms / 1000).toFixed(2)}s`} />
          )}
          {data.audio_format && <MetricsRow label="Audio Format" value={data.audio_format} />}
          {data.language && <MetricsRow label="Language" value={data.language} />}
          {data.confidence != null && (
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
          <DataViewer data={data.transcript} defaultMode="text" />
        )}
      </CollapsibleSection>
    </>
  );
}

function TTSDetail({ data }: { data: TTSCall }) {
  const cost = calculateTTSCost(data.provider, data.model, data.input_chars);

  return (
    <>
      <CollapsibleSection title="Metrics">
        <div className="divide-y divide-[#f3f4f6]">
          <MetricsRow label="Cost" value={formatCost(cost)} />
          <MetricsRow label="Provider" value={formatProviderName(data.provider)} />
          <MetricsRow label="Model" value={formatProviderName(data.model)} />
          {data.voice && <MetricsRow label="Voice" value={data.voice} />}
          <MetricsRow label="Latency" value={data.duration_ms !== null ? `${data.duration_ms} ms` : "—"} />
          <MetricsRow label="Status" value={capitalizeStatus(data.status)} />
          <MetricsRow label="Input Characters" value={data.input_chars || 0} />
          {data.output_format && <MetricsRow label="Output Format" value={data.output_format} />}
          {data.output_audio_duration_ms && (
            <MetricsRow label="Output Duration" value={`${(data.output_audio_duration_ms / 1000).toFixed(2)}s`} />
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Input Text">
        <DataViewer data={data.input_text} defaultMode="text" />
      </CollapsibleSection>

      {data.voice_settings && Object.keys(data.voice_settings).length > 0 && (
        <CollapsibleSection title="Voice Settings" defaultOpen={false}>
          <DataViewer data={data.voice_settings} defaultMode="json" />
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
      <div className="sticky top-0 bg-white border-b border-[#e5e7eb] px-4 py-3 z-10">
        <div className="flex items-center gap-2">
          {getIcon(node.type)}
          <span className="text-[15px] font-semibold text-[#1f2937]">
            {getTitle()}
          </span>
          {(node.type === "llm" || node.type === "stt" || node.type === "tts") && (
            <span className="text-[14px] text-[#6b7280]">{node.name}</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div>
        {node.type === "agent" && <AgentDetail node={node} />}
        {node.type === "llm" && <LLMDetail data={node.data as LLMCall} />}
        {node.type === "tool" && <ToolDetail data={node.data as ToolExecution} />}
        {node.type === "stt" && <STTDetail data={node.data as STTCall} />}
        {node.type === "tts" && <TTSDetail data={node.data as TTSCall} />}
      </div>
    </div>
  );
}
