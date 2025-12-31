"use client";

import { Trace } from "@/types/trace";
import { ChevronRight } from "lucide-react";

interface TraceTableProps {
  traces: Trace[];
  selectedTraceId: string | null;
  onSelectTrace: (trace: Trace) => void;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <span className="inline-flex items-center px-2.5 py-1 text-[12px] font-medium rounded bg-[#d1fae5] text-[#065f46]">
          completed
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center px-2.5 py-1 text-[12px] font-medium rounded bg-[#fee2e2] text-[#dc2626]">
          error
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-1 text-[12px] font-medium rounded bg-[#fef3c7] text-[#d97706]">
          {status}
        </span>
      );
  }
}

function formatDuration(ms: number | null) {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} sec`;
}

function truncate(str: string | null, len: number) {
  if (!str) return "—";
  return str.length > len ? str.substring(0, len) + "..." : str;
}

export default function TraceTable({
  traces,
  selectedTraceId,
  onSelectTrace,
}: TraceTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#e5e7eb] text-left">
            <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280] uppercase tracking-wider w-10"></th>
            <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280] uppercase tracking-wider">
              ID
            </th>
            <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280] uppercase tracking-wider">
              Node Type
            </th>
            <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280] uppercase tracking-wider">
              Node Name
            </th>
            <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280] uppercase tracking-wider">
              Node Input
            </th>
            <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280] uppercase tracking-wider">
              Node Output
            </th>
            <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280] uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280] uppercase tracking-wider">
              Latency
            </th>
            <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280] uppercase tracking-wider">
              Tokens
            </th>
          </tr>
        </thead>
        <tbody>
          {traces.map((trace, index) => (
            <tr
              key={trace.trace_id}
              onClick={() => onSelectTrace(trace)}
              className={`
                border-b border-[#f3f4f6] cursor-pointer transition-colors
                ${selectedTraceId === trace.trace_id
                  ? "bg-[#eef2ff]"
                  : "hover:bg-[#f9fafb]"
                }
              `}
            >
              <td className="px-4 py-3.5">
                <ChevronRight className="w-5 h-5 text-[#9ca3af]" />
              </td>
              <td className="px-4 py-3.5 text-[14px] text-[#6b7280]">
                {index}
              </td>
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-[#eef2ff] flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-[#6366f1]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                  <span className="text-[14px] text-[#1f2937]">Agent</span>
                </div>
              </td>
              <td className="px-4 py-3.5 text-[14px] text-[#1f2937]">
                {trace.agent_name}
              </td>
              <td className="px-4 py-3.5 text-[14px] text-[#6b7280] max-w-[220px]">
                {truncate(trace.input, 40)}
              </td>
              <td className="px-4 py-3.5 text-[14px] text-[#6b7280] max-w-[220px]">
                {truncate(trace.output, 40)}
              </td>
              <td className="px-4 py-3.5">
                {getStatusBadge(trace.status)}
              </td>
              <td className="px-4 py-3.5 text-[14px] text-[#6b7280]">
                {formatDuration(trace.duration_ms)}
              </td>
              <td className="px-4 py-3.5 text-[14px] text-[#6b7280]">
                {trace.total_tokens}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {traces.length === 0 && (
        <div className="text-center py-20 text-[14px] text-[#6b7280]">
          No traces found. Run an agent to see traces here.
        </div>
      )}
    </div>
  );
}
