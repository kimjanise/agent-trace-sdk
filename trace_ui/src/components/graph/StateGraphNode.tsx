"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import {
  Workflow,
  Sparkles,
  Wrench,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Mic,
  Volume2,
} from "lucide-react";

export interface StateGraphNodeData {
  id: string;
  type: "agent" | "llm" | "tool" | "stt" | "tts";
  name: string;
  status: string;
  duration_ms: number | null;
  isError: boolean;
  preview: {
    // Agent
    inputPreview?: string;
    outputPreview?: string;
    // LLM
    model?: string;
    messageCount?: number;
    responsePreview?: string;
    tokens?: number | null;
    // Tool
    argsPreview?: string;
    resultPreview?: string;
    // STT
    transcript?: string;
    // TTS
    voice?: string;
    textPreview?: string;
  };
  originalNode: unknown;
}

const TYPE_STYLES = {
  agent: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    accent: "border-indigo-500",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
    Icon: Workflow,
  },
  llm: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    accent: "border-amber-500",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    Icon: Sparkles,
  },
  tool: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    accent: "border-emerald-500",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    Icon: Wrench,
  },
  stt: {
    bg: "bg-pink-50",
    border: "border-pink-200",
    accent: "border-pink-500",
    iconBg: "bg-pink-100",
    iconColor: "text-pink-600",
    Icon: Mic,
  },
  tts: {
    bg: "bg-violet-50",
    border: "border-violet-200",
    accent: "border-violet-500",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    Icon: Volume2,
  },
};

const ERROR_STYLES = {
  bg: "bg-red-50",
  border: "border-red-200",
  accent: "border-red-500",
  iconBg: "bg-red-100",
  iconColor: "text-red-600",
};

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function truncate(str: string | undefined, maxLen: number): string {
  if (!str) return "-";
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}

function StateGraphNodeComponent({ data, selected }: NodeProps<StateGraphNodeData>) {
  const styles = data.isError ? ERROR_STYLES : TYPE_STYLES[data.type];
  const Icon = data.isError ? AlertCircle : TYPE_STYLES[data.type].Icon;

  return (
    <div
      className={`
        w-[280px] rounded-xl border-2 shadow-sm transition-all duration-200
        ${styles.bg} ${selected ? styles.accent : styles.border}
        ${selected ? "shadow-md" : "hover:shadow-md"}
      `}
    >
      {/* Handles for edges */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-400 !w-2 !h-2 !border-0"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-400 !w-2 !h-2 !border-0"
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200/50">
        <div className={`p-1.5 rounded-lg ${styles.iconBg}`}>
          <Icon className={`w-4 h-4 ${styles.iconColor}`} />
        </div>
        <span className="font-medium text-[13px] text-gray-900 truncate flex-1">
          {data.name}
        </span>
        {data.isError ? (
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 rounded">
            ERROR
          </span>
        ) : data.status === "completed" || data.status === "success" ? (
          <CheckCircle className="w-4 h-4 text-emerald-500" />
        ) : (
          <Clock className="w-4 h-4 text-gray-400" />
        )}
      </div>

      {/* Body - Type-specific preview */}
      <div className="px-3 py-2 space-y-1.5 text-[12px] text-gray-600">
        {data.type === "agent" && (
          <>
            <div>
              <span className="text-gray-400">Input: </span>
              <span className="text-gray-700">{truncate(data.preview.inputPreview, 40)}</span>
            </div>
            <div>
              <span className="text-gray-400">Output: </span>
              <span className="text-gray-700">{truncate(data.preview.outputPreview, 40)}</span>
            </div>
          </>
        )}

        {data.type === "llm" && (
          <>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[11px] font-mono">
                {data.preview.model || "unknown"}
              </span>
              {data.preview.messageCount && (
                <span className="text-gray-400">
                  {data.preview.messageCount} messages
                </span>
              )}
            </div>
            <div>
              <span className="text-gray-400">Response: </span>
              <span className="text-gray-700">
                {truncate(data.preview.responsePreview, 50)}
              </span>
            </div>
          </>
        )}

        {data.type === "tool" && (
          <>
            <div>
              <span className="text-gray-400">Args: </span>
              <span className="font-mono text-[11px] text-gray-700">
                {truncate(data.preview.argsPreview, 45)}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Result: </span>
              <span className="font-mono text-[11px] text-gray-700">
                {truncate(data.preview.resultPreview, 45)}
              </span>
            </div>
          </>
        )}

        {data.type === "stt" && (
          <>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[11px] font-mono">
                {data.preview.model || "unknown"}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Transcript: </span>
              <span className="text-gray-700">
                {truncate(data.preview.transcript, 50)}
              </span>
            </div>
          </>
        )}

        {data.type === "tts" && (
          <>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[11px] font-mono">
                {data.preview.voice || data.preview.model || "unknown"}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Text: </span>
              <span className="text-gray-700">
                {truncate(data.preview.textPreview, 50)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200/50 text-[11px]">
        <div className="flex items-center gap-1 text-gray-500">
          <Clock className="w-3 h-3" />
          <span>{formatDuration(data.duration_ms)}</span>
        </div>
        {data.type === "llm" && data.preview.tokens && (
          <div className="flex items-center gap-1 text-gray-500">
            <Zap className="w-3 h-3" />
            <span>{data.preview.tokens.toLocaleString()} tokens</span>
          </div>
        )}
        {data.type === "tool" && (
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              data.isError
                ? "bg-red-100 text-red-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {data.isError ? "failed" : "success"}
          </span>
        )}
      </div>
    </div>
  );
}

export default memo(StateGraphNodeComponent);
